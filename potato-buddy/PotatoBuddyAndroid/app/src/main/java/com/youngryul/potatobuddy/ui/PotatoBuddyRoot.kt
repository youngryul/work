package com.youngryul.potatobuddy.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.lifecycle.viewmodel.compose.viewModel
import com.youngryul.potatobuddy.PotatoBuddyApp
import com.youngryul.potatobuddy.ui.login.LoginScreen
import com.youngryul.potatobuddy.ui.login.LoginViewModel
import com.youngryul.potatobuddy.ui.navigation.MainTabsScreen

@Composable
fun PotatoBuddyRoot() {
    val container = PotatoBuddyApp.instance.container
    val auth = container.authRepository
    val loggedIn by auth.isLoggedIn.collectAsState()

    LaunchedEffect(Unit) {
        if (auth.isLoggedIn.value) {
            auth.refreshIfPossible()
        }
    }

    if (loggedIn) {
        MainTabsScreen(
            container = container,
            onLogout = { auth.signOut() },
        )
    } else {
        val loginVm: LoginViewModel = viewModel(
            factory = remember {
                LoginViewModel.Factory(auth)
            },
        )
        LoginScreen(viewModel = loginVm)
    }
}
