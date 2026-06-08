# Security Policy

Guerillaglass is an open source desktop project. Please avoid publishing exploit details, bypass techniques, secret values, or proof-of-concept payloads in public issues before maintainers have had time to triage and remediate.

## Reporting a Vulnerability

Preferred reporting path:

1. Open a GitHub Security Advisory for this repository.
2. If advisories are unavailable, open a public issue with a clear `SECURITY` prefix, but **do not include sensitive details**. A maintainer will arrange a private follow-up channel.

Please include, when safe to share privately:

- affected platform: macOS, Windows, Linux, or web
- affected area: desktop bridge, native engine, media/export, executable trust, review bridge, etc.
- reproduction steps
- expected impact
- whether the issue requires local user interaction, renderer compromise, malicious project/media file, or a malicious engine binary

## Response Timeline

- Acknowledge within 7 days
- Provide a remediation plan or status update within 30 days
- Target fix within 90 days for confirmed issues

High-impact issues affecting arbitrary file write/delete, code execution, executable trust bypass, credential exposure, or unauthorized review mutations may be prioritized faster.

## Supported Security Scope

The current hardening work focuses on the desktop app and native engines:

- Electrobun host/renderer bridge boundaries
- local file and media access
- project open/save/export paths
- loopback media serving
- native Swift/Rust sidecars
- executable trust for native engine launch
- macOS code-signature verification helper
- Windows Authenticode verification helper
- local capability tokens for privileged bridge operations

The renderer should be treated as semi-trusted. Host-side validation, grants, rate limits, capability tokens, and native path checks are required even when calls originate from the local app UI.

## Desktop Security Hardening Status

Desktop signing and executable-trust requirements are also tracked in:

```txt
docs/RELEASE_HARDENING.md
```

### Implemented Hardening

#### Desktop backend configuration and runtime

- Desktop Bun backend configuration uses Effect `Config` through `AppConfig`.
- Runtime composition uses Effect `Layer` and a single managed desktop runtime.
- Electrobun callback boundaries route work through the managed runtime.
- Sensitive local tokens use `Effect.Redacted` where applicable.

#### Bridge request controls

- Bridge requests have host-side schema validation.
- Bridge requests are guarded by rate limits, concurrency limits, and timeouts.
- Renderer-facing bridge errors are redacted before returning to the renderer.
- New security errors, including capability-token failures, round-trip as typed bridge errors.

#### Local capability tokens

Privileged bridge operations are guarded by local opaque capability tokens:

- `review:mutate`
- `media:resolve-source`
- `capture:resolve-preview-url`

Tokens are random, scoped, subject-bound, TTL-bound, idle-expiring, and can be single-use. These tokens are defense-in-depth for local renderer/bridge abuse; they are not a substitute for user authentication or server authorization.

#### File, project, and export path safety

- Path-picker grants are operation-specific.
- Project paths and export paths are validated before native calls.
- Text reads and media snapshots reject symlinks where supported.
- Served media is snapshotted into an app-owned scoped temp directory before loopback serving.
- Rust native writes reject symlink components and non-regular replacement targets.
- Swift native project/export/write paths walk ancestor components with `lstat` and reject symlinks.
- Swift AVFoundation export writes to a trusted temporary replacement location first, then installs to the final destination with no-follow checks and regular-file-only replacement.
- Existing non-regular export destinations, such as directories named `Reports.mov`, are rejected and preserved.

#### Media server hardening

- Media server binds to loopback.
- Media route access is guarded.
- Loopback media URLs are tokenized.
- Media source and capture preview URL minting requires local capabilities.

#### Electrobun shell hardening

- Navigation rules are strict.
- Production/stable builds only allow the local packaged main view.
- Dev server navigation is dev-only and tied to configured `PORT`.
- Trusted local main view remains unsandboxed because Electrobun RPC requires it; host-side bridge validation remains mandatory.

#### Native executable trust

Before launching the configured native engine in production-like mode, the app can enforce:

- no symlink executable
- executable must be a regular file
- reject group/world-writable executable
- optional current-user ownership requirement
- optional SHA-256 allowlist
- optional macOS code-signature requirement verification
- optional Windows Authenticode publisher verification

### macOS Code-Signature Trust

A Swift helper is included for macOS code-signature verification:

```txt
guerillaglass-code-signature-checker
```

It uses Apple Security.framework APIs:

- `SecStaticCodeCreateWithPath`
- `SecRequirementCreateWithString`
- `SecStaticCodeCheckValidityWithErrors`
- `SecCodeCopySigningInformation`

Production builds should pin a real signing requirement, for example one that includes the expected Team ID and identifier. Release secrets should provide the exact values; they must not be hardcoded into public source unless intentionally public.

Relevant config:

```txt
GG_ENGINE_EXPECTED_TEAM_ID
GG_ENGINE_SIGNING_REQUIREMENT
GG_MACOS_CODE_SIGNATURE_HELPER_PATH
```

If the helper is bundled in the app resources, the desktop backend can auto-discover it. Packaging must ensure the helper is copied before final app signing/notarization.

### Windows Authenticode Trust

The Windows native engine includes an Authenticode verification helper mode using Windows trust APIs:

- `WinVerifyTrust`
- `WINTRUST_ACTION_GENERIC_VERIFY_V2`
- signer certificate extraction
- SHA-256 certificate thumbprint comparison
- publisher subject comparison

Relevant config:

```txt
GG_WINDOWS_AUTHENTICODE_HELPER_PATH
GG_WINDOWS_EXPECTED_PUBLISHER_SHA256_THUMBPRINT
GG_WINDOWS_EXPECTED_PUBLISHER_SUBJECT
GG_WINDOWS_ALLOW_OFFLINE_REVOCATION
```

Important: a verifier must not rely on an untrusted executable verifying itself. Production Windows packaging should ship or reference an independently trusted/signed helper strategy.

## CI Security Coverage

The desktop parity matrix runs automatically on pull requests and pushes to `main` across:

- macOS
- Windows
- Linux

It covers TypeScript desktop parity plus native smoke/security checks, including:

- Rust workspace tests on Linux/macOS
- Windows native engine check
- Windows Authenticode helper smoke test using a CI-created self-signed code-signing cert
- Swift build/tests on macOS
- macOS code-signature helper smoke test with an ad-hoc signed fixture

The main full gate remains macOS-based and includes formatting, linting, Rust tests, Swift tests, TypeScript tests, docs gate, and coverage threshold checks.

## Known Gaps / Future Hardening

The following are known limitations and should not be treated as completed production guarantees:

1. **Production signing values are still required**
   - real macOS Team ID
   - real macOS signing requirement
   - real Windows publisher thumbprint/subject

2. **Windows Authenticode needs real release validation**
   - CI uses a self-signed test certificate for behavior coverage.
   - Release signing, revocation behavior, and helper packaging must be validated on real Windows release artifacts.

3. **Windows helper packaging is not final**
   - The verifier strategy must avoid circular trust.
   - A release build should use a trusted helper or signed packaging layout.

4. **AVFoundation is still URL/path-based**
   - Current export flow is hardened with trusted temp output and no-follow final install.
   - True descriptor-backed final media output is not available through high-level AVFoundation APIs.
   - Achieving descriptor-perfect output would require a lower-level writer, FFmpeg/libavformat custom IO, GStreamer `fdsink`, or similar.

5. **Directory-fd traversal would be stronger**
   - Current Rust/Swift hardening walks path components with `symlink_metadata`/`lstat` and uses no-follow final opens where possible.
   - A future `openat`/directory-fd implementation would reduce remaining check-then-open race windows.

6. **Linux executable trust needs a final policy**
   - Current trust checks cover generic file properties and optional hashes.
   - Linux-specific package/signature/parent-directory trust policy is not finalized.

7. **Shared Swift symlink utility should be refactored**
   - Multiple modules currently implement similar `lstat` component walking.
   - A shared helper would reduce drift.

8. **Renderer compromise remains in scope for defense-in-depth only**
   - The bridge is hardened, but a compromised renderer can still attempt allowed local workflows.
   - Server-side authorization, Convex auth, and host-side validation must all remain enforced.

## Guidance for Contributors

When changing desktop or native security-sensitive code:

- Do not add direct desktop backend `process.env` reads; use `AppConfig` / Effect `Config`.
- Do not add unmanaged runtime calls in production desktop code; use the managed app runtime or layers.
- Validate all renderer-originated bridge inputs host-side.
- Prefer operation-scoped grants/capabilities for privileged local operations.
- Do not serve arbitrary user paths directly through the media server.
- Do not recursively delete user-selected paths without first checking the node type.
- Reject symlink path components for native writes where possible.
- Keep release signing secrets out of the public repository.
