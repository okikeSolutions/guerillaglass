import Foundation
import Security

struct VerificationResult: Codable {
    let ok: Bool
    let teamIdentifier: String?
    let identifier: String?
    let error: String?
}

func emit(_ result: VerificationResult, exitCode: Int32) -> Never {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    if let data = try? encoder.encode(result), let line = String(data: data, encoding: .utf8) {
        print(line)
    } else {
        print("{\"ok\":false,\"error\":\"failed to encode verification result\"}")
    }
    exit(exitCode)
}

func argumentValue(_ name: String) -> String? {
    let arguments = CommandLine.arguments
    guard let index = arguments.firstIndex(of: name), arguments.indices.contains(index + 1) else {
        return nil
    }
    return arguments[index + 1]
}

let executablePath = argumentValue("--path")
let requirementText = argumentValue("--requirement")
let expectedTeamId = argumentValue("--team-id")

if executablePath == nil || (requirementText == nil && expectedTeamId == nil) {
    emit(
        VerificationResult(
            ok: false,
            teamIdentifier: nil,
            identifier: nil,
            error: "usage: guerillaglass-code-signature-checker --path <path> [--requirement <requirement>] [--team-id <team-id>]"
        ),
        exitCode: 64
    )
}

let canonicalPath = URL(fileURLWithPath: executablePath!).resolvingSymlinksInPath().standardizedFileURL
var staticCode: SecStaticCode?
let createStatus = SecStaticCodeCreateWithPath(canonicalPath as CFURL, SecCSFlags(), &staticCode)
guard createStatus == errSecSuccess, let staticCode else {
    emit(
        VerificationResult(
            ok: false,
            teamIdentifier: nil,
            identifier: nil,
            error: "SecStaticCodeCreateWithPath failed with status \(createStatus)"
        ),
        exitCode: 1
    )
}

var requirement: SecRequirement?
if let requirementText {
    let requirementStatus = SecRequirementCreateWithString(requirementText as CFString, SecCSFlags(), &requirement)
    guard requirementStatus == errSecSuccess else {
        emit(
            VerificationResult(
                ok: false,
                teamIdentifier: nil,
                identifier: nil,
                error: "SecRequirementCreateWithString failed with status \(requirementStatus)"
            ),
            exitCode: 1
        )
    }
}

var validationError: Unmanaged<CFError>?
let validationFlags = SecCSFlags(rawValue: kSecCSCheckAllArchitectures | kSecCSStrictValidate | kSecCSRestrictSymlinks)
let validationStatus = SecStaticCodeCheckValidityWithErrors(staticCode, validationFlags, requirement, &validationError)
if validationStatus != errSecSuccess {
    let errorDescription = validationError?.takeRetainedValue().localizedDescription
    emit(
        VerificationResult(
            ok: false,
            teamIdentifier: nil,
            identifier: nil,
            error: errorDescription ?? "SecStaticCodeCheckValidity failed with status \(validationStatus)"
        ),
        exitCode: 1
    )
}

var signingInfo: CFDictionary?
let infoStatus = SecCodeCopySigningInformation(
    staticCode,
    SecCSFlags(rawValue: kSecCSSigningInformation),
    &signingInfo
)
if infoStatus != errSecSuccess {
    emit(
        VerificationResult(
            ok: false,
            teamIdentifier: nil,
            identifier: nil,
            error: "SecCodeCopySigningInformation failed with status \(infoStatus)"
        ),
        exitCode: 1
    )
}

let info = signingInfo as? [String: Any]
let teamIdentifier = info?[kSecCodeInfoTeamIdentifier as String] as? String
let identifier = info?[kSecCodeInfoIdentifier as String] as? String

if let expectedTeamId, teamIdentifier != expectedTeamId {
    emit(
        VerificationResult(
            ok: false,
            teamIdentifier: teamIdentifier,
            identifier: identifier,
            error: "code signature team identifier mismatch"
        ),
        exitCode: 1
    )
}

emit(
    VerificationResult(
        ok: true,
        teamIdentifier: teamIdentifier,
        identifier: identifier,
        error: nil
    ),
    exitCode: 0
)
