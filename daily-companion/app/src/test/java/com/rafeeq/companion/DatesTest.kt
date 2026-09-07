package com.rafeeq.companion

import com.rafeeq.companion.core.Dates
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime

class DatesTest {

    @Test
    fun `hijri conversion matches known umm al qura dates`() {
        // مراجع منشورة: ١ محرّم ١٤٤٧ هـ = ٢٦ يونيو ٢٠٢٥ م.
        val newYear1447 = Dates.toHijri(LocalDate.of(2025, 6, 26))
        assertEquals(1447, newYear1447.year)
        assertEquals(0, newYear1447.month)
        assertEquals(1, newYear1447.day)

        // ١ رمضان ١٤٤٧ هـ = ١٨ فبراير ٢٠٢٦ م.
        val ramadan = Dates.toHijri(LocalDate.of(2026, 2, 18))
        assertEquals(1447, ramadan.year)
        assertEquals(8, ramadan.month)
        assertEquals(1, ramadan.day)
        assertTrue(Dates.isRamadan(LocalDate.of(2026, 2, 18)))
    }

    @Test
    fun `hijri offset shifts the resulting date`() {
        val base = Dates.toHijri(LocalDate.of(2026, 6, 20))
        val shifted = Dates.toHijri(LocalDate.of(2026, 6, 20), dayOffset = 1)
        assertEquals(base.day + 1, shifted.day)
    }

    @Test
    fun `hijri month index always maps to a real month name`() {
        var date = LocalDate.of(2026, 1, 1)
        repeat(400) {
            val h = Dates.toHijri(date)
            assertTrue("فهرس شهر خارج المدى: ${h.month}", h.month in 0..11)
            // لا يجوز أن يرمي استثناء عند التنسيق.
            Dates.longHijriAr(date)
            date = date.plusDays(1)
        }
    }

    @Test
    fun `weekday names align with the gregorian calendar`() {
        // ٧ سبتمبر ٢٠٢٦ يوافق يوم الاثنين.
        assertEquals("الاثنين", Dates.weekdayAr(LocalDate.of(2026, 9, 7)))
        assertEquals("الأحد", Dates.weekdayAr(LocalDate.of(2026, 9, 6)))
        assertEquals("السبت", Dates.weekdayAr(LocalDate.of(2026, 9, 5)))
    }

    @Test
    fun `time formatting respects 12 and 24 hour modes`() {
        assertEquals("14:05", Dates.formatTime(LocalTime.of(14, 5), use24h = true))
        assertEquals("2:05 م", Dates.formatTime(LocalTime.of(14, 5), use24h = false))
        assertEquals("9:07 ص", Dates.formatTime(LocalTime.of(9, 7), use24h = false))
        assertEquals("12:00 م", Dates.formatTime(LocalTime.of(12, 0), use24h = false))
        assertEquals("12:30 ص", Dates.formatTime(LocalTime.of(0, 30), use24h = false))
    }

    @Test
    fun `arabic duration uses correct dual and plural forms`() {
        assertEquals("الآن", Dates.humanDuration(Duration.ZERO))
        assertEquals("1 دقيقة", Dates.humanDuration(Duration.ofMinutes(1)))
        assertEquals("2 دقيقتين", Dates.humanDuration(Duration.ofMinutes(2)))
        assertEquals("5 دقائق", Dates.humanDuration(Duration.ofMinutes(5)))
        assertEquals("1 ساعة", Dates.humanDuration(Duration.ofHours(1)))
        assertEquals("2 ساعتين", Dates.humanDuration(Duration.ofHours(2)))
        assertEquals("2 ساعتين و15 دقيقة", Dates.humanDuration(Duration.ofMinutes(135)))
    }

    @Test
    fun `clock duration is zero padded and never negative`() {
        assertEquals("01:23:45", Dates.clockDuration(Duration.ofSeconds(5025)))
        assertEquals("00:00:00", Dates.clockDuration(Duration.ofSeconds(-90)))
    }

    @Test
    fun `relative past reads naturally`() {
        val now = 1_757_000_000_000L
        assertEquals("الآن", Dates.relativePast(now - 10_000, now))
        assertEquals("قبل 5 دقائق", Dates.relativePast(now - 5 * 60_000, now))
        assertEquals("قبل 3 ساعات", Dates.relativePast(now - 3 * 3_600_000, now))
        assertEquals("قبل 2 يومين", Dates.relativePast(now - 2 * 86_400_000L, now))
    }

    @Test
    fun `greeting covers every hour of the day`() {
        (0..23).forEach { hour ->
            assertTrue("لا توجد تحية للساعة $hour", Dates.greeting(hour).isNotBlank())
        }
    }
}
