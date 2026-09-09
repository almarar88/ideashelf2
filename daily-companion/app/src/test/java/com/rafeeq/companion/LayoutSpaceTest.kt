package com.rafeeq.companion

import androidx.compose.ui.unit.dp
import com.rafeeq.companion.ui.components.NavPillHeight
import com.rafeeq.companion.ui.components.NavPillMargin
import com.rafeeq.companion.ui.components.navSpaceFor
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * يحرس الخطأ الذي غطّى فيه الشريط العائم حقل الكتابة.
 *
 * السبب كان قيمة ثابتة (‎86dp‎) تكفي على أجهزة الإيماءات وتقصُر على أجهزة
 * الأزرار الثلاثة. القاعدة: المساحة المحجوزة يجب أن تتجاوز ما يشغله الشريط
 * فعلًا مهما كان ارتفاع أزرار النظام.
 */
class LayoutSpaceTest {

    /** ما يشغله الشريط من أسفل الشاشة عند ارتفاع أزرار نظام معيّن. */
    private fun barOccupies(inset: androidx.compose.ui.unit.Dp) =
        inset + NavPillMargin + NavPillHeight

    @Test
    fun `reserved space clears the bar on a gesture device`() {
        val inset = 0.dp
        assertTrue(
            "المساحة لا تكفي على جهاز الإيماءات",
            navSpaceFor(inset) > barOccupies(inset),
        )
    }

    /** الحالة التي كسرت فعلًا: أزرار تنقّل بارتفاع ‎48dp‎. */
    @Test
    fun `reserved space clears the bar on a three-button device`() {
        val inset = 48.dp
        assertTrue(
            "المساحة لا تكفي على جهاز الأزرار الثلاثة",
            navSpaceFor(inset) > barOccupies(inset),
        )
    }

    @Test
    fun `the old fixed value would have failed`() {
        val inset = 48.dp
        assertTrue(
            "القيمة الثابتة القديمة كانت أقل مما يشغله الشريط — وهذا هو الخطأ",
            86.dp < barOccupies(inset),
        )
    }

    @Test
    fun `taller system bars reserve proportionally more`() {
        assertTrue(navSpaceFor(64.dp) > navSpaceFor(24.dp))
        assertTrue(navSpaceFor(24.dp) > navSpaceFor(0.dp))
    }
}
