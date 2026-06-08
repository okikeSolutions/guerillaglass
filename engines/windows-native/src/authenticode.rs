use std::path::Path;

#[cfg_attr(not(windows), allow(dead_code))]
#[derive(Debug, Clone)]
pub struct AuthenticodeExpectation {
    pub expected_sha256_thumbprint: Option<String>,
    pub expected_subject_contains: Option<String>,
    pub revocation: RevocationMode,
}

#[derive(Debug, Clone, Copy)]
pub enum RevocationMode {
    Online,
    OfflineAllowed,
}

#[derive(Debug, Clone)]
pub struct AuthenticodeVerificationResult {
    pub ok: bool,
    pub subject: Option<String>,
    pub sha256_thumbprint: Option<String>,
    pub error: Option<String>,
}

#[cfg(windows)]
pub fn verify_authenticode_signature(
    executable_path: &Path,
    expectation: &AuthenticodeExpectation,
) -> AuthenticodeVerificationResult {
    windows_impl::verify_authenticode_signature(executable_path, expectation)
}

#[cfg(not(windows))]
pub fn verify_authenticode_signature(
    _executable_path: &Path,
    _expectation: &AuthenticodeExpectation,
) -> AuthenticodeVerificationResult {
    AuthenticodeVerificationResult {
        ok: false,
        subject: None,
        sha256_thumbprint: None,
        error: Some("Authenticode verification is only available on Windows".to_string()),
    }
}

#[cfg_attr(not(windows), allow(dead_code))]
pub fn normalize_thumbprint(value: &str) -> String {
    value
        .trim()
        .trim_start_matches("sha256:")
        .chars()
        .filter(|character| !character.is_ascii_whitespace() && *character != ':')
        .flat_map(|character| character.to_lowercase())
        .collect()
}

#[cfg(windows)]
mod windows_impl {
    use super::{normalize_thumbprint, AuthenticodeExpectation, AuthenticodeVerificationResult, RevocationMode};
    use std::ffi::c_void;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{HWND, WIN32_ERROR};
    use windows::Win32::Security::Cryptography::{
        CertGetCertificateContextProperty, CertGetNameStringW, CERT_CONTEXT,
        CERT_NAME_SIMPLE_DISPLAY_TYPE, CERT_SHA256_HASH_PROP_ID,
    };
    use windows::Win32::Security::WinTrust::{
        WinVerifyTrust, WTHelperGetProvCertFromChain, WTHelperGetProvSignerFromChain,
        WTHelperProvDataFromStateData, WINTRUST_ACTION_GENERIC_VERIFY_V2, WINTRUST_DATA,
        WINTRUST_DATA_0, WINTRUST_FILE_INFO, WTD_CHOICE_FILE,
        WTD_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT, WTD_REVOKE_NONE, WTD_REVOKE_WHOLECHAIN,
        WTD_STATEACTION_CLOSE, WTD_STATEACTION_VERIFY, WTD_UI_NONE,
    };

    pub fn verify_authenticode_signature(
        executable_path: &Path,
        expectation: &AuthenticodeExpectation,
    ) -> AuthenticodeVerificationResult {
        unsafe {
            let mut wide_path: Vec<u16> = executable_path.as_os_str().encode_wide().collect();
            wide_path.push(0);

            let mut file_info = WINTRUST_FILE_INFO {
                cbStruct: std::mem::size_of::<WINTRUST_FILE_INFO>() as u32,
                pcwszFilePath: PCWSTR(wide_path.as_ptr()),
                hFile: Default::default(),
                pgKnownSubject: std::ptr::null_mut(),
            };

            let mut trust_data = WINTRUST_DATA {
                cbStruct: std::mem::size_of::<WINTRUST_DATA>() as u32,
                pPolicyCallbackData: std::ptr::null_mut(),
                pSIPClientData: std::ptr::null_mut(),
                dwUIChoice: WTD_UI_NONE,
                fdwRevocationChecks: match expectation.revocation {
                    RevocationMode::Online => WTD_REVOKE_WHOLECHAIN,
                    RevocationMode::OfflineAllowed => WTD_REVOKE_NONE,
                },
                dwUnionChoice: WTD_CHOICE_FILE,
                Anonymous: WINTRUST_DATA_0 { pFile: &mut file_info },
                dwStateAction: WTD_STATEACTION_VERIFY,
                hWVTStateData: Default::default(),
                pwszURLReference: PCWSTR::null(),
                dwProvFlags: match expectation.revocation {
                    RevocationMode::Online => WTD_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT,
                    RevocationMode::OfflineAllowed => Default::default(),
                },
                dwUIContext: Default::default(),
                pSignatureSettings: std::ptr::null_mut(),
            };

            let status = WinVerifyTrust(
                HWND(0),
                &WINTRUST_ACTION_GENERIC_VERIFY_V2,
                &mut trust_data as *mut _ as *mut c_void,
            );
            if status != WIN32_ERROR(0) {
                close_wintrust_state(&mut trust_data);
                return AuthenticodeVerificationResult {
                    ok: false,
                    subject: None,
                    sha256_thumbprint: None,
                    error: Some(format!("WinVerifyTrust failed with status 0x{:08x}", status.0)),
                };
            }

            let certificate_context = signer_certificate_context(&trust_data);
            let subject = certificate_context.and_then(certificate_subject);
            let sha256_thumbprint = certificate_context.and_then(certificate_sha256_thumbprint);
            close_wintrust_state(&mut trust_data);

            if let Some(expected_thumbprint) = expectation.expected_sha256_thumbprint.as_deref() {
                let expected = normalize_thumbprint(expected_thumbprint);
                let actual = sha256_thumbprint
                    .as_deref()
                    .map(normalize_thumbprint)
                    .unwrap_or_default();
                if expected.is_empty() || expected != actual {
                    return AuthenticodeVerificationResult {
                        ok: false,
                        subject,
                        sha256_thumbprint,
                        error: Some("Authenticode signer SHA-256 thumbprint mismatch".to_string()),
                    };
                }
            }

            if let Some(expected_subject_contains) = expectation.expected_subject_contains.as_deref() {
                let actual = subject.as_deref().unwrap_or_default().to_lowercase();
                if !actual.contains(&expected_subject_contains.to_lowercase()) {
                    return AuthenticodeVerificationResult {
                        ok: false,
                        subject,
                        sha256_thumbprint,
                        error: Some("Authenticode signer subject mismatch".to_string()),
                    };
                }
            }

            AuthenticodeVerificationResult {
                ok: true,
                subject,
                sha256_thumbprint,
                error: None,
            }
        }
    }

    unsafe fn close_wintrust_state(trust_data: &mut WINTRUST_DATA) {
        trust_data.dwStateAction = WTD_STATEACTION_CLOSE;
        let _ = WinVerifyTrust(
            HWND(0),
            &WINTRUST_ACTION_GENERIC_VERIFY_V2,
            trust_data as *mut _ as *mut c_void,
        );
    }

    unsafe fn signer_certificate_context(trust_data: &WINTRUST_DATA) -> Option<*const CERT_CONTEXT> {
        let provider_data = WTHelperProvDataFromStateData(trust_data.hWVTStateData);
        if provider_data.is_null() {
            return None;
        }
        let signer = WTHelperGetProvSignerFromChain(provider_data, 0, false.into(), 0);
        if signer.is_null() {
            return None;
        }
        let cert = WTHelperGetProvCertFromChain(signer, 0);
        if cert.is_null() || (*cert).pCert.is_null() {
            return None;
        }
        Some((*cert).pCert)
    }

    unsafe fn certificate_sha256_thumbprint(certificate: *const CERT_CONTEXT) -> Option<String> {
        let mut length = 0u32;
        let _ = CertGetCertificateContextProperty(
            certificate,
            CERT_SHA256_HASH_PROP_ID,
            None,
            &mut length,
        );
        if length == 0 {
            return None;
        }
        let mut bytes = vec![0u8; length as usize];
        if !CertGetCertificateContextProperty(
            certificate,
            CERT_SHA256_HASH_PROP_ID,
            Some(bytes.as_mut_ptr() as *mut c_void),
            &mut length,
        )
        .as_bool()
        {
            return None;
        }
        Some(bytes.into_iter().map(|byte| format!("{byte:02x}")).collect())
    }

    unsafe fn certificate_subject(certificate: *const CERT_CONTEXT) -> Option<String> {
        let required = CertGetNameStringW(
            certificate,
            CERT_NAME_SIMPLE_DISPLAY_TYPE,
            0,
            None,
            None,
        );
        if required <= 1 {
            return None;
        }
        let mut buffer = vec![0u16; required as usize];
        let written = CertGetNameStringW(
            certificate,
            CERT_NAME_SIMPLE_DISPLAY_TYPE,
            0,
            None,
            Some(&mut buffer),
        );
        if written <= 1 {
            return None;
        }
        buffer.truncate((written - 1) as usize);
        String::from_utf16(&buffer).ok()
    }
}
