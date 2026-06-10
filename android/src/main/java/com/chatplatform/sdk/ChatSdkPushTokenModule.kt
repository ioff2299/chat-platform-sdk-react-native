package com.chatplatform.sdk

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.firebase.messaging.FirebaseMessaging

class ChatSdkPushTokenModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun getToken(promise: Promise) {
        try {
            FirebaseMessaging.getInstance().token
                .addOnCompleteListener { task ->
                    if (task.isSuccessful) {
                        val token = task.result
                        if (token.isNullOrEmpty()) {
                            promise.reject("PUSH_TOKEN_EMPTY", "FCM вернул пустой токен")
                        } else {
                            promise.resolve(token)
                        }
                    } else {
                        val ex = task.exception
                        promise.reject(
                            "PUSH_TOKEN_ERROR",
                            ex?.localizedMessage ?: "Не удалось получить FCM-токен",
                            ex,
                        )
                    }
                }
        } catch (e: Throwable) {
            promise.reject(
                "PUSH_TOKEN_UNAVAILABLE",
                "Firebase не инициализирован. Нужен google-services.json в приложении " +
                    "и плагин com.google.gms.google-services. (${e.localizedMessage})",
                e,
            )
        }
    }

    companion object {
        const val NAME = "ChatSdkPushToken"
    }
}