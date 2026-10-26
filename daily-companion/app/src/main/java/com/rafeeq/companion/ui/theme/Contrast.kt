package com.rafeeq.companion.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * التباين: حسابٌ لا ذوق.
 *
 * السبب المباشر: اللوحة تغيّرت إلى «خلفيات باهتة جدًا مع حبر مشبَع»، لكن
 * البطاقات المتدرّجة بقيت تكتب بالأبيض. وPastelMint شفافيته ١٠٪ فقط، أي
 * أنه فوق سطح أبيض يصير أبيضَ تقريبًا — فصار النصّ الأبيض على خلفية
 * بيضاء: غير مقروء البتّة. ظهر ذلك في بطاقة «الصلاة القادمة».
 *
 * النسب هنا من WCAG: ٤٫٥ للنصّ العادي، و٣ للنصّ الكبير وعناصر الواجهة.
 * اختيار اللون بالعين هو ما أوصلنا إلى هنا؛ هذه الدوالّ تجعله قابلًا
 * للقياس، والاختبارات تمنع عودته.
 */
object Contrast {

    const val AA_NORMAL = 4.5
    const val AA_LARGE = 3.0

    /** السطوع النسبي بحسب WCAG. */
    fun luminance(color: Color): Double {
        fun channel(value: Float): Double {
            val c = value.toDouble()
            return if (c <= 0.03928) c / 12.92 else Math.pow((c + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * channel(color.red) +
            0.7152 * channel(color.green) +
            0.0722 * channel(color.blue)
    }

    /** نسبة التباين بين لونين معتمَين، من ١ إلى ٢١. */
    fun ratio(a: Color, b: Color): Double {
        val x = luminance(a)
        val y = luminance(b)
        val light = maxOf(x, y)
        val dark = minOf(x, y)
        return (light + 0.05) / (dark + 0.05)
    }

    /**
     * يدمج لونًا شفّافًا فوق خلفية معتمة.
     *
     * بدون هذا تُحسب شفافية ١٠٪ كأنها لون مشبَع، فيبدو التباين ممتازًا على
     * الورق ومعدومًا على الشاشة — وهو بالضبط ما حدث.
     */
    fun over(foreground: Color, background: Color): Color {
        val a = foreground.alpha
        return Color(
            red = foreground.red * a + background.red * (1 - a),
            green = foreground.green * a + background.green * (1 - a),
            blue = foreground.blue * a + background.blue * (1 - a),
            alpha = 1f,
        )
    }

    /** أعلى اللونين تباينًا فوق هذه الخلفية — فلا يُكتب أبيض على أبيض. */
    fun readableOn(
        background: Color,
        light: Color = Color.White,
        dark: Color = Ink,
    ): Color = if (ratio(light, background) >= ratio(dark, background)) light else dark
}
