package com.rafeeq.companion

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.BackupBundle
import com.rafeeq.companion.data.Memory
import com.rafeeq.companion.data.Routine
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.control.ToolCatalog
import com.rafeeq.companion.notify.RoutineScheduler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

/**
 * الذاكرة والروتينات: المنطق الذي لا يظهر في الشاشة لكنه يقرّر سلوك المساعد.
 */
class MemoryRoutineTest {

    // ------------------------------------------------------ جدولة الروتين

    private fun routine(time: String, days: Set<Int> = emptySet()) =
        Routine(label = "صباح", prompt = "اقرأ مهامي", time = time, days = days)

    @Test
    fun `a daily routine later today fires today`() {
        val now = LocalDateTime.of(2026, 5, 4, 6, 0) // الاثنين
        assertEquals(
            LocalDateTime.of(2026, 5, 4, 7, 0),
            RoutineScheduler.nextFire(routine("07:00"), now),
        )
    }

    @Test
    fun `a daily routine already passed moves to tomorrow`() {
        val now = LocalDateTime.of(2026, 5, 4, 8, 0)
        assertEquals(
            LocalDateTime.of(2026, 5, 5, 7, 0),
            RoutineScheduler.nextFire(routine("07:00"), now),
        )
    }

    /**
     * الفخّ: روتين الجمعة فقط يجب أن يقفز إلى الجمعة القادمة،
     * لا أن يُجدول للغد ثم لا يعمل لأن الغد ليس من أيامه.
     */
    @Test
    fun `a routine limited to one weekday jumps to that day`() {
        val monday = LocalDateTime.of(2026, 5, 4, 9, 0)
        val fire = RoutineScheduler.nextFire(routine("17:00", days = setOf(5)), monday)!!
        assertEquals(java.time.DayOfWeek.FRIDAY, fire.dayOfWeek)
        assertEquals(LocalDateTime.of(2026, 5, 8, 17, 0), fire)
    }

    @Test
    fun `a routine on today's weekday still fires today when time remains`() {
        val monday = LocalDateTime.of(2026, 5, 4, 6, 0)
        val fire = RoutineScheduler.nextFire(routine("17:00", days = setOf(1)), monday)!!
        assertEquals(LocalDateTime.of(2026, 5, 4, 17, 0), fire)
    }

    @Test
    fun `an invalid time schedules nothing`() {
        val now = LocalDateTime.of(2026, 5, 4, 6, 0)
        assertNull(RoutineScheduler.nextFire(routine("٧:٠٠"), now))
        assertNull(RoutineScheduler.nextFire(routine("25:99"), now))
    }

    // ------------------------------------------------------------ الذاكرة

    @Test
    fun `memories reach the assistant context`() {
        val block = Assistant.contextBlock(
            Assistant.Context(
                userName = "أحمد",
                now = LocalDateTime.of(2026, 5, 4, 9, 0),
                placeLabel = "دبي",
                hijriDate = "١٥ رجب",
                gregorianDate = "الاثنين ٤ مايو",
                weather = null,
                prayers = null,
                tasks = emptyList(),
                habits = emptyList(),
                headlines = emptyList(),
                persona = "",
                use24h = true,
                memories = listOf("يصوم الاثنين والخميس", "يفضّل المواعيد بعد العصر"),
            ),
        )
        assertTrue(block.contains("يصوم الاثنين والخميس"))
        assertTrue(block.contains("يفضّل المواعيد بعد العصر"))
    }

    @Test
    fun `an empty memory list adds no line`() {
        val block = Assistant.contextBlock(
            Assistant.Context(
                userName = "", now = LocalDateTime.of(2026, 5, 4, 9, 0), placeLabel = "",
                hijriDate = "", gregorianDate = "", weather = null, prayers = null,
                tasks = emptyList(), habits = emptyList(), headlines = emptyList(),
                persona = "", use24h = true,
            ),
        )
        assertFalse(block.contains("تعرف عنه"))
    }

    /** كتابة المفاتيح السرية في ملف نصّي عادي خطر — الوصف يجب أن يمنعها. */
    @Test
    fun `the memory tool forbids storing secrets`() {
        val spec = ToolCatalog.byName("remember_fact")
        assertNotNull(spec)
        assertTrue(
            "وصف الأداة يجب أن يمنع حفظ كلمات المرور",
            spec!!.description.contains("كلمات مرور"),
        )
    }

    @Test
    fun `memory and routine tools are app-data tools, not phone tools`() {
        listOf(
            "remember_fact", "recall_facts", "forget_fact",
            "add_routine", "read_routines", "delete_routine",
        ).forEach {
            assertTrue("$it يجب أن يُنفَّذ على مخازن التطبيق", it in ToolCatalog.appDataToolNames)
            assertNotNull("$it غير مسجّلة في الفهرس", ToolCatalog.byName(it))
        }
    }

    // -------------------------------------------------- النسخة الاحتياطية

    @Test
    fun `backup carries memories and routines`() {
        val bundle = BackupBundle(
            memories = listOf(Memory(text = "يحب القهوة بلا سكر", category = "تفضيل")),
            routines = listOf(routine("07:00", setOf(1, 3, 5))),
        )
        val text = Net.json.encodeToString(BackupBundle.serializer(), bundle)
        val back = Net.json.decodeFromString(BackupBundle.serializer(), text)

        assertEquals(bundle.memories, back.memories)
        assertEquals(bundle.routines, back.routines)
        assertEquals(setOf(1, 3, 5), back.routines.first().days)
    }

    /** ملف من إصدار قديم يجب أن يبقى مقروءًا بعد إضافة الحقول الجديدة. */
    @Test
    fun `an older backup without the new fields still loads`() {
        val old = """{"version":1,"createdAt":0,"userName":"أحمد"}"""
        val back = Net.json.decodeFromString(BackupBundle.serializer(), old)
        assertEquals("أحمد", back.userName)
        assertTrue(back.memories.isEmpty())
        assertTrue(back.routines.isEmpty())
    }
}
