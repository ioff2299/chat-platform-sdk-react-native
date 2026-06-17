import Foundation
import UIKit
import React

@objc(ChatSdkImageCompressor)
class ChatSdkImageCompressor: NSObject {

    @objc static func requiresMainQueueSetup() -> Bool { return false }

    @objc(compress:resolver:rejecter:)
    func compress(_ options: NSDictionary,
                  resolver resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
        let uriString = (options["uri"] as? String) ?? ""
        let maxSize = CGFloat((options["maxSize"] as? NSNumber)?.doubleValue ?? 1600)
        let qualityRaw = (options["quality"] as? NSNumber)?.doubleValue ?? 0.7
        let quality = CGFloat(min(1.0, max(0.1, qualityRaw)))

        DispatchQueue.global(qos: .userInitiated).async {
            guard let url = Self.resolveURL(uriString) else {
                reject("BAD_URI", "Некорректный URI изображения: \(uriString)", nil)
                return
            }
            guard let data = try? Data(contentsOf: url), let image = UIImage(data: data) else {
                reject("DECODE_FAILED", "Не удалось декодировать изображение", nil)
                return
            }

            let resized = Self.resize(image, maxSize: maxSize)
            guard let jpeg = resized.jpegData(compressionQuality: quality) else {
                reject("ENCODE_FAILED", "Не удалось сжать изображение", nil)
                return
            }

            do {
                let target = try Self.writeTemp(jpeg)
                let result: [String: Any] = [
                    "uri": target.absoluteString,
                    "mime": "image/jpeg",
                    "size": NSNumber(value: jpeg.count),
                    "width": NSNumber(value: Double(resized.size.width)),
                    "height": NSNumber(value: Double(resized.size.height)),
                ]
                resolve(result)
            } catch {
                reject("WRITE_FAILED", error.localizedDescription, error)
            }
        }
    }

    private static func resolveURL(_ s: String) -> URL? {
        if s.hasPrefix("file://") || s.hasPrefix("http://") || s.hasPrefix("https://") {
            return URL(string: s)
        }
        if s.hasPrefix("/") { return URL(fileURLWithPath: s) }
        return URL(string: s)
    }

    private static func resize(_ image: UIImage, maxSize: CGFloat) -> UIImage {
        let w = image.size.width
        let h = image.size.height
        let longest = max(w, h)
        let scale: CGFloat = (maxSize > 0 && longest > maxSize) ? maxSize / longest : 1
        let newSize = CGSize(width: floor(w * scale), height: floor(h * scale))

        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let renderer = UIGraphicsImageRenderer(size: newSize, format: format)
        return renderer.image { _ in
            image.draw(in: CGRect(origin: .zero, size: newSize))
        }
    }

    private static func writeTemp(_ data: Data) throws -> URL {
        let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = cache.appendingPathComponent("chat-sdk-compressed", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let target = dir.appendingPathComponent("\(UUID().uuidString).jpg")
        try data.write(to: target, options: .atomic)
        return target
    }
}