# Release hardening notes

These notes capture the remaining production-signing and platform-validation work for desktop releases. They are intentionally separate from local demo/editor functionality so the current branch does not imply broader Windows/Linux production readiness than has been validated.

## Production signing configuration

Do not commit real certificate identifiers, private keys, or notarization credentials. Release environments should provide the expected signing values through secrets/configuration.

### macOS engine trust

When macOS engine executable trust is enabled, configure:

- `GG_ENGINE_EXPECTED_TEAM_ID` — Apple Developer Team ID expected on the trusted native engine.
- `GG_ENGINE_SIGNING_REQUIREMENT` — optional stricter SecRequirement string for the native engine.
- `GG_MACOS_CODE_SIGNATURE_HELPER_PATH` — absolute path to the verifier helper.

Current desktop packaging does not bundle the macOS verifier helper. Configure an explicit helper path when enabling macOS engine executable trust.

### Windows engine trust

When Windows Authenticode trust is enabled, configure:

- `GG_WINDOWS_EXPECTED_PUBLISHER_SHA256_THUMBPRINT` — expected SHA-256 thumbprint for the publisher signing certificate.
- `GG_WINDOWS_EXPECTED_PUBLISHER_SUBJECT` — expected publisher subject substring.
- `GG_WINDOWS_AUTHENTICODE_HELPER_PATH` — absolute path to the Authenticode verifier helper.
- `GG_WINDOWS_ALLOW_OFFLINE_REVOCATION` — optional escape hatch for offline revocation behavior.

Current status: Windows Authenticode verification code exists, but native Windows validation and final helper packaging are not complete. Do not treat Windows executable trust as production-validated until the checklist below is complete.

## Windows validation checklist

Before claiming production Windows executable trust readiness, validate the Authenticode helper on native Windows against:

- unsigned executable rejection;
- valid signed executable acceptance;
- wrong publisher subject rejection;
- wrong SHA-256 thumbprint rejection;
- revoked certificate behavior;
- expired certificate behavior;
- online revocation and `GG_WINDOWS_ALLOW_OFFLINE_REVOCATION` behavior.

Also finalize packaging so the verifier/helper is independently trusted and signed. Avoid relying on the same untrusted engine binary to verify itself.

## Follow-up hardening backlog

- Add directory-fd/openat-style traversal for stronger path handling where platform APIs allow it.
- Add Linux executable trust beyond generic file checks, such as parent directory ownership/permission checks and optional package/signature trust.
- Refactor repeated Swift `lstat` symlink walkers into a shared helper module.
- Keep export installation descriptor-backed where possible; full fd-backed muxing would require APIs outside current AVFoundation usage.
- Refine capability issuance to align with explicit UI/session state transitions where possible.
- Add native Windows/Linux CI or manual release validation before broad platform production claims.
