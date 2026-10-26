package com.rafeeq.companion

import androidx.compose.ui.graphics.Color
import com.rafeeq.companion.ui.theme.Contrast
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Ink
import com.rafeeq.companion.ui.theme.NightOnSurface
import com.rafeeq.companion.ui.theme.NightOnSurfaceMuted
import com.rafeeq.companion.ui.theme.NightSurface
import com.rafeeq.companion.ui.theme.PastelDeck
import com.rafeeq.companion.ui.theme.PastelInkDeck
import com.rafeeq.companion.ui.theme.PastelInkDeckDark
import com.rafeeq.companion.ui.theme.SandBackground
import com.rafeeq.companion.ui.theme.SandOnSurface
import com.rafeeq.companion.ui.theme.SandOnSurfaceMuted
import com.rafeeq.companion.ui.theme.SandSurface
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * وضوح النصّ، مقيسًا لا مُقدَّرًا بالعين.
 *
 * التقدير بالعين هو ما أنتج بطاقة «الصلاة القادمة»: نصّ أبيض على خلفية
 * شفافيتها ١٠٪ فوق سطح أبيض — أي أبيض على أبيض. تبدو اللوحة سليمة في
 * الكود وغير مقروءة على الهاتف. هذه الاختبارات تقيس كل زوج يُكتب فعلًا.
 */
class ContrastTest {

    private fun check(fg: Color, bg: Color, min: Double, what: String) {
        val solid = Contrast.over(fg, Contrast.over(bg, SandSurface))
        val r = Contrast.ratio(solid, Contrast.over(bg, SandSurface))
        assertTrue(
            "$what — التباين ${"%.2f".format(r)} أقلّ من $min",
            r >= min,
        )
    }

    @Test
    fun `النصّ الأساسي والثانوي واضحان في الوضعين`() {
        check(SandOnSurface, SandSurface, Contrast.AA_NORMAL, "نصّ أساسي على بطاقة فاتحة")
        check(SandOnSurface, SandBackground, Contrast.AA_NORMAL, "نصّ أساسي على خلفية فاتحة")
        check(SandOnSurfaceMuted, SandSurface, Contrast.AA_NORMAL, "نصّ ثانوي على بطاقة فاتحة")
        check(SandOnSurfaceMuted, SandBackground, Contrast.AA_NORMAL, "نصّ ثانوي على خلفية فاتحة")

        assertTrue(
            "نصّ أساسي داكن",
            Contrast.ratio(NightOnSurface, NightSurface) >= Contrast.AA_NORMAL,
        )
        assertTrue(
            "نصّ ثانوي داكن",
            Contrast.ratio(NightOnSurfaceMuted, NightSurface) >= Contrast.AA_NORMAL,
        )
    }

    /** الحبر الملوّن يُكتب على البطاقة الباهتة المقابلة له. */
    @Test
    fun `كل حبر ملوّن مقروء على خلفيته الباهتة`() {
        for ((index, ink) in PastelInkDeck.withIndex()) {
            val tint = PastelDeck[index]
            check(ink, tint, Contrast.AA_NORMAL, "حبر رقم $index على خلفيته")
        }
    }

    /**
     * العطل نفسه: لا لون نصّ ثابت على تدرّج.
     *
     * كل تدرّج يجب أن يُكتب عليه باللون الذي يقرّره حسابُ السطوع، لا
     * بالأبيض المكتوب يدويًا.
     */
    @Test
    fun `لون النصّ المختار لكل تدرّج يحقّق التباين`() {
        val gradients = mapOf(
            "Meadow" to Gradients.Meadow, "Dusk" to Gradients.Dusk,
            "Aurora" to Gradients.Aurora, "Sunrise" to Gradients.Sunrise,
            "Ocean" to Gradients.Ocean, "Ember" to Gradients.Ember,
            "Mint" to Gradients.Mint,
        )
        for ((name, colors) in gradients) {
            for (stop in colors) {
                val solid = Contrast.over(stop, SandSurface)
                val chosen = Contrast.readableOn(solid)
                val r = Contrast.ratio(chosen, solid)
                assertTrue(
                    "تدرّج $name — التباين ${"%.2f".format(r)} أقلّ من ${Contrast.AA_LARGE}",
                    r >= Contrast.AA_LARGE,
                )
            }
        }
    }

    /** والوضع الداكن: نفس الخلفيات الباهتة تنقلب فوق سطح أسود. */
    @Test
    fun `كل حبر ملوّن مقروء في الوضع الداكن أيضًا`() {
        for ((index, ink) in PastelInkDeckDark.withIndex()) {
            val background = Contrast.over(PastelDeck[index], NightSurface)
            val r = Contrast.ratio(ink, background)
            assertTrue(
                "حبر داكن رقم $index — التباين ${"%.2f".format(r)} أقلّ من ${Contrast.AA_NORMAL}",
                r >= Contrast.AA_NORMAL,
            )
        }
    }

    /** الحبر النهاري في الليل هو العطل المقابل، ويجب أن يبقى مرفوضًا. */
    @Test
    fun `الحبر النهاري غير مقروء ليلًا فلا يُستعمل هناك`() {
        val background = Contrast.over(PastelDeck[0], NightSurface)
        assertTrue(
            "لو صار مقروءًا فقد اختلطت اللوحتان",
            Contrast.ratio(PastelInkDeck[0], background) < Contrast.AA_NORMAL,
        )
    }

    /** الحارس المباشر ضدّ ما ظهر في الصورة. */
    @Test
    fun `الأبيض ليس مقروءًا على بطاقة الصلاة فلا يُختار`() {
        val cardBackground = Contrast.over(Gradients.Meadow.first(), SandSurface)
        assertTrue(
            "الأبيض على هذه الخلفية غير مقروء",
            Contrast.ratio(Color.White, cardBackground) < Contrast.AA_LARGE,
        )
        assertTrue(
            "فيجب أن يُختار الحبر الداكن",
            Contrast.readableOn(cardBackground) == Ink,
        )
    }
}
