import AppKit
import Darwin
import Foundation

let arguments = CommandLine.arguments
guard arguments.count == 3 || arguments.count == 5 else {
    FileHandle.standardError.write(Data("Usage: swift macos_app_process.swift {pid|ready|stop|wait} <app-bundle> [pid launch-time]\n".utf8))
    exit(2)
}

let bundleURL = URL(fileURLWithPath: arguments[2]).standardizedFileURL
let applications = NSWorkspace.shared.runningApplications.filter {
    $0.bundleURL?.standardizedFileURL == bundleURL && !$0.isTerminated
}

func processStartTime(_ processID: pid_t) -> Double? {
    var info = proc_bsdinfo()
    guard proc_pidinfo(processID, PROC_PIDTBSDINFO, 0, &info, Int32(MemoryLayout<proc_bsdinfo>.size)) == MemoryLayout<proc_bsdinfo>.size else {
        return nil
    }
    return Double(info.pbi_start_tvsec) + Double(info.pbi_start_tvusec) / 1_000_000
}

switch arguments[1] {
case "pid" where arguments.count == 3, "ready" where arguments.count == 3:
    if applications.isEmpty {
        print("null")
        exit(0)
    }
    guard applications.count == 1, let application = applications.first, let launchTime = processStartTime(application.processIdentifier) else {
        FileHandle.standardError.write(Data("Expected one running instance of \(bundleURL.path), found \(applications.count)\n".utf8))
        exit(1)
    }
    // Electrobun initially registers the launcher, then transfers its NSApplication
    // to Bun. Only that final host identity can own the app's full lifetime.
    if arguments[1] == "ready", application.executableURL?.lastPathComponent != "bun" {
        print("null")
        exit(0)
    }
    print("{\"pid\":\(application.processIdentifier),\"launchTime\":\(launchTime)}")
case "stop" where arguments.count == 5, "wait" where arguments.count == 5:
    guard let processID = pid_t(arguments[3]), processID > 1, let launchTime = Double(arguments[4]) else { exit(2) }
    // Never signal an unrelated process after PID reuse, or another app instance.
    while let application = NSRunningApplication(processIdentifier: processID), !application.isTerminated {
        guard application.bundleURL?.standardizedFileURL == bundleURL,
              processStartTime(processID) == launchTime else { exit(0) }
        if arguments[1] == "wait" {
            RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.1))
            continue
        }
        guard kill(processID, SIGTERM) == 0 || errno == ESRCH else {
            FileHandle.standardError.write(Data("Unable to stop app process: \(String(cString: strerror(errno)))\n".utf8))
            exit(1)
        }
        break
    }
default:
    exit(2)
}
