package com.rafeeq.companion

import com.rafeeq.companion.data.AzkarProgress
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/**
 * تقدّم الأذكار محفوظ ليوم واحد.
 *
 * الشرطان متضادّان ظاهريًا: أن يصمد العدّ أمام مكالمة تقطع القراءة، وألّا
 * تُفتح أذكار الصباح غدًا وهي نصف مقروءة. الحدّ الفاصل هو التاريخ، وهذه
 * الاختبارات تثبّته من الجهتين.
 */
class AzkarProgressTest {

    private val today = LocalDate.of(2026, 3, 10)

    @Test
    fun `تقدّم اليوم نفسه يبقى`() {
        val stored = AzkarProgress(day = "2026-03-10", counts = mapOf("a" to 3), tasbih = 7)
        val result = AzkarProgress.forToday(stored, today)
        assertEquals(3, result.counts["a"])
        assertEquals(7, result.tasbih)
    }

    @Test
    fun `تقدّم الأمس يُمحى كاملًا`() {
        val stored = AzkarProgress(day = "2026-03-09", counts = mapOf("a" to 3), tasbih = 7, rounds = 2)
        val result = AzkarProgress.forToday(stored, today)
        assertEquals("2026-03-10", result.day)
        assertTrue("العدّاد يُصفَّر", result.counts.isEmpty())
        assertEquals(0, result.tasbih)
        assertEquals(0, result.rounds)
    }

    @Test
    fun `لا تقدّم محفوظ يعطي يومًا نظيفًا لا انهيارًا`() {
        val result = AzkarProgress.forToday(null, today)
        assertEquals("2026-03-10", result.day)
        assertTrue(result.counts.isEmpty())
    }

    /** المفتاح يتبع النصّ لا موضعه، فإعادة ترتيب القائمة لا تخلط الأعداد. */
    @Test
    fun `المفتاح ثابت للنصّ ويختلف باختلاف التبويب`() {
        val a = AzkarProgress.keyOf("الصباح", "سبحان الله")
        val b = AzkarProgress.keyOf("الصباح", "سبحان الله")
        val c = AzkarProgress.keyOf("المساء", "سبحان الله")
        val d = AzkarProgress.keyOf("الصباح", "الحمد لله")
        assertEquals(a, b)
        assertNotEquals("ذكرٌ في تبويبين عدّادان مستقلّان", a, c)
        assertNotEquals("ذكران مختلفان عدّادان مستقلّان", a, d)
    }
}
