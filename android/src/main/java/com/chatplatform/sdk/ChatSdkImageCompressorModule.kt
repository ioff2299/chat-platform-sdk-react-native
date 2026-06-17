package com.chatplatform.sdk

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

class ChatSdkImageCompressorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun compress(options: ReadableMap, promise: Promise) {
        Thread {
            try {
                val uriStr = if (options.hasKey("uri")) options.getString("uri") else null
                if (uriStr.isNullOrEmpty()) {
                    promise.reject("BAD_URI", "Пустой URI изображения")
                    return@Thread
                }
                val maxSize = if (options.hasKey("maxSize")) options.getInt("maxSize") else 1600
                val quality = if (options.hasKey("quality")) options.getDouble("quality") else 0.7
                val qPct = (quality.coerceIn(0.1, 1.0) * 100).roundToInt()

                val context = reactApplicationContext
                val uri = Uri.parse(uriStr)

                val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                openStream(context, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
                val srcW = bounds.outWidth
                val srcH = bounds.outHeight
                if (srcW <= 0 || srcH <= 0) {
                    promise.reject("DECODE_FAILED", "Не удалось прочитать изображение")
                    return@Thread
                }

                val decodeOpts = BitmapFactory.Options().apply {
                    inSampleSize = computeSampleSize(srcW, srcH, maxSize)
                }
                var bitmap = openStream(context, uri).use {
                    BitmapFactory.decodeStream(it, null, decodeOpts)
                } ?: run {
                    promise.reject("DECODE_FAILED", "Не удалось декодировать изображение")
                    return@Thread
                }

                bitmap = applyExifRotation(context, uri, bitmap)
                bitmap = scaleToMax(bitmap, maxSize)

                val targetDir = File(context.cacheDir, "chat-sdk-compressed").apply { mkdirs() }
                val target = File(targetDir, "${UUID.randomUUID()}.jpg")
                FileOutputStream(target).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, qPct, out)
                }
                val outW = bitmap.width
                val outH = bitmap.height
                bitmap.recycle()

                val map = Arguments.createMap().apply {
                    putString("uri", Uri.fromFile(target).toString())
                    putString("mime", "image/jpeg")
                    putDouble("size", target.length().toDouble())
                    putDouble("width", outW.toDouble())
                    putDouble("height", outH.toDouble())
                }
                promise.resolve(map)
            } catch (e: Throwable) {
                promise.reject("COMPRESS_FAILED", e.message ?: "Ошибка сжатия изображения", e)
            }
        }.start()
    }

    private fun openStream(context: Context, uri: Uri): InputStream {
        val scheme = uri.scheme
        return if (scheme == null || scheme == "file") {
            File(requireNotNull(uri.path) { "Нет пути в URI: $uri" }).inputStream()
        } else {
            requireNotNull(context.contentResolver.openInputStream(uri)) {
                "Не удалось открыть поток для $uri"
            }
        }
    }

    private fun computeSampleSize(w: Int, h: Int, maxSize: Int): Int {
        if (maxSize <= 0) return 1
        var sample = 1
        val half = max(w, h) / 2
        while (half / sample >= maxSize) sample *= 2
        return sample
    }

    private fun scaleToMax(bitmap: Bitmap, maxSize: Int): Bitmap {
        if (maxSize <= 0) return bitmap
        val longest = max(bitmap.width, bitmap.height)
        if (longest <= maxSize) return bitmap
        val scale = maxSize.toFloat() / longest
        val nw = (bitmap.width * scale).roundToInt().coerceAtLeast(1)
        val nh = (bitmap.height * scale).roundToInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(bitmap, nw, nh, true)
        if (scaled != bitmap) bitmap.recycle()
        return scaled
    }

    private fun applyExifRotation(context: Context, uri: Uri, bitmap: Bitmap): Bitmap {
        return try {
            val orientation = openStream(context, uri).use {
                ExifInterface(it).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            }
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
                else -> return bitmap
            }
            val rotated = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (rotated != bitmap) bitmap.recycle()
            rotated
        } catch (e: Throwable) {
            bitmap
        }
    }

    companion object {
        const val NAME = "ChatSdkImageCompressor"
    }
}