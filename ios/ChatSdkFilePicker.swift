import Foundation
import UIKit
import MobileCoreServices
import UniformTypeIdentifiers

@objc(ChatSdkFilePicker)
class ChatSdkFilePicker: NSObject {

    private var pendingResolve: RCTPromiseResolveBlock?
    private var pendingReject: RCTPromiseRejectBlock?
    private var holder: PickerHolder?

    @objc static func requiresMainQueueSetup() -> Bool { return true }

    @objc(pick:resolver:rejecter:)
    func pick(_ options: NSDictionary,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        if pendingResolve != nil {
            reject("ALREADY_PICKING", "Пикер файлов уже открыт", nil)
            return
        }

        let multiple = (options["multiple"] as? Bool) ?? false
        let mimeFilter = (options["mimeFilter"] as? [String]) ?? []

        DispatchQueue.main.async {
            guard let root = Self.topViewController() else {
                reject("NO_VIEW_CONTROLLER", "Нет корневого view controller", nil)
                return
            }

            self.pendingResolve = resolve
            self.pendingReject = reject

            let picker: UIDocumentPickerViewController
            if #available(iOS 14.0, *) {
                let types = Self.contentTypes(from: mimeFilter)
                picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
            } else {
                let types = mimeFilter.isEmpty ? [String(kUTTypeItem)] : mimeFilter
                picker = UIDocumentPickerViewController(documentTypes: types, in: .import)
            }
            picker.allowsMultipleSelection = multiple

            let holder = PickerHolder(owner: self)
            self.holder = holder
            picker.delegate = holder
            root.present(picker, animated: true)
        }
    }

    fileprivate func finishCancelled() {
        let resolve = pendingResolve
        pendingResolve = nil
        pendingReject = nil
        holder = nil
        resolve?(NSNull())
    }

    fileprivate func finishSuccess(urls: [URL]) {
        let resolve = pendingResolve
        let reject = pendingReject
        pendingResolve = nil
        pendingReject = nil
        holder = nil

        do {
            let items = try urls.map { try Self.copyAndDescribe($0) }
            resolve?(items)
        } catch {
            reject?("PICKER_ERROR", error.localizedDescription, error)
        }
    }

    @available(iOS 14.0, *)
    private static func contentTypes(from mimeFilter: [String]) -> [UTType] {
        if mimeFilter.isEmpty { return [.item] }
        let types = mimeFilter.compactMap { UTType(mimeType: $0) }
        return types.isEmpty ? [.item] : types
    }

    private static func copyAndDescribe(_ url: URL) throws -> [String: Any] {
        let needsScope = url.startAccessingSecurityScopedResource()
        defer { if needsScope { url.stopAccessingSecurityScopedResource() } }

        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = cache.appendingPathComponent("chat-sdk-picker", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)

        let safeName = sanitize(url.lastPathComponent)
        let target = dir.appendingPathComponent("\(UUID().uuidString)_\(safeName)")
        if FileManager.default.fileExists(atPath: target.path) {
            try FileManager.default.removeItem(at: target)
        }
        try FileManager.default.copyItem(at: url, to: target)

        let attrs = try FileManager.default.attributesOfItem(atPath: target.path)
        let size = (attrs[.size] as? NSNumber)?.int64Value ?? 0

        return [
            "uri": target.absoluteString,
            "name": safeName,
            "mime": mimeType(for: url.pathExtension),
            "size": NSNumber(value: size),
        ]
    }

    private static func sanitize(_ name: String) -> String {
        let invalid = CharacterSet(charactersIn: "/\\?%*:|\"<>")
        let cleaned = name.components(separatedBy: invalid).joined(separator: "_")
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "file" : trimmed
    }

    private static func mimeType(for ext: String) -> String {
        if ext.isEmpty { return "application/octet-stream" }
        if #available(iOS 14.0, *) {
            if let t = UTType(filenameExtension: ext), let m = t.preferredMIMEType {
                return m
            }
            return "application/octet-stream"
        }
        let tagClass = kUTTagClassFilenameExtension
        guard
            let uti = UTTypeCreatePreferredIdentifierForTag(tagClass, ext as CFString, nil)?.takeRetainedValue(),
            let mime = UTTypeCopyPreferredTagWithClass(uti, kUTTagClassMIMEType)?.takeRetainedValue() as String?
        else { return "application/octet-stream" }
        return mime
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes
        for scene in scenes {
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

private final class PickerHolder: NSObject, UIDocumentPickerDelegate {
    weak var owner: ChatSdkFilePicker?

    init(owner: ChatSdkFilePicker) {
        self.owner = owner
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        owner?.finishSuccess(urls: urls)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        owner?.finishCancelled()
    }
}
