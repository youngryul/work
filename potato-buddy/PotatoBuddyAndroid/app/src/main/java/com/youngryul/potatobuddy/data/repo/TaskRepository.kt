package com.youngryul.potatobuddy.data.repo

import com.youngryul.potatobuddy.data.auth.SessionStore
import com.youngryul.potatobuddy.data.model.CategoryItem
import com.youngryul.potatobuddy.data.model.TaskItem
import com.youngryul.potatobuddy.data.remote.SupabaseClient
import com.youngryul.potatobuddy.data.remote.jsonBool
import com.youngryul.potatobuddy.data.remote.jsonLong
import com.youngryul.potatobuddy.data.remote.jsonObjectOf
import com.youngryul.potatobuddy.data.remote.jsonString
import kotlinx.serialization.Serializable
import kotlinx.serialization.builtins.ListSerializer

class TaskRepository(
    private val client: SupabaseClient,
    private val sessionStore: SessionStore,
) {
    suspend fun fetchTodayTasks(): List<TaskItem> {
        val userId = sessionStore.userId
        val raw = client.get(
            "tasks",
            mapOf(
                "istoday" to "eq.true",
                "completed" to "eq.false",
                "user_id" to "eq.$userId",
                "select" to "id,title,category,priority,createdat",
                "order" to "priority.asc,movedtotodayat.asc,createdat.asc",
            ),
        )
        return client.json.decodeFromString(ListSerializer(TaskItem.serializer()), raw)
    }

    suspend fun fetchBacklogTasks(): List<TaskItem> {
        val userId = sessionStore.userId
        val raw = client.get(
            "tasks",
            mapOf(
                "istoday" to "eq.false",
                "completed" to "eq.false",
                "user_id" to "eq.$userId",
                "select" to "id,title,category,priority,createdat",
                "order" to "priority.asc,createdat.asc",
            ),
        )
        return client.json.decodeFromString(ListSerializer(TaskItem.serializer()), raw)
    }

    suspend fun addTodayTask(title: String) {
        val now = System.currentTimeMillis()
        val body = jsonObjectOf(
            "title" to jsonString(title.trim()),
            "istoday" to jsonBool(true),
            "completed" to jsonBool(false),
            "category" to jsonString("작업"),
            "createdat" to jsonLong(now),
            "user_id" to jsonString(sessionStore.userId),
        ).toString()
        client.post("tasks", body)
    }

    suspend fun addBacklogTask(title: String, category: String) {
        val now = System.currentTimeMillis()
        val body = jsonObjectOf(
            "title" to jsonString(title.trim()),
            "istoday" to jsonBool(false),
            "completed" to jsonBool(false),
            "category" to jsonString(category.ifBlank { "작업" }),
            "createdat" to jsonLong(now),
            "user_id" to jsonString(sessionStore.userId),
        ).toString()
        client.post("tasks", body)
    }

    suspend fun completeTask(id: String) {
        val now = System.currentTimeMillis()
        val body = jsonObjectOf(
            "completed" to jsonBool(true),
            "completedat" to jsonLong(now),
        ).toString()
        client.patch(
            "tasks",
            mapOf(
                "id" to "eq.$id",
                "user_id" to "eq.${sessionStore.userId}",
            ),
            body,
        )
    }

    suspend fun deleteTask(id: String) {
        client.delete(
            "tasks",
            mapOf(
                "id" to "eq.$id",
                "user_id" to "eq.${sessionStore.userId}",
            ),
        )
    }

    suspend fun moveToToday(id: String) {
        val userId = sessionStore.userId
        val priorityRaw = client.get(
            "tasks",
            mapOf(
                "user_id" to "eq.$userId",
                "istoday" to "eq.true",
                "completed" to "eq.false",
                "id" to "neq.$id",
                "select" to "priority",
            ),
        )
        val rows = client.json.decodeFromString(ListSerializer(PriorityRow.serializer()), priorityRaw)
        val nextPriority = (rows.mapNotNull { it.priority }.maxOrNull() ?: -1) + 1
        val now = System.currentTimeMillis()
        val body = jsonObjectOf(
            "istoday" to jsonBool(true),
            "movedtotodayat" to jsonLong(now),
            "priority" to com.youngryul.potatobuddy.data.remote.jsonInt(nextPriority),
        ).toString()
        client.patch(
            "tasks",
            mapOf(
                "id" to "eq.$id",
                "user_id" to "eq.$userId",
            ),
            body,
        )
    }

    suspend fun fetchCategories(): List<CategoryItem> {
        val raw = client.get(
            "categories",
            mapOf(
                "user_id" to "eq.${sessionStore.userId}",
                "select" to "id,name,emoji",
                "order" to "name.asc",
            ),
        )
        return client.json.decodeFromString(ListSerializer(CategoryItem.serializer()), raw)
    }

    @Serializable
    private data class PriorityRow(val priority: Int? = null)
}
