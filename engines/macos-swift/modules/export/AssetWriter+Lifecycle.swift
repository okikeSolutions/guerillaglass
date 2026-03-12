import AVFoundation
import Foundation

extension AssetWriter {
    func finishSynchronously(completion: @escaping (Result<URL, Error>) -> Void) {
        guard !isFinishing else { return }
        isFinishing = true

        if writer.status == .unknown {
            completion(.failure(AssetWriterError.writerFailed(nil)))
            return
        }

        videoInput?.markAsFinished()
        audioInput?.markAsFinished()

        writer.finishWriting {
            if self.writer.status == .completed {
                completion(.success(self.outputURL))
            } else {
                completion(.failure(AssetWriterError.writerFailed(self.writer.error)))
            }
        }
    }
}
