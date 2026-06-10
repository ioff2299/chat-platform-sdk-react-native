import Foundation
import AVFoundation
import React
@objc(ChatSdkAudioPlayer)
class ChatSdkAudioPlayer: RCTEventEmitter {

    private var player: AVPlayer?
    private var observedItem: AVPlayerItem?
    private var timeObserver: Any?
    private var endObserver: NSObjectProtocol?
    private var currentKey: String?
    private var durationMillis: Double = 0
    private var listenerCount = 0

    @objc override static func requiresMainQueueSetup() -> Bool { return false }
    override func supportedEvents() -> [String]! { return ["ChatSdkAudioState"] }
    override func startObserving() { listenerCount += 1 }
    override func stopObserving() { listenerCount = max(0, listenerCount - 1) }

    @objc(play:url:headers:resolver:rejecter:)
    func play(_ key: String,
              url urlString: String,
              headers: NSDictionary?,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if self.currentKey == key, let p = self.player {
                self.activateSession()
                p.play()
                self.emit(key: key, position: self.currentPositionMillis(), duration: self.durationMillis, state: "playing")
                resolve(nil)
                return
            }

            guard let url = URL(string: urlString) else {
                reject("INVALID_URL", "URL не задан", nil)
                return
            }

            self.teardown()
            self.currentKey = key
            self.emit(key: key, position: 0, duration: 0, state: "loading")

            var options: [String: Any] = [:]
            if let h = headers as? [String: String], !h.isEmpty {
                options["AVURLAssetHTTPHeaderFieldsKey"] = h
            }
            let asset = AVURLAsset(url: url, options: options)
            let item = AVPlayerItem(asset: asset)
            let p = AVPlayer(playerItem: item)
            self.player = p
            self.observedItem = item

            self.activateSession()

            item.addObserver(self, forKeyPath: "status", options: [.new], context: nil)

            let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
            self.timeObserver = p.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
                guard let self = self, self.currentKey == key else { return }
                if p.timeControlStatus == .playing {
                    let pos = CMTimeGetSeconds(time) * 1000
                    self.emit(key: key, position: pos.isFinite ? pos : 0, duration: self.durationMillis, state: "playing")
                }
            }

            self.endObserver = NotificationCenter.default.addObserver(
                forName: .AVPlayerItemDidPlayToEndTime,
                object: item,
                queue: .main,
            ) { [weak self] _ in
                guard let self = self, self.currentKey == key else { return }
                self.emit(key: key, position: self.durationMillis, duration: self.durationMillis, state: "ended")
                p.seek(to: .zero)
            }

            p.play()
            resolve(nil)
        }
    }

    @objc(pause:resolver:rejecter:)
    func pause(_ key: String,
               resolver resolve: @escaping RCTPromiseResolveBlock,
               rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if self.currentKey == key, let p = self.player {
                p.pause()
                self.emit(key: key, position: self.currentPositionMillis(), duration: self.durationMillis, state: "paused")
            }
            resolve(nil)
        }
    }

    @objc(seek:positionMillis:resolver:rejecter:)
    func seek(_ key: String,
              positionMillis: NSNumber,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            guard self.currentKey == key, let p = self.player else {
                resolve(nil)
                return
            }
            let seconds = positionMillis.doubleValue / 1000
            let target = CMTime(seconds: seconds, preferredTimescale: 600)
            p.seek(to: target) { [weak self] _ in
                guard let self = self, self.currentKey == key else { return }
                let state = p.timeControlStatus == .playing ? "playing" : "paused"
                self.emit(key: key, position: positionMillis.doubleValue, duration: self.durationMillis, state: state)
            }
            resolve(nil)
        }
    }

    @objc(stop:resolver:rejecter:)
    func stop(_ key: String,
              resolver resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            if self.currentKey == key {
                self.teardown()
                self.deactivateSession()
                self.emit(key: key, position: 0, duration: 0, state: "stopped")
            }
            resolve(nil)
        }
    }

    override func observeValue(forKeyPath keyPath: String?,
                              of object: Any?,
                              change: [NSKeyValueChangeKey: Any]?,
                              context: UnsafeMutableRawPointer?) {
        guard keyPath == "status", let item = object as? AVPlayerItem, item === observedItem else { return }
        switch item.status {
        case .readyToPlay:
            let dur = CMTimeGetSeconds(item.duration) * 1000
            durationMillis = (dur.isFinite && dur > 0) ? dur : 0
            emit(key: currentKey, position: currentPositionMillis(), duration: durationMillis, state: "playing")
        case .failed:
            emit(key: currentKey, position: 0, duration: 0, state: "error")
            teardown()
        default:
            break
        }
    }

    private func currentPositionMillis() -> Double {
        guard let p = player else { return 0 }
        let s = CMTimeGetSeconds(p.currentTime())
        return s.isFinite ? s * 1000 : 0
    }

    private func teardown() {
        if let obs = timeObserver { player?.removeTimeObserver(obs); timeObserver = nil }
        if let end = endObserver { NotificationCenter.default.removeObserver(end); endObserver = nil }
        if let item = observedItem { item.removeObserver(self, forKeyPath: "status"); observedItem = nil }
        player?.pause()
        player = nil
        durationMillis = 0
    }

    private func activateSession() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
        
        }
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func emit(key: String?, position: Double, duration: Double, state: String) {
        guard listenerCount > 0 else { return }
        sendEvent(withName: "ChatSdkAudioState", body: [
            "key": key ?? "",
            "positionMillis": NSNumber(value: position),
            "durationMillis": NSNumber(value: duration),
            "state": state,
        ])
    }

    override func invalidate() {
        DispatchQueue.main.async {
            self.teardown()
            self.deactivateSession()
        }
        super.invalidate()
    }
}