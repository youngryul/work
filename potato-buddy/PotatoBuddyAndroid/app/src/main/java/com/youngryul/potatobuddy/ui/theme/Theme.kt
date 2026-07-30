package com.youngryul.potatobuddy.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Green = Color(0xFF7CB342)
private val GreenDark = Color(0xFF558B2F)
private val Cream = Color(0xFFFFFDF6)

private val LightColors = lightColorScheme(
    primary = Green,
    onPrimary = Color.White,
    secondary = GreenDark,
    background = Cream,
    surface = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = Green,
    onPrimary = Color.White,
    secondary = Green,
)

@Composable
fun PotatoBuddyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
