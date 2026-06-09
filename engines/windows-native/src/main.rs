mod authenticode;

use authenticode::{verify_authenticode_signature, AuthenticodeExpectation, RevocationMode};
use native_foundation::{run_engine, EngineRuntimeConfig};
use std::env;
use std::path::PathBuf;

fn default_recents_index_path() -> PathBuf {
    if let Some(app_data) = env::var_os("APPDATA") {
        return PathBuf::from(app_data)
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    if let Some(user_profile) = env::var_os("USERPROFILE") {
        return PathBuf::from(user_profile)
            .join("AppData")
            .join("Roaming")
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    if let Some(home) = env::var_os("HOME") {
        return PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("guerillaglass")
            .join("Library")
            .join("library.native.json");
    }
    PathBuf::from("guerillaglass-library.native.json")
}

fn argument_value(arguments: &[String], name: &str) -> Option<String> {
    arguments
        .iter()
        .position(|argument| argument == name)
        .and_then(|index| arguments.get(index + 1))
        .cloned()
}

fn json_escape(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

fn print_authenticode_result(result: authenticode::AuthenticodeVerificationResult) {
    let subject = result
        .subject
        .as_deref()
        .map(|value| format!("\"{}\"", json_escape(value)))
        .unwrap_or_else(|| "null".to_string());
    let thumbprint = result
        .sha256_thumbprint
        .as_deref()
        .map(|value| format!("\"{}\"", json_escape(value)))
        .unwrap_or_else(|| "null".to_string());
    let error = result
        .error
        .as_deref()
        .map(|value| format!("\"{}\"", json_escape(value)))
        .unwrap_or_else(|| "null".to_string());
    println!(
        "{{\"ok\":{},\"subject\":{},\"sha256Thumbprint\":{},\"error\":{}}}",
        if result.ok { "true" } else { "false" },
        subject,
        thumbprint,
        error
    );
}

fn maybe_run_authenticode_helper(arguments: &[String]) -> bool {
    if !arguments
        .iter()
        .any(|argument| argument == "--verify-authenticode")
    {
        return false;
    }

    let Some(path) = argument_value(arguments, "--path") else {
        print_authenticode_result(authenticode::AuthenticodeVerificationResult {
            ok: false,
            subject: None,
            sha256_thumbprint: None,
            error: Some("usage: guerillaglass-engine-windows --verify-authenticode --path <path> [--sha256-thumbprint <thumbprint>] [--subject-contains <subject>] [--offline-revocation]".to_string()),
        });
        std::process::exit(64);
    };

    let result = verify_authenticode_signature(
        PathBuf::from(path).as_path(),
        &AuthenticodeExpectation {
            expected_sha256_thumbprint: argument_value(arguments, "--sha256-thumbprint"),
            expected_subject_contains: argument_value(arguments, "--subject-contains"),
            revocation: if arguments
                .iter()
                .any(|argument| argument == "--offline-revocation")
            {
                RevocationMode::OfflineAllowed
            } else {
                RevocationMode::Online
            },
        },
    );
    let ok = result.ok;
    print_authenticode_result(result);
    std::process::exit(if ok { 0 } else { 1 });
}

fn main() {
    let arguments = env::args().collect::<Vec<_>>();
    if maybe_run_authenticode_helper(&arguments) {
        return;
    }

    run_engine(EngineRuntimeConfig {
        platform: "windows",
        recents_index_path: default_recents_index_path(),
    });
}
