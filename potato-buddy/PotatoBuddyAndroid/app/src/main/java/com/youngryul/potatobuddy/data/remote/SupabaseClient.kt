package com.youngryul.potatobuddy.data.remote

import com.youngryul.potatobuddy.BuildConfig
import com.youngryul.potatobuddy.data.auth.SessionStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class SupabaseClient(
    private val sessionStore: SessionStore,
) {
    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMedia = "application/json; charset=utf-8".toMediaType()

    suspend fun authPassword(email: String, password: String): AuthTokenResponse =
        withContext(Dispatchers.IO) {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
            }.toString()
            val request = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=password")
                .post(body.toRequestBody(jsonMedia))
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .build()
            executeAuth(request)
        }

    suspend fun authRefresh(refreshToken: String): AuthTokenResponse =
        withContext(Dispatchers.IO) {
            val body = buildJsonObject {
                put("refresh_token", refreshToken)
            }.toString()
            val request = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token")
                .post(body.toRequestBody(jsonMedia))
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .build()
            executeAuth(request)
        }

    suspend fun authSignUp(email: String, password: String) =
        withContext(Dispatchers.IO) {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
                put(
                    "options",
                    buildJsonObject {
                        put("emailRedirectTo", BuildConfig.WEBSITE_URL)
                    },
                )
            }.toString()
            val request = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL}/auth/v1/signup")
                .post(body.toRequestBody(jsonMedia))
                .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .header("Content-Type", "application/json")
                .build()
            client.newCall(request).execute().use { response ->
                val raw = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw SupabaseException(parseErrorMessage(raw) ?: "회원가입에 실패했습니다.")
                }
            }
        }

    suspend fun get(
        path: String,
        query: Map<String, String> = emptyMap(),
    ): String = rest("GET", path, query, null)

    suspend fun post(
        path: String,
        jsonBody: String,
        prefer: String = "return=minimal",
    ): String = rest("POST", path, emptyMap(), jsonBody, prefer)

    suspend fun patch(
        path: String,
        query: Map<String, String>,
        jsonBody: String,
        prefer: String = "return=minimal",
    ): String = rest("PATCH", path, query, jsonBody, prefer)

    suspend fun delete(
        path: String,
        query: Map<String, String>,
    ): String = rest("DELETE", path, query, null, "return=minimal")

    private suspend fun rest(
        method: String,
        path: String,
        query: Map<String, String>,
        jsonBody: String?,
        prefer: String? = null,
    ): String = withContext(Dispatchers.IO) {
        val token = sessionStore.accessToken
        if (token.isBlank()) throw SupabaseException("로그인이 필요합니다.")

        val urlBuilder = "${BuildConfig.SUPABASE_URL}/rest/v1/$path".toHttpUrl().newBuilder()
        query.forEach { (k, v) -> urlBuilder.addQueryParameter(k, v) }

        val builder = Request.Builder()
            .url(urlBuilder.build())
            .header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .header("Authorization", "Bearer $token")
            .header("Content-Type", "application/json")
        if (prefer != null) builder.header("Prefer", prefer)

        when (method) {
            "GET" -> builder.get()
            "POST" -> builder.post((jsonBody ?: "{}").toRequestBody(jsonMedia))
            "PATCH" -> builder.patch((jsonBody ?: "{}").toRequestBody(jsonMedia))
            "DELETE" -> builder.delete()
            else -> error("unsupported method $method")
        }

        client.newCall(builder.build()).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw SupabaseException(parseErrorMessage(raw) ?: "HTTP ${response.code}")
            }
            raw
        }
    }

    private fun executeAuth(request: Request): AuthTokenResponse {
        client.newCall(request).execute().use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                throw SupabaseException(
                    parseErrorMessage(raw) ?: "이메일 또는 비밀번호가 올바르지 않습니다.",
                )
            }
            return json.decodeFromString(AuthTokenResponse.serializer(), raw)
        }
    }

    private fun parseErrorMessage(raw: String): String? {
        return try {
            val obj = json.parseToJsonElement(raw).jsonObject
            obj["msg"]?.jsonPrimitive?.contentOrNull
                ?: obj["message"]?.jsonPrimitive?.contentOrNull
                ?: obj["error_description"]?.jsonPrimitive?.contentOrNull
        } catch (_: Exception) {
            null
        }
    }
}

@kotlinx.serialization.Serializable
data class AuthTokenResponse(
    @kotlinx.serialization.SerialName("access_token") val accessToken: String,
    @kotlinx.serialization.SerialName("refresh_token") val refreshToken: String? = null,
    val user: AuthUser,
)

@kotlinx.serialization.Serializable
data class AuthUser(
    val id: String,
)

class SupabaseException(message: String) : Exception(message)

fun jsonObjectOf(vararg pairs: Pair<String, JsonElement>): JsonObject =
    JsonObject(pairs.toMap())

fun jsonString(value: String): JsonPrimitive = JsonPrimitive(value)
fun jsonBool(value: Boolean): JsonPrimitive = JsonPrimitive(value)
fun jsonLong(value: Long): JsonPrimitive = JsonPrimitive(value)
fun jsonInt(value: Int): JsonPrimitive = JsonPrimitive(value)
