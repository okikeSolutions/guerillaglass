import CryptoKit
import EngineProtocol
import Export
import Foundation
import Project

extension EngineService {
    enum EditSessionError: Error {
        case revisionConflict
        case savedProjectRequired
    }

    /// Reads a stable saved-project snapshot after inspecting the active source.
    func reviewSavedEdit() async throws -> Components.Schemas.EditReview {
        guard let projectURL = currentProjectURL, let recordingURL = availableAgentRecordingURL(),
              let context = agentProjectContext(recordingURL: recordingURL), !hasUnsavedProjectChanges
        else { throw EditSessionError.savedProjectRequired }
        let document = currentProjectDocument
        let saved = try projectStore.loadProject(at: projectURL)
        guard try editDocumentData(saved.document) == editDocumentData(document) else { throw EditSessionError.savedProjectRequired }
        let source = try await agentSource(recordingURL: recordingURL)
        guard matchesAgentProjectContext(context), currentProjectDocument == document,
              !hasUnsavedProjectChanges,
              try editDocumentData(projectStore.loadProject(at: projectURL).document) == editDocumentData(document)
        else { throw EditSessionError.revisionConflict }
        return try makeEditReview(source: source)
    }

    private func editDocumentData(_ document: ProjectDocument) throws -> Data {
        var editable = document
        // Analysis artifacts are committed independently of the saved editing state.
        editable.project.agentAnalysis = nil
        return try ProjectStore.makeDefaultEncoder().encode(editable)
    }

    private func makeEditReview(source: AgentSource) throws -> Components.Schemas.EditReview {
        var data = try editDocumentData(currentProjectDocument)
        data.append(contentsOf: source.revision.utf8)
        let revision = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
        return .init(
            revision: revision,
            sourceRevision: source.revision,
            sourceDurationSeconds: source.duration,
            sourceFps: .init(numerator: source.fps.numerator, denominator: source.fps.denominator),
            project: projectState()
        )
    }

    private func validateEdit(_ payload: Components.Schemas.EditPlan) async throws -> Components.Schemas.EditReview {
        let review = try await reviewSavedEdit()
        guard payload.baseRevision == review.revision, payload.sourceRevision == review.sourceRevision else {
            throw EditSessionError.revisionConflict
        }
        let plan = try JSONDecoder().decode(EditPlan.self, from: JSONEncoder().encode(payload))
        try plan.validate(sourceDuration: review.sourceDurationSeconds)
        return review
    }

    func edit_period_review(_: Operations.edit_period_review.Input) async throws -> Operations.edit_period_review.Output {
        do {
            return try await .ok(.init(body: .json(reviewSavedEdit())))
        } catch is CancellationError {
            throw CancellationError()
        } catch is EditSessionError {
            return .conflict(.init(body: .json(conflict(.project_mismatch, "Close competing editors and save/reopen the project before reviewing it."))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, error.localizedDescription))))
        }
    }

    func edit_period_validate(_ input: Operations.edit_period_validate.Input) async throws -> Operations.edit_period_validate.Output {
        let payload: Components.Schemas.EditPlan = switch input.body { case let .json(body): body }
        do {
            return try await .ok(.init(body: .json(validateEdit(payload))))
        } catch is CancellationError {
            throw CancellationError()
        } catch is EditSessionError {
            return .conflict(.init(body: .json(conflict(.project_mismatch, "The plan does not match the saved project revision and source. Review and rebase the plan."))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "Invalid edit plan or unavailable source."))))
        }
    }

    func edit_period_apply(_ input: Operations.edit_period_apply.Input) async throws -> Operations.edit_period_apply.Output {
        let payload: Components.Schemas.EditPlan = switch input.body { case let .json(body): body }
        do {
            let review = try await validateEdit(payload)
            let plan = try JSONDecoder().decode(EditPlan.self, from: JSONEncoder().encode(payload))
            guard let projectURL = currentProjectURL else { throw EditSessionError.savedProjectRequired }
            var document = currentProjectDocument
            document.project.timeline = plan.timeline
            currentProjectDocument = try projectStore.writeProject(document: document, assets: .init(), to: projectURL)
            hasUnsavedProjectChanges = false
            return try .ok(.init(body: .json(makeEditReview(source: .init(
                duration: review.sourceDurationSeconds,
                fps: .init(numerator: review.sourceFps.numerator, denominator: review.sourceFps.denominator),
                revision: review.sourceRevision
            )))))
        } catch is CancellationError {
            throw CancellationError()
        } catch is EditSessionError {
            return .conflict(.init(body: .json(conflict(.project_mismatch, "The plan is stale or the project is not saved. Review and rebase before applying."))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, "The edit could not be validated or saved."))))
        }
    }

    func edit_period_exportProject(_ input: Operations.edit_period_exportProject.Input) async throws -> Operations.edit_period_exportProject.Output {
        let payload: Components.Schemas.EditExportRequest = switch input.body { case let .json(body): body }
        do {
            let review = try await reviewSavedEdit()
            guard review.revision == payload.expectedRevision else { throw EditSessionError.revisionConflict }
            guard let preset = Presets.all.first(where: { $0.id == payload.presetId }),
                  let recordingURL = availableAgentRecordingURL()
            else { throw EditPlan.ValidationError.invalidPlan }
            let document = currentProjectDocument
            guard let projectURL = currentProjectURL,
                  !URL(fileURLWithPath: payload.outputURL).standardizedFileURL.path.hasPrefix(projectURL.standardizedFileURL.path + "/"),
                  URL(fileURLWithPath: payload.outputURL).standardizedFileURL != projectURL.standardizedFileURL
            else { throw EditPlan.ValidationError.invalidPlan }
            let cameraEvents = try availableCameraEvents(for: document.project.autoZoom)
            // Empty legacy timelines mean the complete source. Explicitly materialize that meaning.
            let timeline = document.project.timeline.items.isEmpty
                ? TimelineDocument.singleSegment(recordingDuration: review.sourceDurationSeconds)
                : document.project.timeline
            let snapshot = try await makeAgentRecordingSnapshot(recordingURL: recordingURL, expectedRevision: review.sourceRevision)
            defer { try? FileManager.default.removeItem(at: snapshot.deletingLastPathComponent()) }
            let output = try await exportPipeline.export(
                recordingURL: snapshot, preset: preset, trimRange: nil,
                outputURL: URL(fileURLWithPath: payload.outputURL),
                cameraEvents: cameraEvents,
                autoZoomSettings: document.project.autoZoom,
                captureMetadata: document.project.captureMetadata,
                timeline: exportTimeline(from: timeline),
                backgroundFraming: document.project.backgroundFraming
            )
            return .ok(.init(body: .json(.init(jobId: "edit-export-\(UUID().uuidString)", status: .succeeded, outputURL: output.path))))
        } catch is CancellationError {
            throw CancellationError()
        } catch is EditSessionError {
            return .conflict(.init(body: .json(conflict(.project_mismatch, "The requested saved revision is no longer current."))))
        } catch {
            return .badRequest(.init(body: .json(badRequest(.invalid_params, error.localizedDescription))))
        }
    }
}
