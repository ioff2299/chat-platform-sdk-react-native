package com.chatplatform.sdk

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableNativeArray
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class ChatSdkFilePickerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    private var pendingPromise: Promise? = null

    private val activityEventListener = object : BaseActivityEventListener() {
        override fun onActivityResult(
            activity: Activity,
            requestCode: Int,
            resultCode: Int,
            data: Intent?,
        ) {
            if (requestCode != REQUEST_CODE) return
            val promise = pendingPromise ?: return
            pendingPromise = null

            if (resultCode != Activity.RESULT_OK || data == null) {
                promise.resolve(null)
                return
            }

            try {
                val context = reactApplicationContext
                val uris = collectUris(data)
                if (uris.isEmpty()) {
                    promise.resolve(null)
                    return
                }
                val result: WritableArray = WritableNativeArray()
                for (uri in uris) {
                    val copy = copyToCache(context, uri) ?: continue
                    val map = Arguments.createMap()
                    map.putString("uri", Uri.fromFile(copy.file).toString())
                    map.putString("name", copy.name)
                    map.putString("mime", copy.mime)
                    map.putDouble("size", copy.size.toDouble())
                    result.pushMap(map)
                }
                promise.resolve(result)
            } catch (e: Throwable) {
                promise.reject("PICKER_ERROR", e.message ?: "Не удалось обработать выбор файлов", e)
            }
        }
    }

    init {
        reactContext.addActivityEventListener(activityEventListener)
    }

    @ReactMethod
    fun pick(options: ReadableMap, promise: Promise) {
        val activity = getCurrentActivity()
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Нет активной Activity")
            return
        }
        if (pendingPromise != null) {
            promise.reject("ALREADY_PICKING", "Пикер файлов уже открыт")
            return
        }

        val multiple = if (options.hasKey("multiple")) options.getBoolean("multiple") else false
        val mimeFilter: Array<String> = readMimeFilter(options)

        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
            type = if (mimeFilter.size == 1) mimeFilter[0] else "*/*"
            if (mimeFilter.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeFilter)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        pendingPromise = promise
        try {
            activity.startActivityForResult(intent, REQUEST_CODE)
        } catch (e: Throwable) {
            pendingPromise = null
            promise.reject("PICKER_LAUNCH_FAILED", e.message ?: "Не удалось открыть пикер", e)
        }
    }

    private fun readMimeFilter(options: ReadableMap): Array<String> {
        if (!options.hasKey("mimeFilter")) return arrayOf("*/*")
        val arr: ReadableArray = options.getArray("mimeFilter") ?: return arrayOf("*/*")
        if (arr.size() == 0) return arrayOf("*/*")
        return Array(arr.size()) { i -> arr.getString(i) ?: "*/*" }
    }

    private fun collectUris(data: Intent): List<Uri> {
        val clip = data.clipData
        if (clip != null && clip.itemCount > 0) {
            return (0 until clip.itemCount).mapNotNull { clip.getItemAt(it).uri }
        }
        return listOfNotNull(data.data)
    }

    private data class CachedFile(val file: File, val name: String, val mime: String, val size: Long)

    private fun copyToCache(context: Context, uri: Uri): CachedFile? {
        val resolver = context.contentResolver
        val (name, declaredSize) = queryNameAndSize(resolver, uri)
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val safeName = sanitize(name)
        val targetDir = File(context.cacheDir, "chat-sdk-picker").apply { mkdirs() }
        val target = File(targetDir, "${UUID.randomUUID()}_$safeName")

        resolver.openInputStream(uri).use { input ->
            if (input == null) return null
            FileOutputStream(target).use { output -> input.copyTo(output) }
        }

        val size = if (declaredSize > 0) declaredSize else target.length()
        return CachedFile(target, safeName, mime, size)
    }

    private fun queryNameAndSize(resolver: android.content.ContentResolver, uri: Uri): Pair<String, Long> {
        var name = "file"
        var size = 0L
        val cursor: Cursor? = resolver.query(uri, null, null, null, null)
        cursor?.use { c ->
            if (c.moveToFirst()) {
                val nameIdx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIdx = c.getColumnIndex(OpenableColumns.SIZE)
                if (nameIdx >= 0 && !c.isNull(nameIdx)) name = c.getString(nameIdx) ?: name
                if (sizeIdx >= 0 && !c.isNull(sizeIdx)) size = c.getLong(sizeIdx)
            }
        }
        return name to size
    }

    private fun sanitize(name: String): String {
        val cleaned = name.replace(Regex("[/\\\\?%*:|\"<>]"), "_").trim()
        return if (cleaned.isEmpty()) "file" else cleaned
    }

    companion object {
        const val NAME = "ChatSdkFilePicker"
        private const val REQUEST_CODE = 0x6C1C
    }
}
