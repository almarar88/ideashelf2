package com.rafeeq.companion.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp

/**
 * نظام الخطوط. نعتمد على خط النظام (يدعم العربية بشكل ممتاز على أندرويد)
 * مع ضبط ارتفاع السطر ليناسب الحروف العربية ذات النقاط والمدّات.
 */
private val arabicLineHeight = LineHeightStyle(
    alignment = LineHeightStyle.Alignment.Center,
    trim = LineHeightStyle.Trim.None,
)

private fun style(
    size: Int,
    lineHeight: Int,
    weight: FontWeight,
    letterSpacing: Double = 0.0,
) = TextStyle(
    fontFamily = FontFamily.Default,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    letterSpacing = letterSpacing.sp,
    lineHeightStyle = arabicLineHeight,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
)

val RafeeqTypography = Typography(
    displayLarge = style(52, 62, FontWeight.Bold, (-1.0)),
    displayMedium = style(42, 52, FontWeight.Bold, (-0.5)),
    displaySmall = style(34, 44, FontWeight.Bold),
    headlineLarge = style(30, 40, FontWeight.Bold),
    headlineMedium = style(25, 34, FontWeight.Bold),
    headlineSmall = style(21, 30, FontWeight.SemiBold),
    titleLarge = style(20, 28, FontWeight.SemiBold),
    titleMedium = style(17, 25, FontWeight.SemiBold),
    titleSmall = style(15, 22, FontWeight.SemiBold),
    bodyLarge = style(16, 26, FontWeight.Normal),
    bodyMedium = style(14, 23, FontWeight.Normal),
    bodySmall = style(13, 20, FontWeight.Normal),
    labelLarge = style(14, 20, FontWeight.SemiBold),
    labelMedium = style(12, 17, FontWeight.Medium),
    labelSmall = style(11, 15, FontWeight.Medium),
)
