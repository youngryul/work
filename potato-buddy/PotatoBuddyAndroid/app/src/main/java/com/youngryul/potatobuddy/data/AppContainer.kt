package com.youngryul.potatobuddy.data

import android.content.Context
import com.youngryul.potatobuddy.data.auth.AuthRepository
import com.youngryul.potatobuddy.data.auth.SessionStore
import com.youngryul.potatobuddy.data.remote.SupabaseClient
import com.youngryul.potatobuddy.data.repo.DiaryRepository
import com.youngryul.potatobuddy.data.repo.ScheduleRepository
import com.youngryul.potatobuddy.data.repo.TaskRepository

class AppContainer(context: Context) {
    private val appContext = context.applicationContext
    val sessionStore = SessionStore(appContext)
    val supabase = SupabaseClient(sessionStore)
    val authRepository = AuthRepository(supabase, sessionStore)
    val taskRepository = TaskRepository(supabase, sessionStore)
    val diaryRepository = DiaryRepository(supabase, sessionStore)
    val scheduleRepository = ScheduleRepository(supabase, sessionStore)
}
