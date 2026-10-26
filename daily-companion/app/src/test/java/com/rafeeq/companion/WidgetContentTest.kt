package com.rafeeq.companion

import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.PrayerConfig
import com.rafeeq.companion.data.prayer.PrayerTimes
import com.rafeeq.companion.widget.WidgetContent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * محتوى مربّع الشاشة الرئيسية.
 *
 * الودجة نفسها تعمل في عملية المشغّل ولا تُشغَّل في اختبار، فكل ما يمكن أن
 * يخطئ وُضع في دالّة خالصة وفُحص هنا: الانتقال إلى فجر الغد بعد العشاء،
 * والعدّ التنازلي، وحالة «لا مدينة»، وجمع العربية.
 */
class WidgetContentTest {

    private val dubai = ZoneId.of("Asia/Dubai")
    private val config = PrayerConfig(
        method = CalculationMethod.UMM_AL_QURA,
        asrMethod = AsrMethod.STANDARD,
    )

    private fun prayers(date: LocalDate) = PrayerTimes.calculate(
        date = date, latitude = 25.2048, longitude = 55.2708,
        zone = dubai, config = config,
    )

    /**
     * بعد العشاء لا تفرغ الودجة.
     *
     * `DayPrayers.next` يفحص يومًا واحدًا فيعيد null بعد آخر صلاة. بلا
     * الانتقال إلى الغد يصير المربّع فارغًا كل ليلة من العشاء حتى منتصف
     * الليل. نفس العطل ظهر في نسخة ويندوز ووُجد بتشغيلها ليلًا لا بقراءتها.
     */
    @Test
    fun `بعد العشاء تُعرض صلاة الغد لا فراغ`() {
        val today = LocalDate.of(2026, 3, 10)
        val night = today.atTime(23, 30)
        val view = WidgetContent.build(
            prayers = prayers(today),
            tomorrow = prayers(today.plusDays(1)),
            tasks = emptyList(), habits = emptyList(), now = night,
        )
        assertTrue("يجب أن يُعرض شيء بعد العشاء", view.configured)
        assertEquals("الفجر", view.prayerName)
        assertTrue("العدّاد يشير إلى ساعات قادمة", view.countdown.startsWith("بعد"))
    }

    @Test
    fun `قبل الفجر تُعرض صلاة اليوم نفسه`() {
        val today = LocalDate.of(2026, 3, 10)
        val view = WidgetContent.build(
            prayers = prayers(today), tomorrow = prayers(today.plusDays(1)),
            tasks = emptyList(), habits = emptyList(), now = today.atTime(3, 0),
        )
        assertEquals("الفجر", view.prayerName)
    }

    @Test
    fun `الشروق ليس صلاة فلا يُعرض كصلاة قادمة`() {
        val today = LocalDate.of(2026, 3, 10)
        val day = prayers(today)
        val afterFajr = day[com.rafeeq.companion.data.prayer.Prayer.FAJR].plusMinutes(5)
        val view = WidgetContent.build(
            prayers = day, tomorrow = prayers(today.plusDays(1)),
            tasks = emptyList(), habits = emptyList(), now = afterFajr,
        )
        assertEquals("الظهر", view.prayerName)
    }

    @Test
    fun `بلا مدينة يُطلب الضبط لا يُعرض وقت خاطئ`() {
        val view = WidgetContent.build(
            prayers = null, tomorrow = null,
            tasks = emptyList(), habits = emptyList(),
            now = LocalDateTime.of(2026, 3, 10, 9, 0),
        )
        assertFalse(view.configured)
        assertEquals("اضبط مدينتك", view.prayerName)
        assertEquals("", view.prayerTime)
    }

    @Test
    fun `العدّ التنازلي بالعربية وبلا ثوانٍ`() {
        assertEquals("بعد 6 س 11 د", WidgetContent.countdown(Duration.ofMinutes(371)))
        assertEquals("بعد 2 س", WidgetContent.countdown(Duration.ofHours(2)))
        assertEquals("بعد 9 د", WidgetContent.countdown(Duration.ofMinutes(9)))
        assertEquals("بعد أقل من دقيقة", WidgetContent.countdown(Duration.ofSeconds(30)))
        assertEquals("الآن", WidgetContent.countdown(Duration.ZERO))
        // وقتٌ مضى: يُقال «الآن» لا عددٌ سالب
        assertEquals("الآن", WidgetContent.countdown(Duration.ofMinutes(-5)))
    }

    @Test
    fun `سطر الملخّص يعدّ المستحقّ اليوم ويجمع بالعربية`() {
        val today = LocalDate.of(2026, 3, 10)
        val key = today.toString()
        val tasks = listOf(
            Task(title = "أ", dueDate = key),
            Task(title = "ب", dueDate = key),
            Task(title = "ج", dueDate = "2026-03-01"),          // متأخّرة: تُعدّ
            Task(title = "د", dueDate = "2026-12-01"),          // لاحقة: لا تُعدّ
            Task(title = "هـ", dueDate = key, done = true),     // منجزة: لا تُعدّ
        )
        val habits = listOf(
            Habit(title = "ماء", targetPerDay = 8, log = mapOf(key to 8)),
            Habit(title = "قراءة", targetPerDay = 1, log = emptyMap()),
        )
        val line = WidgetContent.summaryLine(tasks, habits, today)
        assertEquals("3 مهام · عادات 1 من 2", line)
    }

    @Test
    fun `لا شيء مستحقّ يعني سطرًا فارغًا لا صفرًا`() {
        val today = LocalDate.of(2026, 3, 10)
        assertEquals("", WidgetContent.summaryLine(emptyList(), emptyList(), today))
    }

    @Test
    fun `المهمة بلا موعد مستحقّة اليوم`() {
        val today = LocalDate.of(2026, 3, 10)
        val line = WidgetContent.summaryLine(
            listOf(Task(title = "بلا موعد")), emptyList(), today,
        )
        assertEquals("مهمة واحدة", line)
    }

    @Test
    fun `نظام ١٢ ساعة يضيف صباحًا ومساءً`() {
        val today = LocalDate.of(2026, 3, 10)
        val view = WidgetContent.build(
            prayers = prayers(today), tomorrow = prayers(today.plusDays(1)),
            tasks = emptyList(), habits = emptyList(),
            now = today.atTime(3, 0), use24h = false,
        )
        assertTrue("صيغة ١٢ ساعة تنتهي بـ ص أو م", view.prayerTime.endsWith(" ص"))
    }
}
