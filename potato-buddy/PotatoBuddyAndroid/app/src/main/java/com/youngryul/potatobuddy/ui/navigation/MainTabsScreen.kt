package com.youngryul.potatobuddy.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.youngryul.potatobuddy.data.AppContainer
import com.youngryul.potatobuddy.ui.backlog.BacklogScreen
import com.youngryul.potatobuddy.ui.backlog.BacklogViewModel
import com.youngryul.potatobuddy.ui.diary.DiaryScreen
import com.youngryul.potatobuddy.ui.diary.DiaryViewModel
import com.youngryul.potatobuddy.ui.schedule.ScheduleScreen
import com.youngryul.potatobuddy.ui.schedule.ScheduleViewModel
import com.youngryul.potatobuddy.ui.settings.SettingsScreen
import com.youngryul.potatobuddy.ui.today.TodayScreen
import com.youngryul.potatobuddy.ui.today.TodayViewModel

private enum class Tab(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Today("today", "오늘", Icons.Filled.Home),
    Backlog("backlog", "백로그", Icons.Filled.Inbox),
    Diary("diary", "일기", Icons.Filled.Book),
    Schedule("schedule", "일정", Icons.Filled.CalendarMonth),
    Settings("settings", "설정", Icons.Filled.Settings),
}

@Composable
fun MainTabsScreen(
    container: AppContainer,
    onLogout: () -> Unit,
) {
    val navController = rememberNavController()
    val backStack by navController.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route

    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = currentRoute == tab.route,
                        onClick = {
                            navController.navigate(tab.route) {
                                popUpTo(navController.graph.startDestinationId) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = Tab.Today.route,
            modifier = Modifier.padding(padding),
        ) {
            composable(Tab.Today.route) {
                val vm: TodayViewModel = viewModel(
                    factory = remember { TodayViewModel.Factory(container.taskRepository) },
                )
                TodayScreen(viewModel = vm)
            }
            composable(Tab.Backlog.route) {
                val vm: BacklogViewModel = viewModel(
                    factory = remember { BacklogViewModel.Factory(container.taskRepository) },
                )
                BacklogScreen(viewModel = vm)
            }
            composable(Tab.Diary.route) {
                val vm: DiaryViewModel = viewModel(
                    factory = remember { DiaryViewModel.Factory(container.diaryRepository) },
                )
                DiaryScreen(viewModel = vm)
            }
            composable(Tab.Schedule.route) {
                val vm: ScheduleViewModel = viewModel(
                    factory = remember { ScheduleViewModel.Factory(container.scheduleRepository) },
                )
                ScheduleScreen(viewModel = vm)
            }
            composable(Tab.Settings.route) {
                SettingsScreen(onLogout = onLogout)
            }
        }
    }
}
