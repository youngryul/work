package com.youngryul.potatobuddy.data.repo

import com.youngryul.potatobuddy.data.auth.SessionStore
import com.youngryul.potatobuddy.data.model.ScheduleItem
import com.youngryul.potatobuddy.data.remote.SupabaseClient
import com.youngryul.potatobuddy.data.remote.jsonObjectOf
import com.youngryul.potatobuddy.data.remote.jsonString
import kotlinx.serialization.builtins.ListSerializer
import java.time.YearMonth
import java.time.format.DateTimeFormatter

class ScheduleRepository(
    private val client: SupabaseClient,
    private val sessionStore: SessionStore,
) {
    private val dateFmt = DateTimeFormatter.ISO_LOCAL_DATE

    suspend fun fetchSchedules(year: Int, month: Int): List<ScheduleItem> {
        val ym = YearMonth.of(year, month)
        val start = ym.atDay(1).format(dateFmt)
        val end = ym.atEndOfMonth().format(dateFmt)
        val userId = sessionStore.userId

        return try {
            val raw = client.get(
                "schedule_calendar_events",
                mapOf(
                    "user_id" to "eq.$userId",
                    "schedule_date" to "lte.$end",
                    "select" to "id,schedule_date,end_date,title,tag,repeat_type",
                    "order" to "schedule_date.asc,created_at.asc",
                ),
            )
            client.json.decodeFromString(ListSerializer(ScheduleItem.serializer()), raw)
                .filter { item ->
                    val itemEnd = item.endDate?.takeIf { it.isNotBlank() } ?: item.scheduleDate
                    itemEnd >= start
                }
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun forDate(all: List<ScheduleItem>, date: String): List<ScheduleItem> =
        all.filter { it.covers(date) }.sortedBy { it.title }

    suspend fun createSchedule(
        scheduleDate: String,
        endDate: String,
        title: String,
        tag: String,
    ): ScheduleItem {
        val body = jsonObjectOf(
            "user_id" to jsonString(sessionStore.userId),
            "schedule_date" to jsonString(scheduleDate),
            "end_date" to jsonString(endDate.ifBlank { scheduleDate }),
            "title" to jsonString(title.trim()),
            "tag" to jsonString(tag.ifBlank { "개인" }),
            "repeat_type" to jsonString("none"),
            "repeat_interval" to com.youngryul.potatobuddy.data.remote.jsonInt(1),
            "repeat_end_type" to jsonString("never"),
            "repeat_monthly_rule" to jsonString("day"),
        ).toString()
        val raw = client.post(
            "schedule_calendar_events",
            body,
            prefer = "return=representation",
        )
        return client.json.decodeFromString(ListSerializer(ScheduleItem.serializer()), raw).first()
    }

    suspend fun updateSchedule(
        id: String,
        scheduleDate: String,
        endDate: String,
        title: String,
        tag: String,
    ): ScheduleItem {
        val masterId = id.substringBefore("__")
        val body = jsonObjectOf(
            "schedule_date" to jsonString(scheduleDate),
            "end_date" to jsonString(endDate.ifBlank { scheduleDate }),
            "title" to jsonString(title.trim()),
            "tag" to jsonString(tag.ifBlank { "개인" }),
            "repeat_type" to jsonString("none"),
            "repeat_interval" to com.youngryul.potatobuddy.data.remote.jsonInt(1),
            "repeat_end_type" to jsonString("never"),
            "repeat_monthly_rule" to jsonString("day"),
        ).toString()
        val raw = client.patch(
            "schedule_calendar_events",
            mapOf(
                "id" to "eq.$masterId",
                "user_id" to "eq.${sessionStore.userId}",
            ),
            body,
            prefer = "return=representation",
        )
        return client.json.decodeFromString(ListSerializer(ScheduleItem.serializer()), raw).first()
    }

    suspend fun deleteSchedule(id: String) {
        val masterId = id.substringBefore("__")
        client.delete(
            "schedule_calendar_events",
            mapOf(
                "id" to "eq.$masterId",
                "user_id" to "eq.${sessionStore.userId}",
            ),
        )
    }
}
