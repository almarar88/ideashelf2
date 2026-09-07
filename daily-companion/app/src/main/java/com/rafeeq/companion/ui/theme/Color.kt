package com.rafeeq.companion.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * لوحة ألوان "شفق الليل" — Aurora Night.
 * الوضع الداكن هو الوضع الأساسي للتطبيق، والوضع الفاتح مصمم ليكون هادئًا ومريحًا للعين.
 */

// --- Dark (Aurora Night) ---
val NightBackground = Color(0xFF070B18)
val NightSurface = Color(0xFF0D1426)
val NightSurfaceHigh = Color(0xFF141D36)
val NightOutline = Color(0xFF243155)
val NightOnSurface = Color(0xFFE8EDF9)
val NightOnSurfaceMuted = Color(0xFF9AA7C7)

// --- Light (Porcelain Day) ---
val DayBackground = Color(0xFFF4F7FC)
val DaySurface = Color(0xFFFFFFFF)
val DaySurfaceHigh = Color(0xFFEDF2FA)
val DayOutline = Color(0xFFD7E0EE)
val DayOnSurface = Color(0xFF0F172A)
val DayOnSurfaceMuted = Color(0xFF5A6885)

// --- Brand accents ---
val Cyan = Color(0xFF6EE7F9)
val CyanDeep = Color(0xFF0891B2)
val Violet = Color(0xFFA78BFA)
val VioletDeep = Color(0xFF6D28D9)
val Amber = Color(0xFFFBBF24)
val AmberDeep = Color(0xFFB45309)
val Emerald = Color(0xFF34D399)
val EmeraldDeep = Color(0xFF047857)
val Rose = Color(0xFFFB7185)
val RoseDeep = Color(0xFFBE123C)
val Sky = Color(0xFF38BDF8)
val Indigo = Color(0xFF818CF8)

/** تدرّجات جاهزة لكل قسم في التطبيق. */
object Gradients {
    val Aurora = listOf(Color(0xFF6EE7F9), Color(0xFFA78BFA))
    val Sunrise = listOf(Color(0xFFFBBF24), Color(0xFFFB7185))
    val Ocean = listOf(Color(0xFF38BDF8), Color(0xFF0891B2))
    val Meadow = listOf(Color(0xFF34D399), Color(0xFF0EA5E9))
    val Dusk = listOf(Color(0xFF818CF8), Color(0xFFC084FC))
    val Ember = listOf(Color(0xFFF97316), Color(0xFFDB2777))
    val Mint = listOf(Color(0xFF2DD4BF), Color(0xFF4ADE80))
}

/** يعيد تدرّجًا مناسبًا لوقت اليوم — يُستخدم في بطاقة الترحيب. */
fun gradientForHour(hour: Int): List<Color> = when (hour) {
    in 4..7 -> listOf(Color(0xFFF9A8D4), Color(0xFFFBBF24))   // الفجر
    in 8..11 -> listOf(Color(0xFF38BDF8), Color(0xFF6EE7F9))  // الصباح
    in 12..15 -> listOf(Color(0xFF0EA5E9), Color(0xFF34D399)) // الظهيرة
    in 16..18 -> listOf(Color(0xFFF97316), Color(0xFFFBBF24)) // العصر
    in 19..21 -> listOf(Color(0xFF7C3AED), Color(0xFFDB2777)) // المغرب
    else -> listOf(Color(0xFF1E1B4B), Color(0xFF312E81))      // الليل
}
