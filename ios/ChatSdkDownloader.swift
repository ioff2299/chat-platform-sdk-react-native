import Foundation
import UIKit
import React

@objc(ChatSdkDownloader)
class ChatSdkDownloader: RCTEventEmitter {

    private var listenerCount: Int = 0
    private var sessions: [String: URLSessionDownloadTask] = [:]

    override init() {
        super.init()
    }

    @objc override static func requiresMainQueueSetup() -> Bool { return false }
    override func supportedEvents() -> [String]! { return ["ChatSdkDownloadProgress"] }
    override func startObserving() { listenerCount += 1 }
    override func stopObserving() { listenerCount = max(0, listenerCount - 1) }

    @objc(download:resolver:rejecter:)
    func download(_ request: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let urlString = request["url"] as? String, let url = URL(string: urlString) else {
            reject("INVALID_URL", "URL не задан", nil)
            return
        }
        let filename = sanitize((request["filename"] as? String) ?? "file")
        let mime = (request["mime"] as? String) ?? "application/octet-stream"
        let headers = (request["headers"] as? [String: String]) ?? [:]
        let id = UUID().uuidString

        var req = URLRequest(url: url)
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }

        let delegate = DownloadDelegate(id: id, filename: filename, mime: mime, owner: self) { result in
            switch result {
            case .success(let targetUrl):
                resolve(["id": id, "uri": targetUrl.absoluteString])
            case .failure(let error):
                reject("DOWNLOAD_FAILED", error.localizedDescription, error)
            }
            self.sessions.removeValue(forKey: id)
        }
        let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
        let task = session.downloadTask(with: req)
        sessions[id] = task
        task.resume()
    }

    fileprivate func emitProgress(id: String, written: Int64, total: Int64) {
        guard listenerCount > 0 else { return }
        sendEvent(withName: "ChatSdkDownloadProgress", body: [
            "id": id,
            "bytesWritten": NSNumber(value: written),
            "totalBytes": NSNumber(value: total),
        ])
    }

    fileprivate func presentShareSheet(for url: URL) {
        DispatchQueue.main.async {
            guard let root = Self.topViewController() else { return }
            let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            if let pop = activity.popoverPresentationController {
                pop.sourceView = root.view
                pop.sourceRect = CGRect(x: root.view.bounds.midX, y: root.view.bounds.midY, width: 0, height: 0)
                pop.permittedArrowDirections = []
            }
            root.present(activity, animated: true)
        }
    }

    private func sanitize(_ name: String) -> String {
        let invalid = CharacterSet(charactersIn: "/\\?%*:|\"<>")
        let cleaned = name.components(separatedBy: invalid).joined(separator: "_")
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "file" : trimmed
    }

    private static func topViewController() -> UIViewController? {
        for scene in UIApplication.shared.connectedScenes {
            if let windowScene = scene as? UIWindowScene {
                for window in windowScene.windows where window.isKeyWindow {
                    var top = window.rootViewController
                    while let presented = top?.presentedViewController { top = presented }
                    return top
                }
            }
        }
        return nil
    }
}

private final class DownloadDelegate: NSObject, URLSessionDownloadDelegate {
    enum DownloadResult { case success(URL); case failure(Error) }

    let id: String
    let filename: String
    let mime: String
    weak var owner: ChatSdkDownloader?
    let completion: (DownloadResult) -> Void

    init(id: String, filename: String, mime: String, owner: ChatSdkDownloader, completion: @escaping (DownloadResult) -> Void) {
        self.id = id
        self.filename = filename
        self.mime = mime
        self.owner = owner
        self.completion = completion
    }

    func urlSession(_ session: URLSession,
                    downloadTask: URLSessionDownloadTask,
                    didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64,
                    totalBytesExpectedToWrite: Int64) {
        owner?.emitProgress(id: id, written: totalBytesWritten, total: totalBytesExpectedToWrite)
    }

    func urlSession(_ session: URLSession,
                    downloadTask: URLSessionDownloadTask,
                    didFinishDownloadingTo location: URL) {
        do {
            let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            let dir = cache.appendingPathComponent("chat-sdk-downloads", isDirectory: true)
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let target = dir.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: target.path) {
                try FileManager.default.removeItem(at: target)
            }
            try FileManager.default.moveItem(at: location, to: target)
            owner?.presentShareSheet(for: target)
            completion(.success(target))
        } catch {
            completion(.failure(error))
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        if let error = error { completion(.failure(error)) }
    }
}
