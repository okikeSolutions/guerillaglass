import Darwin
import Foundation

/// Darwin exposes a conflicting `flock` record type in current Swift toolchains.
@_silgen_name("flock")
private func projectFlock(_ descriptor: Int32, _ operation: Int32) -> Int32

/// Exclusive ownership of a project directory, released automatically with its descriptor.
public final class ProjectLease {
    public let url: URL
    private let descriptor: Int32

    public enum LeaseError: LocalizedError {
        case unsafePath
        case busy

        public var errorDescription: String? {
            switch self {
            case .unsafePath: "Cannot safely open the project directory."
            case .busy: "project_busy: another engine owns this project. Save and close the desktop application before handing it to an agent."
            }
        }
    }

    /// Traverses directory descriptors without following symlinks and acquires a nonblocking lease.
    public init(url: URL) throws {
        guard url.isFileURL, url.path.hasPrefix("/"), url.path != "/" else { throw LeaseError.unsafePath }
        var directory = Darwin.open("/", O_RDONLY | O_DIRECTORY | O_CLOEXEC)
        guard directory >= 0 else { throw LeaseError.unsafePath }
        do {
            for component in url.path.split(separator: "/").map(String.init) {
                guard component != ".", component != ".." else { throw LeaseError.unsafePath }
                var next = Darwin.openat(directory, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                if next < 0, errno == ENOENT {
                    guard Darwin.mkdirat(directory, component, 0o700) == 0 || errno == EEXIST else {
                        throw LeaseError.unsafePath
                    }
                    next = Darwin.openat(directory, component, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                }
                guard next >= 0 else { throw LeaseError.unsafePath }
                Darwin.close(directory)
                directory = next
            }
            guard projectFlock(directory, LOCK_EX | LOCK_NB) == 0 else { throw LeaseError.busy }
        } catch {
            Darwin.close(directory)
            throw error
        }
        self.url = url
        descriptor = directory
    }

    deinit { Darwin.close(descriptor) }
}
