package com.youngryul.potatobuddy.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class TaskItem(
    val id: String,
    val title: String,
    val category: String? = null,
    val priority: Int? = null,
    val createdat: Long? = null,
) {
    val displayTitle: String
        get() = if (!category.isNullOrBlank() && category != "작업") "[$category] $title" else title
}

@Serializable
data class DiaryItem(
    val id: String,
    val date: String,
    val content: String,
    @SerialName("image_url") val imageUrl: String? = null,
    val emotion: String? = null,
)

@Serializable
data class ScheduleItem(
    val id: String,
    @SerialName("schedule_date") val scheduleDate: String,
    @SerialName("end_date") val endDate: String? = null,
    val title: String,
    val tag: String = "",
    @SerialName("repeat_type") val repeatType: String? = "none",
) {
    fun covers(date: String): Boolean {
        val end = endDate?.takeIf { it.isNotBlank() } ?: scheduleDate
        return date in scheduleDate..end
    }
}

@Serializable
data class CategoryItem(
    val id: String,
    val name: String,
    val emoji: String? = null,
)
