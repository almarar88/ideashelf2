package com.rafeeq.companion.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * اللوحة.
 *
 * رمادي محايد هو الأرضية، واللون محجوز للتمييز وحده — حين يكون كل شيء
 * ملوّنًا لا يبرز شيء. نفس القيم المستعملة في نسخة ويندوز، فيبدو التطبيقان
 * تطبيقًا واحدًا على جهازين.
 *
 * الوضع الداكن على أسود حقيقي: شاشات الهاتف OLED، والأسود فيها بكسل مطفأ
 * لا رمادي مضاء. والألوان تُفتَح فيه لأن نسخة النهار تبدو موحلة على أسود.
 */

// --- فاتح ---
val SandBackground = Color(0xFFF2F2F5)
val SandSurface = Color(0xFFFFFFFF)
val SandSurfaceSoft = Color(0xFFFAFAFC)
val SandSurfaceHigh = Color(0xFFEFEFF2)
val SandOutline = Color(0x12000000)
val SandOnSurface = Color(0xFF1A1A1C)
val SandOnSurfaceMuted = Color(0xFF5E5E66)

// --- داكن ---
val NightBackground = Color(0xFF000000)
val NightSurface = Color(0xFF161618)
val NightSurfaceHigh = Color(0xFF262629)
val NightOutline = Color(0x29FFFFFF)
val NightOnSurface = Color(0xFFF5F5F7)
val NightOnSurfaceMuted = Color(0xFFA1A1A8)

// أسماء قديمة يستعملها بقيّة الكود — نُبقيها مربوطة باللوحة الجديدة.
val DayBackground = SandBackground
val DaySurface = SandSurface
val DaySurfaceHigh = SandSurfaceHigh
val DayOutline = SandOutline
val DayOnSurface = SandOnSurface
val DayOnSurfaceMuted = SandOnSurfaceMuted

/*
 * الألوان الدلالية.
 *
 * كانت باستيلات مشبَعة تملأ خلفيات البطاقات. صارت خلفيات باهتة جدًا مع حبر
 * مشبَع: الخلفية تُلمّح، والحبر هو ما يُقرأ. هذا ما يُبقي التباين كافيًا
 * ويمنع الشاشة من أن تصير لوحة ألوان.
 */
val PastelLavender = Color(0x1A6B4BE8)
val PastelLavenderInk = Color(0xFF6B4BE8)
val PastelOlive = Color(0x1FC77C12)
val PastelOliveInk = Color(0xFFC77C12)
val PastelMint = Color(0x1A20A56A)
val PastelMintInk = Color(0xFF20A56A)
val PastelPeach = Color(0x1A0A6CFF)
val PastelPeachInk = Color(0xFF0A6CFF)
val PastelButter = Color(0x1FC77C12)
val PastelButterInk = Color(0xFFC77C12)
val PastelBlue = Color(0x1A0E8E9E)
val PastelRose = Color(0x1ADC3B38)
val PastelRoseInk = Color(0xFFDC3B38)

/** ترتيب ثابت تدور عليه البطاقات، فيبقى شكل الشاشة متوازنًا. */
val PastelDeck = listOf(
    PastelPeach, PastelMint, PastelButter, PastelLavender, PastelRose, PastelOlive,
)

val PastelInkDeck = listOf(
    PastelPeachInk, PastelMintInk, PastelButterInk, PastelLavenderInk, PastelRoseInk, PastelOliveInk,
)

// --- ألوان الحالة والتمييز ---
/*
 * ألوان التمييز. نفس قيم نسخة ويندوز حرفًا بحرف — أي اختلاف هنا يجعل
 * التطبيقين يبدوان تطبيقين.
 */
val Ink = Color(0xFF1A1A1C)
val Accent = Color(0xFF0A6CFF)
val Amber = Color(0xFFC77C12)
val AmberDeep = Color(0xFF8A5406)
val Emerald = Color(0xFF20A56A)
val EmeraldDeep = Color(0xFF14704A)
val Rose = Color(0xFFDC3B38)
val RoseDeep = Color(0xFF9E2522)
val Violet = Color(0xFF6B4BE8)
val VioletDeep = Color(0xFF4A32A8)
val Cyan = Color(0xFF0E8E9E)
val CyanDeep = Color(0xFF096470)
val Sky = Color(0xFF0A6CFF)
val Indigo = Color(0xFF6B4BE8)

/**
 * تدرّجات هادئة. اللوحة الجديدة تعتمد المسطّح أكثر من التدرّج،
 * فالتدرّجات هنا خفيفة جدًا ولا تكاد تُرى — كما في التصميم المرجعي.
 */
object Gradients {
    val Aurora = listOf(PastelLavender, PastelBlue)
    val Sunrise = listOf(PastelPeach, PastelButter)
    val Ocean = listOf(PastelBlue, PastelLavender)
    val Meadow = listOf(PastelMint, Color(0xFFDCEFE6))
    val Dusk = listOf(PastelLavender, Color(0xFFE6D9F2))
    val Ember = listOf(PastelButter, PastelPeach)
    val Mint = listOf(PastelMint, PastelButter)
}

/** خلفية بطاقة الترحيب بحسب ساعة اليوم — باستيل يتبدّل بهدوء. */
fun gradientForHour(hour: Int): List<Color> = when (hour) {
    in 4..7 -> listOf(Color(0xFFF7E2E6), PastelPeach)
    in 8..11 -> listOf(PastelPeach, Color(0xFFFAF0E4))
    in 12..15 -> listOf(PastelMint, Color(0xFFDDEFE8))
    in 16..18 -> listOf(PastelButter, Color(0xFFF8EEC2))
    in 19..21 -> listOf(PastelLavender, Color(0xFFE6E8FA))
    else -> listOf(Color(0xFFD6D8E8), Color(0xFFE4E2EC))
}
