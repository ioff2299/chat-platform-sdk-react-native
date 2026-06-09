package com.chatplatform.sdk

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ChatSdkDownloaderModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private val executor = Executors.newCachedThreadPool()
    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .build()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // RN требует наличия этих методов для NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // RN требует наличия этих методов для NativeEventEmitter
    }

    @ReactMethod
    fun download(request: ReadableMap, promise: Promise) {
        val url = request.getString("url")
        val filename = sanitize(request.getString("filename") ?: "file")
        val mime = request.getString("mime") ?: "application/octet-stream"
        if (url.isNullOrEmpty()) {
            promise.reject("INVALID_URL", "URL не задан")
            return
        }
        val headers: ReadableMap? = if (request.hasKey("headers")) request.getMap("headers") else null
        val id = UUID.randomUUID().toString()

        executor.execute {
            try {
                val builder = Request.Builder().url(url).get()
                headers?.toHashMap()?.forEach { (k, v) ->
                    if (v is String) builder.header(k, v)
                }
                val response = client.newCall(builder.build()).execute()
                if (!response.isSuccessful) {
                    response.close()
                    promise.reject("HTTP_${response.code}", "Ошибка загрузки: HTTP ${response.code}")
                    return@execute
                }

                val body = response.body
                if (body == null) {
                    response.close()
                    promise.reject("EMPTY_BODY", "Пустой ответ сервера")
                    return@execute
                }

                val total = body.contentLength()
                val context = reactApplicationContext
                val savedUri: Uri = body.byteStream().use { stream ->
                    saveToDownloads(context, stream, filename, mime, total, id)
                }
                response.close()

                postCompletionNotification(context, filename, mime, savedUri)

                val result: WritableMap = Arguments.createMap()
                result.putString("id", id)
                result.putString("uri", savedUri.toString())
                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("DOWNLOAD_FAILED", e.message ?: "Не удалось скачать файл", e)
            }
        }
    }

    private fun saveToDownloads(
        context: Context,
        input: InputStream,
        filename: String,
        mime: String,
        total: Long,
        id: String,
    ): Uri {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            saveViaMediaStore(context, input, filename, mime, total, id)
        } else {
            saveToExternalFiles(context, input, filename, total, id)
        }
    }

    private fun saveViaMediaStore(
        context: Context,
        input: InputStream,
        filename: String,
        mime: String,
        total: Long,
        id: String,
    ): Uri {
        val resolver = context.contentResolver
        val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = resolver.insert(collection, values)
            ?: throw IllegalStateException("Не удалось создать запись в MediaStore")

        resolver.openOutputStream(uri).use { output ->
            if (output == null) throw IllegalStateException("Не удалось открыть OutputStream")
            copyWithProgress(input, output, total, id)
        }

        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        return uri
    }

    private fun saveToExternalFiles(
        context: Context,
        input: InputStream,
        filename: String,
        total: Long,
        id: String,
    ): Uri {
        val dir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: File(context.filesDir, "downloads").apply { mkdirs() }
        if (!dir.exists()) dir.mkdirs()
        val target = File(dir, filename)
        FileOutputStream(target).use { output -> copyWithProgress(input, output, total, id) }
        val authority = "${context.packageName}.chatsdk.fileprovider"
        return FileProvider.getUriForFile(context, authority, target)
    }

    private fun copyWithProgress(input: InputStream, output: java.io.OutputStream, total: Long, id: String) {
        val buffer = ByteArray(64 * 1024)
        var written = 0L
        var lastEmit = 0L
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            output.write(buffer, 0, read)
            written += read
            val now = System.currentTimeMillis()
            if (now - lastEmit >= 100) {
                emitProgress(id, written, total)
                lastEmit = now
            }
        }
        output.flush()
        emitProgress(id, written, if (total > 0) total else written)
    }

    private fun emitProgress(id: String, written: Long, total: Long) {
        val map: WritableMap = Arguments.createMap()
        map.putString("id", id)
        map.putDouble("bytesWritten", written.toDouble())
        map.putDouble("totalBytes", total.toDouble())
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("ChatSdkDownloadProgress", map)
    }

    private fun postCompletionNotification(context: Context, filename: String, mime: String, uri: Uri) {
        ensureChannel(context)
        val openIntent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, mime)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val pi = PendingIntent.getActivity(
            context,
            uri.hashCode(),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download_done)
            .setContentTitle(filename)
            .setContentText("Загрузка завершена")
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(uri.hashCode(), notification)
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Загрузки",
            NotificationManager.IMPORTANCE_LOW,
        )
        manager.createNotificationChannel(channel)
    }

    private fun sanitize(name: String): String {
        val cleaned = name.replace(Regex("[/\\\\?%*:|\"<>]"), "_").trim()
        return if (cleaned.isEmpty()) "file" else cleaned
    }

    companion object {
        const val NAME = "ChatSdkDownloader"
        private const val CHANNEL_ID = "chat_sdk_downloads"
    }
}
