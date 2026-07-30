package com.youngryul.potatobuddy.data.auth

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SessionStore(context: Context) {
    private val prefs = try {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "pb_secure_session",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    } catch (_: Exception) {
        // 일부 기기/에뮬레이터에서 EncryptedSharedPreferences 초기화 실패 시 폴백
        context.getSharedPreferences("pb_session_fallback", Context.MODE_PRIVATE)
    }

    var accessToken: String
        get() = prefs.getString(KEY_ACCESS, "") ?: ""
        set(value) = prefs.edit().putString(KEY_ACCESS, value).apply()

    var refreshToken: String
        get() = prefs.getString(KEY_REFRESH, "") ?: ""
        set(value) = prefs.edit().putString(KEY_REFRESH, value).apply()

    var userId: String
        get() = prefs.getString(KEY_USER, "") ?: ""
        set(value) = prefs.edit().putString(KEY_USER, value).apply()

    val isLoggedIn: Boolean
        get() = accessToken.isNotBlank() && userId.isNotBlank()

    fun saveSession(accessToken: String, refreshToken: String?, userId: String) {
        this.accessToken = accessToken
        this.userId = userId
        if (!refreshToken.isNullOrBlank()) {
            this.refreshToken = refreshToken
        }
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_ACCESS = "pb_accessToken"
        private const val KEY_REFRESH = "pb_refreshToken"
        private const val KEY_USER = "pb_userId"
    }
}
