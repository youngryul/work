package com.youngryul.potatobuddy.data.auth

import com.youngryul.potatobuddy.data.remote.SupabaseClient
import com.youngryul.potatobuddy.data.remote.SupabaseException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed class AuthError : Exception() {
    data object InvalidCredentials : AuthError() {
        private fun readResolve(): Any = InvalidCredentials
        override val message: String = "이메일 또는 비밀번호가 올바르지 않습니다."
    }

    data object NeedsEmailConfirmation : AuthError() {
        private fun readResolve(): Any = NeedsEmailConfirmation
        override val message: String = "가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요."
    }

    class Custom(override val message: String) : AuthError()
}

class AuthRepository(
    private val client: SupabaseClient,
    private val sessionStore: SessionStore,
) {
    private val _isLoggedIn = MutableStateFlow(sessionStore.isLoggedIn)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    fun currentUserId(): String = sessionStore.userId

    suspend fun signIn(email: String, password: String) {
        try {
            val response = client.authPassword(email.trim(), password)
            sessionStore.saveSession(response.accessToken, response.refreshToken, response.user.id)
            _isLoggedIn.value = true
        } catch (e: SupabaseException) {
            throw AuthError.Custom(e.message ?: "로그인에 실패했습니다.")
        }
    }

    suspend fun signUp(email: String, password: String) {
        try {
            client.authSignUp(email.trim(), password)
            throw AuthError.NeedsEmailConfirmation
        } catch (e: AuthError.NeedsEmailConfirmation) {
            throw e
        } catch (e: SupabaseException) {
            throw AuthError.Custom(e.message ?: "회원가입에 실패했습니다.")
        }
    }

    suspend fun refreshIfPossible(): Boolean {
        val refresh = sessionStore.refreshToken
        if (refresh.isBlank()) return sessionStore.isLoggedIn
        return try {
            val response = client.authRefresh(refresh)
            sessionStore.saveSession(response.accessToken, response.refreshToken, response.user.id)
            _isLoggedIn.value = true
            true
        } catch (_: Exception) {
            signOut()
            false
        }
    }

    fun signOut() {
        sessionStore.clear()
        _isLoggedIn.value = false
    }
}
