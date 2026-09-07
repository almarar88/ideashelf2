package com.rafeeq.companion

import com.rafeeq.companion.data.AppSettings
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.notify.TaskScheduler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * يحرس الإصلاحات التي تخصّ السرعة.
 *
 * أهمّها: البادئة الثابتة يجب ألّا تتغيّر بين طلب وآخر. أي شيء متغيّر بداخلها
 * يُبطل التخزين المؤقت للواجهة البرمجية فيُعاد معالجة آلاف الرموز في كل رسالة،
 * وهو ما كان يجعل الردود بطيئة.
 */
class PerformanceTest {

    private fun context(now: LocalDateTime) = Assistant.Context(
        userName = "أحمد",
        now = now,
        placeLabel = "الرياض",
        hijriDate = "١٥ رجب ١٤٤٧ هـ",
        gregorianDate = "الاثنين ٧ سبتمبر ٢٠٢٦",
        weather = null,
        prayers = null,
        tasks = emptyList(),
        habits = emptyList(),
        headlines = emptyList(),
        persona = "اختصر دائمًا",
        use24h = true,
    )

    @Test
    fun `stable system prompt does not change between requests`() {
        val early = Assistant.stableSystem(
            persona = context(LocalDateTime.of(2026, 9, 7, 6, 30)).persona,
            control = "",
        )
        val later = Assistant.stableSystem(
            persona = context(LocalDateTime.of(2026, 9, 7, 21, 45)).persona,
            control = "",
        )
        assertEquals("البادئة الثابتة يجب أن تتطابق تمامًا ليعمل التخزين المؤقت", early, later)
    }

    @Test
    fun `stable system prompt carries no volatile data`() {
        val prompt = Assistant.stableSystem(persona = "", control = "")
        listOf("06:30", "21:45", "الوقت الآن", "الطقس:", "الصلاة القادمة", "عناوين:").forEach {
            assertFalse("وجدنا بيانات متغيّرة داخل البادئة الثابتة: $it", prompt.contains(it))
        }
    }

    @Test
    fun `volatile day state lives in the context block instead`() {
        val block = Assistant.contextBlock(context(LocalDateTime.of(2026, 9, 7, 6, 30)))
        assertTrue(block.startsWith("<حالة_اليوم>"))
        assertTrue("الوقت يجب أن يكون هنا لا في البادئة", block.contains("06:30"))
        assertTrue(block.contains("الرياض"))
        assertTrue(block.trimEnd().endsWith("</حالة_اليوم>"))
    }

    @Test
    fun `context block changes with time while system prompt stays put`() {
        val morning = Assistant.contextBlock(context(LocalDateTime.of(2026, 9, 7, 6, 30)))
        val evening = Assistant.contextBlock(context(LocalDateTime.of(2026, 9, 7, 21, 45)))
        assertNotEquals("حالة اليوم يجب أن تتغيّر مع الوقت", morning, evening)
    }

    @Test
    fun `context block stays compact`() {
        val block = Assistant.contextBlock(
            context(LocalDateTime.of(2026, 9, 7, 6, 30)).copy(
                tasks = (1..40).map { Task(title = "مهمة رقم $it") },
            ),
        )
        // نقتصر على عدد محدود من المهام: السياق الطويل يبطئ كل رد.
        assertFalse("عدد المهام المرسلة غير محدود", block.contains("مهمة رقم 20"))
        assertTrue(block.contains("مهام مفتوحة (40)"))
    }

    // ---------------------------------------------------------- مستوى السرعة

    @Test
    fun `speed presets map to a model and effort`() {
        assertEquals("claude-haiku-4-5", ClaudeClient.ResponseSpeed.INSTANT.model)
        assertEquals("claude-sonnet-5", ClaudeClient.ResponseSpeed.FAST.model)
        assertEquals("claude-opus-5", ClaudeClient.ResponseSpeed.SMART.model)
        ClaudeClient.ResponseSpeed.entries.forEach {
            assertTrue(it.effort in setOf("low", "medium", "high"))
            assertTrue(it.arabic.isNotBlank())
            assertTrue(it.description.length > 20)
        }
    }

    @Test
    fun `unknown stored speed falls back to fast`() {
        assertEquals(ClaudeClient.ResponseSpeed.FAST, ClaudeClient.ResponseSpeed.from(null))
        assertEquals(ClaudeClient.ResponseSpeed.FAST, ClaudeClient.ResponseSpeed.from("NONSENSE"))
        assertEquals(ClaudeClient.ResponseSpeed.SMART, ClaudeClient.ResponseSpeed.from("SMART"))
    }

    // ---------------------------------------------------------- الإعدادات الابتدائية

    /**
     * القيمة الابتدائية لتدفّق الإعدادات كائن فارغ يُعرض ريثما تصل القراءة من القرص.
     * لا يجوز أن تبدو «جاهزة»، وإلا اتخذت الواجهة قرارًا بناءً عليها وهو خطأ —
     * وهذا ما كان يُظهر «أضِف المفتاح» رغم أن المفتاح محفوظ.
     */
    @Test
    fun `placeholder settings never look configured`() {
        val placeholder = AppSettings()
        assertFalse("الكائن الابتدائي يجب ألّا يبدو حاملًا لمفتاح", placeholder.hasApiKey)
        assertNull("ولا حاملًا لموقع", placeholder.place)
    }

    @Test
    fun `settings with a key are configured`() {
        assertTrue(AppSettings(apiKey = "sk-ant-test").hasApiKey)
        assertFalse(AppSettings(apiKey = "   ").hasApiKey)
    }

    // ---------------------------------------------------------- تذكير المهام

    @Test
    fun `task with date and time is due at that moment`() {
        val due = TaskScheduler.dueAt(Task(title = "اجتماع", dueDate = "2026-09-08", dueTime = "10:30"))
        assertEquals(LocalDateTime.of(2026, 9, 8, 10, 30), due)
    }

    @Test
    fun `task with only a date reminds in the morning not at midnight`() {
        val due = TaskScheduler.dueAt(Task(title = "فاتورة", dueDate = "2026-09-08"))
        assertEquals(LocalDateTime.of(2026, 9, 8, 9, 0), due)
    }

    @Test
    fun `task without a date has no reminder`() {
        assertNull(TaskScheduler.dueAt(Task(title = "شراء حليب")))
    }

    @Test
    fun `malformed dates do not crash scheduling`() {
        assertNull(TaskScheduler.dueAt(Task(title = "x", dueDate = "غدًا")))
        // تاريخ سليم ووقت تالف: نرجع لتذكير الصباح بدل الانهيار.
        assertEquals(
            LocalDateTime.of(2026, 9, 8, 9, 0),
            TaskScheduler.dueAt(Task(title = "x", dueDate = "2026-09-08", dueTime = "بعد الظهر")),
        )
    }
}
