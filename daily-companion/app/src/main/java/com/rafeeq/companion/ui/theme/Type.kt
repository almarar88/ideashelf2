package com.rafeeq.companion.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.sp
import com.rafeeq.companion.R

/**
 * نظام الخطوط.
 *
 * IBM Plex Sans Arabic بترخيص SIL OFL، مضمَّن داخل التطبيق لا مجلوبًا من
 * الشبكة: التطبيق يعمل بلا إنترنت، والخطّ المنتظَر يُظهر النصّ مرتجفًا عند
 * وصوله. وخطّ النظام يختلف بين الأجهزة والمصنّعين، فيختلف شكل التطبيق نفسه
 * من هاتف لآخر — وهذا ما يجعله يبدو غير مصمَّم.
 *
 * نفس الخطّ في نسخة ويندوز، فيبدو التطبيقان تطبيقًا واحدًا.
 */
val PlexArabic = FontFamily(
    Font(R.font.plex_arabic_regular, FontWeight.Normal),
    Font(R.font.plex_arabic_medium, FontWeight.Medium),
    Font(R.font.plex_arabic_semibold, FontWeight.SemiBold),
    Font(R.font.plex_arabic_bold, FontWeight.Bold),
)

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
    fontFamily = PlexArabic,
    fontWeight = weight,
    fontSize = size.sp,
    lineHeight = lineHeight.sp,
    letterSpacing = letterSpacing.sp,
    lineHeightStyle = arabicLineHeight,
    platformStyle = PlatformTextStyle(includeFontPadding = false),
)

val RafeeqTypography = Typography(
    displayLarge = style(52, 62, FontWeight.Bold, (-1.3)),
    displayMedium = style(42, 52, FontWeight.Bold, (-0.9)),
    displaySmall = style(34, 44, FontWeight.Bold, (-0.7)),
    headlineLarge = style(30, 40, FontWeight.Bold, (-0.6)),
    headlineMedium = style(25, 34, FontWeight.Bold, (-0.4)),
    headlineSmall = style(21, 30, FontWeight.SemiBold, (-0.3)),
    titleLarge = style(20, 28, FontWeight.SemiBold, (-0.2)),
    titleMedium = style(17, 25, FontWeight.SemiBold),
    titleSmall = style(15, 22, FontWeight.SemiBold),
    bodyLarge = style(16, 26, FontWeight.Normal),
    bodyMedium = style(14, 23, FontWeight.Normal),
    bodySmall = style(13, 20, FontWeight.Normal),
    labelLarge = style(14, 20, FontWeight.SemiBold),
    labelMedium = style(12, 17, FontWeight.Medium),
    labelSmall = style(11, 15, FontWeight.Medium),
)

/** يضاعف كل أحجام الخط وارتفاعات الأسطر بمعامل واحد. */
fun Typography.scaledBy(factor: Float): Typography {
    fun TextStyle.scale() = copy(
        fontSize = fontSize * factor,
        lineHeight = lineHeight * factor,
    )
    return Typography(
        displayLarge = displayLarge.scale(),
        displayMedium = displayMedium.scale(),
        displaySmall = displaySmall.scale(),
        headlineLarge = headlineLarge.scale(),
        headlineMedium = headlineMedium.scale(),
        headlineSmall = headlineSmall.scale(),
        titleLarge = titleLarge.scale(),
        titleMedium = titleMedium.scale(),
        titleSmall = titleSmall.scale(),
        bodyLarge = bodyLarge.scale(),
        bodyMedium = bodyMedium.scale(),
        bodySmall = bodySmall.scale(),
        labelLarge = labelLarge.scale(),
        labelMedium = labelMedium.scale(),
        labelSmall = labelSmall.scale(),
    )
}
