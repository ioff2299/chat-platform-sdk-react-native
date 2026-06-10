package com.chatplatform.sdk

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Проигрывает аудио-вложения (голосовые сообщения) прямо в чате.
 * В каждый момент времени активен ровно один плеер — запуск нового
 * освобождает предыдущий. Состояние отдаётся в JS событием
 * "ChatSdkAudioState" { key, positionMillis, durationMillis, state }.
 */
class ChatSdkAudioPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME
    
    private val thread = HandlerThread("ChatSdkAudioPlayer").apply { start() }
    private val handler = Handler(thread.looper)

    private var player: MediaPlayer? = null
    private var currentKey: String? = null
    private var prepared = false

    private val tick = object : Runnable {
        override fun run() {
            val p = player ?: return
            try {
                if (p.isPlaying) {
                    emit(currentKey, p.currentPosition.toLong(), safeDuration(p), "playing")
                    handler.postDelayed(this, 250)
                }
            } catch (_: Throwable) {
                // плеер уже освобождён — просто перестаём тикать
            }
        }
    }

    @ReactMethod
    fun addListener(eventName: String) {

    }

    @ReactMethod
    fun removeListeners(count: Int) {
     
    }

    @ReactMethod
    fun play(key: String, url: String, headers: ReadableMap?, promise: Promise) {
        val hdr = HashMap<String, String>()
        headers?.toHashMap()?.forEach { (k, v) -> if (v is String) hdr[k] = v }

        handler.post {
            try {
                val existing = player
                if (currentKey == key && existing != null && prepared) {
                    existing.start()
                    emit(key, existing.currentPosition.toLong(), safeDuration(existing), "playing")
                    handler.removeCallbacks(tick)
                    handler.post(tick)
                    promise.resolve(null)
                    return@post
                }

                releaseInternal()
                currentKey = key
                prepared = false
                emit(key, 0, 0, "loading")

                val mp = MediaPlayer()
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                if (hdr.isEmpty()) {
                    mp.setDataSource(reactApplicationContext, Uri.parse(url))
                } else {
                    mp.setDataSource(reactApplicationContext, Uri.parse(url), hdr)
                }
                mp.setOnPreparedListener { p ->
                    if (currentKey != key) return@setOnPreparedListener
                    prepared = true
                    p.start()
                    emit(key, 0, safeDuration(p), "playing")
                    handler.removeCallbacks(tick)
                    handler.post(tick)
                }
                mp.setOnCompletionListener { p ->
                    handler.removeCallbacks(tick)
                    emit(key, safeDuration(p), safeDuration(p), "ended")
                }
                mp.setOnErrorListener { _, _, _ ->
                    handler.removeCallbacks(tick)
                    emit(key, 0, 0, "error")
                    releaseInternal()
                    true
                }
                player = mp
                mp.prepareAsync()
                promise.resolve(null)
            } catch (e: Throwable) {
                emit(key, 0, 0, "error")
                releaseInternal()
                promise.reject("AUDIO_PLAY_FAILED", e.message ?: "Не удалось воспроизвести аудио", e)
            }
        }
    }

    @ReactMethod
    fun pause(key: String, promise: Promise) {
        handler.post {
            try {
                val p = player
                if (currentKey == key && p != null && prepared && p.isPlaying) {
                    p.pause()
                    handler.removeCallbacks(tick)
                    emit(key, p.currentPosition.toLong(), safeDuration(p), "paused")
                }
                promise.resolve(null)
            } catch (e: Throwable) {
                promise.reject("AUDIO_PAUSE_FAILED", e.message ?: "Ошибка паузы", e)
            }
        }
    }

    @ReactMethod
    fun seek(key: String, positionMillis: Double, promise: Promise) {
        handler.post {
            try {
                val p = player
                if (currentKey == key && p != null && prepared) {
                    p.seekTo(positionMillis.toInt())
                    val state = if (p.isPlaying) "playing" else "paused"
                    emit(key, positionMillis.toLong(), safeDuration(p), state)
                }
                promise.resolve(null)
            } catch (e: Throwable) {
                promise.reject("AUDIO_SEEK_FAILED", e.message ?: "Ошибка перемотки", e)
            }
        }
    }

    @ReactMethod
    fun stop(key: String, promise: Promise) {
        handler.post {
            try {
                if (currentKey == key) {
                    handler.removeCallbacks(tick)
                    releaseInternal()
                    emit(key, 0, 0, "stopped")
                }
                promise.resolve(null)
            } catch (e: Throwable) {
                promise.reject("AUDIO_STOP_FAILED", e.message ?: "Ошибка остановки", e)
            }
        }
    }

    private fun releaseInternal() {
        try { player?.reset() } catch (_: Throwable) {}
        try { player?.release() } catch (_: Throwable) {}
        player = null
        prepared = false
    }

    private fun safeDuration(p: MediaPlayer): Long =
        try {
            val d = p.duration
            if (d > 0) d.toLong() else 0L
        } catch (_: Throwable) {
            0L
        }

    private fun emit(key: String?, position: Long, duration: Long, state: String) {
        val map: WritableMap = Arguments.createMap()
        map.putString("key", key ?: "")
        map.putDouble("positionMillis", position.toDouble())
        map.putDouble("durationMillis", duration.toDouble())
        map.putString("state", state)
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("ChatSdkAudioState", map)
    }

    companion object {
        const val NAME = "ChatSdkAudioPlayer"
    }
}