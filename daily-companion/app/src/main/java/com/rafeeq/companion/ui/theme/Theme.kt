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
import androidx.compose.runtime.remember
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

private val Color0F = Color(0xFF141210)

private val DarkScheme = darkColorScheme(
    primary = Cyan,
    onPrimary = Color0F,
    primaryContainer = Color(0xFF23413A),
    onPrimaryContainer = PastelMint,
    secondary = Violet,
    onSecondary = Color0F,
    secondaryContainer = Color(0xFF2B2C4A),
    onSecondaryContainer = PastelLavender,
    tertiary = Amber,
    onTertiary = Color0F,
    tertiaryContainer = Color(0xFF463818),
    onTertiaryContainer = PastelButter,
    background = NightBackground,
    onBackground = NightOnSurface,
    surface = NightSurface,
    onSurface = NightOnSurface,
    surfaceVariant = NightSurfaceHigh,
    onSurfaceVariant = NightOnSurfaceMuted,
    surfaceContainer = NightSurface,
    surfaceContainerHigh = NightSurfaceHigh,
    surfaceContainerHighest = Color(0xFF302B26),
    outline = NightOutline,
    outlineVariant = Color(0xFF302B26),
    error = Rose,
    onError = Color0F,
)

private val LightScheme = lightColorScheme(
    primary = CyanDeep,
    onPrimary = Color.White,
    primaryContainer = PastelMint,
    onPrimaryContainer = PastelMintInk,
    secondary = VioletDeep,
    onSecondary = Color.White,
    secondaryContainer = PastelLavender,
    onSecondaryContainer = PastelLavenderInk,
    tertiary = AmberDeep,
    onTertiary = Color.White,
    tertiaryContainer = PastelButter,
    onTertiaryContainer = PastelButterInk,
    background = DayBackground,
    onBackground = DayOnSurface,
    surface = DaySurface,
    onSurface = DayOnSurface,
    surfaceVariant = DaySurfaceHigh,
    onSurfaceVariant = DayOnSurfaceMuted,
    surfaceContainer = SandSurfaceSoft,
    surfaceContainerHigh = DaySurfaceHigh,
    surfaceContainerHighest = Color(0xFFE9E2DA),
    outline = DayOutline,
    outlineVariant = Color(0xFFE9E2DA),
    error = RoseDeep,
    onError = Color.White,
)

val RafeeqShapes = Shapes(
    extraSmall = RoundedCornerShape(14.dp),
    small = RoundedCornerShape(18.dp),
    medium = RoundedCornerShape(24.dp),
    large = RoundedCornerShape(30.dp),
    extraLarge = RoundedCornerShape(40.dp),
)

/** أوضاع المظهر المتاحة للمستخدم. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

@Composable
fun RafeeqTheme(
    mode: ThemeMode = ThemeMode.SYSTEM,
    dynamicColor: Boolean = false,
    fontScale: Float = 1.0f,
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

    // نضرب كل أحجام الخط بمعامل واحد بدل إضافة إعداد لكل نمط على حدة.
    val scaled = remember(fontScale) {
        if (fontScale == 1.0f) RafeeqTypography else RafeeqTypography.scaledBy(fontScale)
    }

    MaterialTheme(
        colorScheme = scheme,
        typography = scaled,
        shapes = RafeeqShapes,
        content = content,
    )
}
