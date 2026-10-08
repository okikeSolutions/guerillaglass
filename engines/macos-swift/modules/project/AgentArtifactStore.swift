import CryptoKit
import Darwin
import Foundation

/// Descriptor-anchored, atomic storage for the latest project-bound Agent Mode run.
public struct AgentArtifactStore {
    public static let references: [AgentArtifactReference] = [
        .init(kind: .transcriptFullV1, path: "analysis/\(ProjectFile.transcriptFullV1JSON)"),
        .init(kind: .transcriptWordsV1, path: "analysis/\(ProjectFile.transcriptWordsV1JSON)"),
        .init(kind: .beatMapV1, path: "analysis/\(ProjectFile.beatMapV1JSON)"),
        .init(kind: .qaReportV1, path: "analysis/\(ProjectFile.qaReportV1JSON)"),
        .init(kind: .cutPlanV1, path: "analysis/\(ProjectFile.cutPlanV1JSON)"),
        .init(kind: .runSummaryV1, path: "analysis/\(ProjectFile.runSummaryV1JSON)"),
    ]

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        encoder.dateEncodingStrategy = .iso8601
        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
    }

    /// Writes a complete generation off to the side and atomically swaps it into `analysis/`.
    /// A failed write leaves the previous generation intact.
    @discardableResult
    public func write(
        plannedRun: ImportedTranscriptAgentPlanner.Result,
        summary candidate: AgentRunSummaryArtifact,
        projectURL: URL
    ) throws -> AgentRunSummaryArtifact {
        let projectFD = try openDirectory(path: projectURL.path)
        defer { Darwin.close(projectFD) }
        let stagingName = ".agent-analysis-staging-\(UUID().uuidString)"
        guard Darwin.mkdirat(projectFD, stagingName, 0o700) == 0 else {
            throw AgentArtifactError.unsafeArtifactPath
        }
        var stagingInstalled = false
        defer {
            if !stagingInstalled {
                removeCanonicalGeneration(named: stagingName, projectFD: projectFD)
            }
        }
        let stagingFD = try openDirectory(at: projectFD, name: stagingName)
        defer { Darwin.close(stagingFD) }

        let artifacts: [(AgentArtifactKind, String, any Encodable)] = [
            (.transcriptFullV1, ProjectFile.transcriptFullV1JSON, plannedRun.transcript),
            (.transcriptWordsV1, ProjectFile.transcriptWordsV1JSON, plannedRun.transcript),
            (.beatMapV1, ProjectFile.beatMapV1JSON, plannedRun.beatMap),
            (.qaReportV1, ProjectFile.qaReportV1JSON, plannedRun.qaReport),
            (.cutPlanV1, ProjectFile.cutPlanV1JSON, plannedRun.cutPlan),
        ]
        var references: [AgentArtifactReference] = []
        for (kind, fileName, artifact) in artifacts {
            let data = try encoder.encode(artifact)
            try write(data, named: fileName, directoryFD: stagingFD)
            references.append(.init(
                kind: kind,
                path: "analysis/\(fileName)",
                sha256: digest(data)
            ))
        }
        references.append(Self.references[5])
        var summary = candidate
        summary.artifacts = references
        // The digest-bound manifest is committed last inside the staged generation.
        try write(encoder.encode(summary), named: ProjectFile.runSummaryV1JSON, directoryFD: stagingFD)
        guard Darwin.fsync(stagingFD) == 0 else { throw AgentArtifactError.unsafeArtifactPath }

        let analysisExists = try directoryExists(at: projectFD, name: ProjectFile.analysisDirectory)
        let installStatus = if analysisExists {
            Darwin.renameatx_np(
                projectFD,
                stagingName,
                projectFD,
                ProjectFile.analysisDirectory,
                UInt32(RENAME_SWAP)
            )
        } else {
            Darwin.renameat(projectFD, stagingName, projectFD, ProjectFile.analysisDirectory)
        }
        guard installStatus == 0 else { throw AgentArtifactError.unsafeArtifactPath }
        stagingInstalled = true
        if Darwin.fsync(projectFD) != 0 {
            let rollbackStatus = if analysisExists {
                Darwin.renameatx_np(
                    projectFD,
                    stagingName,
                    projectFD,
                    ProjectFile.analysisDirectory,
                    UInt32(RENAME_SWAP)
                )
            } else {
                Darwin.renameat(projectFD, ProjectFile.analysisDirectory, projectFD, stagingName)
            }
            _ = Darwin.fsync(projectFD)
            guard rollbackStatus == 0 else { throw AgentArtifactError.unsafeArtifactPath }
            stagingInstalled = false
            throw AgentArtifactError.unsafeArtifactPath
        }
        if analysisExists {
            // After RENAME_SWAP, the prior generation is descriptor-anchored at stagingName.
            removeCanonicalGeneration(named: stagingName, projectFD: projectFD)
        }
        return summary
    }

    /// Hides a destination package's prior generation so Save As can restore it on failure.
    public func quarantineLatest(projectURL: URL) throws -> String? {
        var metadata = stat()
        let status = projectURL.path.withCString { Darwin.lstat($0, &metadata) }
        if status != 0, errno == ENOENT {
            return nil
        }
        guard status == 0 else { throw AgentArtifactError.unsafeArtifactPath }
        let projectFD = try openDirectory(path: projectURL.path)
        defer { Darwin.close(projectFD) }
        guard try directoryExists(at: projectFD, name: ProjectFile.analysisDirectory) else { return nil }
        let tombstone = ".agent-analysis-quarantine-\(UUID().uuidString)"
        guard Darwin.renameat(
            projectFD,
            ProjectFile.analysisDirectory,
            projectFD,
            tombstone
        ) == 0 else { throw AgentArtifactError.unsafeArtifactPath }
        guard Darwin.fsync(projectFD) == 0 else {
            _ = Darwin.renameat(projectFD, tombstone, projectFD, ProjectFile.analysisDirectory)
            throw AgentArtifactError.unsafeArtifactPath
        }
        return tombstone
    }

    public func restoreQuarantined(_ name: String, projectURL: URL) throws {
        let projectFD = try openDirectory(path: projectURL.path)
        defer { Darwin.close(projectFD) }
        guard Darwin.renameat(projectFD, name, projectFD, ProjectFile.analysisDirectory) == 0,
              Darwin.fsync(projectFD) == 0
        else { throw AgentArtifactError.unsafeArtifactPath }
    }

    public func discardQuarantined(_ name: String, projectURL: URL) {
        guard let projectFD = try? openDirectory(path: projectURL.path) else { return }
        defer { Darwin.close(projectFD) }
        removeCanonicalGeneration(named: name, projectFD: projectFD)
    }

    public func loadLatest(projectURL: URL, projectId: UUID) throws -> AgentRunSummaryArtifact? {
        let projectFD = try openDirectory(path: projectURL.path)
        defer { Darwin.close(projectFD) }
        guard try directoryExists(at: projectFD, name: ProjectFile.analysisDirectory) else { return nil }
        let analysisFD = try openDirectory(at: projectFD, name: ProjectFile.analysisDirectory)
        defer { Darwin.close(analysisFD) }
        guard try fileExists(at: analysisFD, name: ProjectFile.runSummaryV1JSON) else { return nil }

        let summaryData = try readData(named: ProjectFile.runSummaryV1JSON, directoryFD: analysisFD)
        let summary = try decoder.decode(AgentRunSummaryArtifact.self, from: summaryData)
        guard summary.version == 1, summary.projectId == projectId, !summary.jobId.isEmpty,
              summary.recordingFileName == ProjectFile.recordingMov,
              summary.artifacts.count == Self.references.count,
              zip(summary.artifacts, Self.references).allSatisfy({ actual, expected in
                  actual.kind == expected.kind && actual.path == expected.path
              }),
              summary.artifacts.dropLast().allSatisfy({ $0.sha256?.count == 64 }),
              summary.artifacts.last?.sha256 == nil
        else { throw AgentArtifactError.invalidRunSummary }

        var verifiedData: [String: Data] = [:]
        for reference in summary.artifacts.dropLast() {
            guard let fileName = reference.path.split(separator: "/").last.map(String.init) else {
                throw AgentArtifactError.invalidRunSummary
            }
            let data = try readData(named: fileName, directoryFD: analysisFD)
            guard digest(data) == reference.sha256 else { throw AgentArtifactError.invalidRunSummary }
            verifiedData[fileName] = data
        }

        func decode<T: Decodable>(_ type: T.Type, named name: String) throws -> T {
            guard let data = verifiedData[name] else { throw AgentArtifactError.invalidRunSummary }
            return try decoder.decode(type, from: data)
        }
        let transcriptFull = try decode(AgentTranscriptArtifact.self, named: ProjectFile.transcriptFullV1JSON)
        let transcriptWords = try decode(AgentTranscriptArtifact.self, named: ProjectFile.transcriptWordsV1JSON)
        let beatMap = try decode(AgentBeatMapArtifact.self, named: ProjectFile.beatMapV1JSON)
        let qaReport = try decode(AgentQAReport.self, named: ProjectFile.qaReportV1JSON)
        let cutPlan = try decode(AgentCutPlanArtifact.self, named: ProjectFile.cutPlanV1JSON)
        guard transcriptFull == transcriptWords,
              qaReport == summary.qaReport,
              cutPlan == summary.cutPlan
        else { throw AgentArtifactError.invalidRunSummary }
        if summary.qaReport.passed {
            guard beatMap.anchors.map(\.beat) == cutPlan.segments.map(\.beat) else {
                throw AgentArtifactError.invalidRunSummary
            }
            _ = try summary.cutPlan.validated()
        } else if !cutPlan.segments.isEmpty {
            throw AgentArtifactError.invalidRunSummary
        }
        return summary
    }

    private func openDirectory(path: String) throws -> Int32 {
        guard path.hasPrefix("/") else { throw AgentArtifactError.unsafeArtifactPath }
        var directoryFD = Darwin.open("/", O_RDONLY | O_DIRECTORY)
        guard directoryFD >= 0 else { throw AgentArtifactError.unsafeArtifactPath }
        for component in path.split(separator: "/").map(String.init) {
            let nextFD = component.withCString {
                Darwin.openat(directoryFD, $0, O_RDONLY | O_DIRECTORY | O_NOFOLLOW)
            }
            Darwin.close(directoryFD)
            guard nextFD >= 0 else { throw AgentArtifactError.unsafeArtifactPath }
            directoryFD = nextFD
        }
        return directoryFD
    }

    private func openDirectory(at parentFD: Int32, name: String) throws -> Int32 {
        let descriptor = name.withCString { Darwin.openat(parentFD, $0, O_RDONLY | O_DIRECTORY | O_NOFOLLOW) }
        guard descriptor >= 0 else { throw AgentArtifactError.unsafeArtifactPath }
        return descriptor
    }

    private func directoryExists(at parentFD: Int32, name: String) throws -> Bool {
        let descriptor = name.withCString { Darwin.openat(parentFD, $0, O_RDONLY | O_DIRECTORY | O_NOFOLLOW) }
        if descriptor >= 0 {
            Darwin.close(descriptor)
            return true
        }
        guard errno == ENOENT else { throw AgentArtifactError.unsafeArtifactPath }
        return false
    }

    private func fileExists(at directoryFD: Int32, name: String) throws -> Bool {
        let descriptor = name.withCString { Darwin.openat(directoryFD, $0, O_RDONLY | O_NOFOLLOW) }
        if descriptor >= 0 {
            Darwin.close(descriptor)
            return true
        }
        guard errno == ENOENT else { throw AgentArtifactError.unsafeArtifactPath }
        return false
    }

    private func write(_ data: Data, named name: String, directoryFD: Int32) throws {
        let descriptor = name.withCString {
            Darwin.openat(directoryFD, $0, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o600)
        }
        guard descriptor >= 0 else { throw AgentArtifactError.unsafeArtifactPath }
        defer { Darwin.close(descriptor) }
        try data.withUnsafeBytes { rawBuffer in
            guard let base = rawBuffer.baseAddress else { return }
            var offset = 0
            while offset < rawBuffer.count {
                let count = Darwin.write(descriptor, base.advanced(by: offset), rawBuffer.count - offset)
                guard count > 0 else { throw AgentArtifactError.unsafeArtifactPath }
                offset += count
            }
        }
        guard Darwin.fsync(descriptor) == 0 else { throw AgentArtifactError.unsafeArtifactPath }
    }

    private func readData(named name: String, directoryFD: Int32) throws -> Data {
        let descriptor = name.withCString { Darwin.openat(directoryFD, $0, O_RDONLY | O_NOFOLLOW) }
        guard descriptor >= 0 else { throw AgentArtifactError.invalidRunSummary }
        let handle = FileHandle(fileDescriptor: descriptor, closeOnDealloc: true)
        var metadata = stat()
        guard Darwin.fstat(descriptor, &metadata) == 0,
              metadata.st_mode & S_IFMT == S_IFREG,
              metadata.st_size >= 0,
              metadata.st_size <= 50 * 1024 * 1024
        else { throw AgentArtifactError.invalidRunSummary }
        let expectedSize = Int(metadata.st_size)
        let data = try handle.read(upToCount: expectedSize + 1) ?? Data()
        guard data.count == expectedSize else { throw AgentArtifactError.invalidRunSummary }
        return data
    }

    private func removeCanonicalGeneration(named name: String, projectFD: Int32) {
        guard let directoryFD = try? openDirectory(at: projectFD, name: name) else { return }
        for reference in Self.references {
            let fileName = reference.path.split(separator: "/").last.map(String.init)!
            _ = fileName.withCString { Darwin.unlinkat(directoryFD, $0, 0) }
        }
        Darwin.close(directoryFD)
        _ = name.withCString { Darwin.unlinkat(projectFD, $0, AT_REMOVEDIR) }
    }

    private func digest(_ data: Data) -> String {
        SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }
}
