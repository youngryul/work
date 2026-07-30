package com.youngryul.potatobuddy.data.repo

import com.youngryul.potatobuddy.data.auth.SessionStore
import com.youngryul.potatobuddy.data.model.DiaryItem
import com.youngryul.potatobuddy.data.remote.SupabaseClient
import com.youngryul.potatobuddy.data.remote.jsonString
import com.youngryul.potatobuddy.data.remote.jsonObjectOf
import kotlinx.serialization.builtins.ListSerializer
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter

class DiaryRepository(
    private val client: SupabaseClient,
    private val sessionStore: SessionStore,
) {
    private val dateFmt = DateTimeFormatter.ISO_LOCAL_DATE

    suspend fun fetchDiaries(year: Int, month: Int): List<DiaryItem> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).format(dateFmt)
        val end = ym.atEndOfMonth().format(dateFmt)
        val raw = client.get(
            "diaries",
            mapOf(
                "user_id" to "eq.${sessionStore.userId}",
                "and" to "(date.gte.$start,date.lte.$end)",
                "select" to "id,date,content,image_url,emotion",
                "order" to "date.desc",
            ),
        )
        return client.json.decodeFromString(ListSerializer(DiaryItem.serializer()), raw)
    }

    suspend fun fetchDiary(date: String): DiaryItem? {
        val raw = client.get(
            "diaries",
            mapOf(
                "user_id" to "eq.${sessionStore.userId}",
                "date" to "eq.$date",
                "select" to "id,date,content,image_url,emotion",
            ),
        )
        return client.json.decodeFromString(ListSerializer(DiaryItem.serializer()), raw).firstOrNull()
    }

    suspend fun saveDiary(date: String, content: String): DiaryItem {
        val now = java.time.OffsetDateTime.now().toString()
        val body = jsonObjectOf(
            "date" to jsonString(date),
            "content" to jsonString(content),
            "user_id" to jsonString(sessionStore.userId),
            "updated_at" to jsonString(now),
        ).toString()
        val raw = client.post(
            "diaries",
            body,
            prefer = "resolution=merge-duplicates,return=representation",
        )
        return client.json.decodeFromString(ListSerializer(DiaryItem.serializer()), raw).first()
    }

    fun todayKey(): String = LocalDate.now().format(dateFmt)
}
