package com.rafeeq.companion.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val Color0F = Color(0xFF04070F)

private val DarkScheme = darkColorScheme(
    primary = Cyan,
    onPrimary = Color0F,
    primaryContainer = Color(0xFF0E3B4A),
    onPrimaryContainer = Cyan,
    secondary = Violet,
    onSecondary = Color0F,
    secondaryContainer = Color(0xFF2E1D5B),
    onSecondaryContainer = Violet,
    tertiary = Amber,
    onTertiary = Color0F,
    tertiaryContainer = Color(0xFF4A3208),
    onTertiaryContainer = Amber,
    background = NightBackground,
    onBackground = NightOnSurface,
    surface = NightSurface,
    onSurface = NightOnSurface,
    surfaceVariant = NightSurfaceHigh,
    onSurfaceVariant = NightOnSurfaceMuted,
    surfaceContainer = NightSurface,
    surfaceContainerHigh = NightSurfaceHigh,
    surfaceContainerHighest = Color(0xFF1B2745),
    outline = NightOutline,
    outlineVariant = Color(0xFF1B2745),
    error = Rose,
    onError = Color0F,
)

private val LightScheme = lightColorScheme(
    primary = CyanDeep,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFCFF6FE),
    onPrimaryContainer = Color(0xFF00404E),
    secondary = VioletDeep,
    onSecondary = Color.White,
    secondaryContainer = Color(0xFFE9DDFF),
    onSecondaryContainer = Color(0xFF260E5C),
    tertiary = AmberDeep,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFFFEBC2),
    onTertiaryContainer = Color(0xFF3D2600),
    background = DayBackground,
    onBackground = DayOnSurface,
    surface = DaySurface,
    onSurface = DayOnSurface,
    surfaceVariant = DaySurfaceHigh,
    onSurfaceVariant = DayOnSurfaceMuted,
    surfaceContainer = DaySurface,
    surfaceContainerHigh = DaySurfaceHigh,
    surfaceContainerHighest = Color(0xFFE3EAF6),
    outline = DayOutline,
    outlineVariant = Color(0xFFE3EAF6),
    error = RoseDeep,
    onError = Color.White,
)

val RafeeqShapes = Shapes(
    extraSmall = RoundedCornerShape(10.dp),
    small = RoundedCornerShape(14.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

/** أوضاع المظهر المتاحة للمستخدم. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Composable
fun RafeeqTheme(
    mode: ThemeMode = ThemeMode.SYSTEM,
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val context = LocalContext.current
    val scheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (dark) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        dark -> DarkScheme
        else -> LightScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !dark
            WindowCompat.getInsetsController(window, view).isAppearanceLightNavigationBars = !dark
        }
    }

    MaterialTheme(
        colorScheme = scheme,
        typography = RafeeqTypography,
        shapes = RafeeqShapes,
        content = content,
    )
}
