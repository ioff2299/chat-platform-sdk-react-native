import Foundation
import UIKit
import UserNotifications
import ObjectiveC

@objc(ChatSdkPushToken)
class ChatSdkPushToken: NSObject {

    private static let lock = NSLock()
    private static var resolvers: [RCTPromiseResolveBlock] = []
    private static var rejecters: [RCTPromiseRejectBlock] = []
    private static var didSwizzle = false

    private static var originalDidRegister: IMP?
    private static var originalDidFail: IMP?

    @objc static func requiresMainQueueSetup() -> Bool { return true }

    @objc(getToken:rejecter:)
    func getToken(_ resolve: @escaping RCTPromiseResolveBlock,
                  rejecter reject: @escaping RCTPromiseRejectBlock) {
        Self.lock.lock()
        Self.resolvers.append(resolve)
        Self.rejecters.append(reject)
        Self.lock.unlock()

        DispatchQueue.main.async {
            Self.ensureSwizzled()
            UNUserNotificationCenter.current().requestAuthorization(
                options: [.alert, .badge, .sound]
            ) { _, _ in
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }

    fileprivate static func deliver(token deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02x", $0) }.joined()
        lock.lock()
        let pending = resolvers
        resolvers.removeAll()
        rejecters.removeAll()
        lock.unlock()
        pending.forEach { $0(token) }
    }

    fileprivate static func deliver(error: Error) {
        lock.lock()
        let pending = rejecters
        resolvers.removeAll()
        rejecters.removeAll()
        lock.unlock()
        pending.forEach { $0("PUSH_TOKEN_ERROR", error.localizedDescription, error) }
    }

    private static func ensureSwizzled() {
        if didSwizzle { return }
        guard let delegate = UIApplication.shared.delegate else { return }
        let cls: AnyClass = type(of: delegate)
        swizzleDidRegister(cls)
        swizzleDidFail(cls)
        didSwizzle = true
    }

    private static func swizzleDidRegister(_ cls: AnyClass) {
        let selector = #selector(
            UIApplicationDelegate.application(_:didRegisterForRemoteNotificationsWithDeviceToken:)
        )
        let block: @convention(block) (AnyObject, UIApplication, Data) -> Void = { receiver, app, data in
            ChatSdkPushToken.deliver(token: data)
            if let original = originalDidRegister {
                typealias Fn = @convention(c) (AnyObject, Selector, UIApplication, Data) -> Void
                unsafeBitCast(original, to: Fn.self)(receiver, selector, app, data)
            }
        }
        let newImp = imp_implementationWithBlock(block)
        if let method = class_getInstanceMethod(cls, selector) {
            originalDidRegister = method_getImplementation(method)
            method_setImplementation(method, newImp)
        } else {
            class_addMethod(cls, selector, newImp, "v@:@@")
        }
    }

    private static func swizzleDidFail(_ cls: AnyClass) {
        let selector = #selector(
            UIApplicationDelegate.application(_:didFailToRegisterForRemoteNotificationsWithError:)
        )
        let block: @convention(block) (AnyObject, UIApplication, Error) -> Void = { receiver, app, error in
            ChatSdkPushToken.deliver(error: error)
            if let original = originalDidFail {
                typealias Fn = @convention(c) (AnyObject, Selector, UIApplication, Error) -> Void
                unsafeBitCast(original, to: Fn.self)(receiver, selector, app, error)
            }
        }
        let newImp = imp_implementationWithBlock(block)
        if let method = class_getInstanceMethod(cls, selector) {
            originalDidFail = method_getImplementation(method)
            method_setImplementation(method, newImp)
        } else {
            class_addMethod(cls, selector, newImp, "v@:@@")
        }
    }
}