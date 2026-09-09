package com.rafeeq.companion.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * لوحة "الرمل الدافئ" — Warm Sand.
 *
 * خلفية رملية دافئة، بطاقات بيضاء كبيرة الاستدارة، عناوين سوداء عريضة،
 * وألوان باستيل هادئة للفئات والبطاقات. اللون لا يصرخ — الحروف هي البطل.
 */

// --- Light (Warm Sand) ---
val SandBackground = Color(0xFFEDE7E1)
val SandSurface = Color(0xFFFFFFFF)
val SandSurfaceSoft = Color(0xFFFBF8F5)
val SandSurfaceHigh = Color(0xFFF2ECE6)
val SandOutline = Color(0xFFE2DAD2)
val SandOnSurface = Color(0xFF111111)
val SandOnSurfaceMuted = Color(0xFF8C8680)

// --- Dark (Warm Night) ---
val NightBackground = Color(0xFF141210)
val NightSurface = Color(0xFF1E1B18)
val NightSurfaceHigh = Color(0xFF272320)
val NightOutline = Color(0xFF3A3430)
val NightOnSurface = Color(0xFFF5F0EA)
val NightOnSurfaceMuted = Color(0xFFA39C94)

// أسماء قديمة يستعملها بقيّة الكود — نُبقيها مربوطة باللوحة الجديدة.
val DayBackground = SandBackground
val DaySurface = SandSurface
val DaySurfaceHigh = SandSurfaceHigh
val DayOutline = SandOutline
val DayOnSurface = SandOnSurface
val DayOnSurfaceMuted = SandOnSurfaceMuted

// --- الباستيل: ألوان البطاقات والفئات ---
val PastelLavender = Color(0xFFD9DCF7)
val PastelLavenderInk = Color(0xFF4B4FA6)
val PastelOlive = Color(0xFFDCCF8E)
val PastelOliveInk = Color(0xFF6B5E1F)
val PastelMint = Color(0xFFC9E7DC)
val PastelMintInk = Color(0xFF2F6B57)
val PastelPeach = Color(0xFFF6E7D8)
val PastelPeachInk = Color(0xFF8A5E33)
val PastelButter = Color(0xFFF2E08D)
val PastelButterInk = Color(0xFF6E5A12)
val PastelBlue = Color(0xFFB9C3F5)
val PastelRose = Color(0xFFF7D9DC)
val PastelRoseInk = Color(0xFF9B4B57)

/** ترتيب ثابت تدور عليه البطاقات، فيبقى شكل الشاشة متوازنًا. */
val PastelDeck = listOf(
    PastelPeach, PastelMint, PastelButter, PastelLavender, PastelRose, PastelOlive,
)

val PastelInkDeck = listOf(
    PastelPeachInk, PastelMintInk, PastelButterInk, PastelLavenderInk, PastelRoseInk, PastelOliveInk,
)

// --- ألوان الحالة والتمييز ---
val Ink = Color(0xFF111111)
val Amber = Color(0xFFE9A93B)
val AmberDeep = Color(0xFF9A6B14)
val Emerald = Color(0xFF3CC28A)
val EmeraldDeep = Color(0xFF1E7A55)
val Rose = Color(0xFFE0757F)
val RoseDeep = Color(0xFFB33A46)
val Violet = Color(0xFF7F84D6)
val VioletDeep = Color(0xFF4B4FA6)
val Cyan = Color(0xFF57BFAE)
val CyanDeep = Color(0xFF2F6B57)
val Sky = Color(0xFF8FB4E8)
val Indigo = Color(0xFF7F84D6)

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
