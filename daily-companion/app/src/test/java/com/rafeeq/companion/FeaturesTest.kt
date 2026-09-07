package com.rafeeq.companion

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.BackupBundle
import com.rafeeq.companion.data.DayForecast
import com.rafeeq.companion.data.DefaultShortcuts
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.Note
import com.rafeeq.companion.data.Place
import com.rafeeq.companion.data.Recurrence
import com.rafeeq.companion.data.Shortcut
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.WeatherNow
import com.rafeeq.companion.data.control.ToolCatalog
import com.rafeeq.companion.notify.BriefText
import com.rafeeq.companion.notify.HabitScheduler
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

/**
 * يغطّي المنطق المضاف في هذه الجولة: التكرار، تذكير العادات،
 * نصّ الموجز الصباحي، والنسخة الاحتياطية.
 */
class FeaturesTest {

    private val zone: ZoneId = ZoneId.of("Asia/Riyadh")

    // ------------------------------------------------------------- التكرار

    @Test
    fun `daily repeat moves to the next day`() {
        val today = LocalDate.now(zone)
        val task = Task(title = "دواء", dueDate = today.toString(), repeat = "daily")
        val next = Recurrence.next(task, zone)
        assertEquals(today.plusDays(1).toString(), next?.dueDate)
    }

    @Test
    fun `weekly and monthly advance by the right unit`() {
        val base = LocalDate.now(zone)
        assertEquals(
            base.plusWeeks(1).toString(),
            Recurrence.next(Task(title = "ت", dueDate = base.toString(), repeat = "weekly"), zone)?.dueDate,
        )
        assertEquals(
            base.plusMonths(1).toString(),
            Recurrence.next(Task(title = "ت", dueDate = base.toString(), repeat = "monthly"), zone)?.dueDate,
        )
    }

    @Test
    fun `a task without repeat generates nothing`() {
        assertNull(Recurrence.next(Task(title = "مرة واحدة"), zone))
        assertNull(Recurrence.next(Task(title = "غير معروف", repeat = "yearly"), zone))
    }

    /** الفخّ: مهمة يومية أُهملت أسبوعًا يجب ألّا تُولّد موعدًا في الماضي. */
    @Test
    fun `a long overdue repeat lands in the future`() {
        val today = LocalDate.now(zone)
        val stale = Task(title = "قديمة", dueDate = today.minusDays(30).toString(), repeat = "daily")
        val next = LocalDate.parse(Recurrence.next(stale, zone)!!.dueDate!!)
        assertFalse("النسخة التالية في الماضي: $next", next.isBefore(today))
    }

    @Test
    fun `the new occurrence is a separate unfinished task`() {
        val done = Task(title = "تمرين", dueDate = "2026-01-01", repeat = "weekly", done = true)
        val next = Recurrence.next(done, zone)!!
        assertNotEquals(done.id, next.id)
        assertFalse(next.done)
        assertNull(next.completedAt)
    }

    // ------------------------------------------------------- تذكير العادات

    @Test
    fun `a habit reminder later today fires today`() {
        val now = LocalDateTime.of(2026, 5, 1, 6, 0)
        val fire = HabitScheduler.nextFire(Habit(title = "قراءة", reminderTime = "21:30"), now)
        assertEquals(LocalDateTime.of(2026, 5, 1, 21, 30), fire)
    }

    @Test
    fun `a habit reminder already passed moves to tomorrow`() {
        val now = LocalDateTime.of(2026, 5, 1, 22, 0)
        val fire = HabitScheduler.nextFire(Habit(title = "قراءة", reminderTime = "21:30"), now)
        assertEquals(LocalDateTime.of(2026, 5, 2, 21, 30), fire)
    }

    @Test
    fun `habits without a valid time are not scheduled`() {
        val now = LocalDateTime.of(2026, 5, 1, 8, 0)
        assertNull(HabitScheduler.nextFire(Habit(title = "بلا"), now))
        assertNull(HabitScheduler.nextFire(Habit(title = "خطأ", reminderTime = "٢١:٣٠"), now))
    }

    // ---------------------------------------------------- الموجز الصباحي

    private fun weather(rainPercent: Int, ageMillis: Long = 0): WeatherBundle {
        val today = LocalDate.of(2026, 5, 1)
        return WeatherBundle(
            place = Place(name = "الرياض", latitude = 24.7, longitude = 46.7),
            now = WeatherNow(
                temperature = 30.0, feelsLike = 32.0, humidity = 20, windSpeed = 8.0,
                windDirection = 180, weatherCode = 0, isDay = true, precipitation = 0.0,
                pressure = 1010.0, cloudCover = 10,
            ),
            hourly = emptyList(),
            daily = listOf(
                DayForecast(
                    epochSeconds = today.atStartOfDay(ZoneOffset.UTC).toEpochSecond(),
                    weatherCode = 61, max = 33.0, min = 21.0,
                    sunriseEpoch = 0, sunsetEpoch = 0, uvIndex = 8.0,
                    precipitationProbability = rainPercent,
                ),
            ),
            fetchedAt = System.currentTimeMillis() - ageMillis,
        )
    }

    @Test
    fun `the brief warns about rain and lists today's tasks`() {
        val today = LocalDate.of(2026, 5, 1)
        val body = BriefText.build(
            today = today,
            weather = weather(80),
            tasks = listOf(
                Task(title = "اجتماع", dueDate = today.toString(), dueTime = "09:00"),
                Task(title = "منجزة", dueDate = today.toString(), done = true),
            ),
            zone = ZoneOffset.UTC,
        )
        assertTrue(body, body.contains("80%"))
        assertTrue(body, body.contains("مظلّتك"))
        assertTrue(body, body.contains("اجتماع"))
        assertFalse("المهمة المنجزة لا تُذكر", body.contains("منجزة"))
        assertTrue(body, body.contains("21°") && body.contains("33°"))
    }

    @Test
    fun `no rain warning below the threshold`() {
        val body = BriefText.build(
            today = LocalDate.of(2026, 5, 1),
            weather = weather(BriefText.RAIN_THRESHOLD - 1),
            tasks = emptyList(),
            zone = ZoneOffset.UTC,
        )
        assertFalse(body, body.contains("مظلّتك"))
    }

    /** الفخّ: طقس الأسبوع الماضي لا يصلح لتحذير اليوم. */
    @Test
    fun `stale weather is ignored`() {
        val body = BriefText.build(
            today = LocalDate.of(2026, 5, 1),
            weather = weather(90, ageMillis = 3L * 24 * 60 * 60 * 1000),
            tasks = emptyList(),
            zone = ZoneOffset.UTC,
        )
        assertFalse(body, body.contains("مظلّتك"))
        assertEquals("افتح Alcode Ai لترى موجز يومك.", body)
    }

    @Test
    fun `overdue tasks are counted`() {
        val today = LocalDate.of(2026, 5, 1)
        val body = BriefText.build(
            today = today,
            weather = null,
            tasks = listOf(
                Task(title = "متأخرة", dueDate = today.minusDays(2).toString()),
                Task(title = "غدًا", dueDate = today.plusDays(1).toString()),
            ),
            zone = ZoneOffset.UTC,
        )
        assertTrue(body, body.contains("1 متأخرة"))
        assertFalse("مهمة الغد ليست من مهام اليوم", body.contains("غدًا"))
    }

    // -------------------------------------------------- النسخة الاحتياطية

    @Test
    fun `a backup survives a round trip`() {
        val bundle = BackupBundle(
            tasks = listOf(Task(title = "مهمة", repeat = "daily", reminderMinutesBefore = 30)),
            habits = listOf(Habit(title = "ماء", reminderTime = "08:00")),
            notes = listOf(Note(body = "نص", pinned = true)),
            shortcuts = listOf(Shortcut(label = "قيادة", prompt = "شغّل بلوتوث")),
            userName = "أحمد",
        )
        val text = Net.json.encodeToString(BackupBundle.serializer(), bundle)
        val back = Net.json.decodeFromString(BackupBundle.serializer(), text)

        assertEquals(bundle.tasks, back.tasks)
        assertEquals(bundle.habits, back.habits)
        assertEquals(bundle.notes, back.notes)
        assertEquals(bundle.shortcuts, back.shortcuts)
        assertEquals("أحمد", back.userName)
    }

    /** المفتاح لا يجوز أن يخرج في ملف يُشارَك. */
    @Test
    fun `the backup carries no api key field`() {
        val text = Net.json.encodeToString(BackupBundle.serializer(), BackupBundle())
        assertFalse(text, text.contains("apiKey", ignoreCase = true))
    }

    // ------------------------------------------------------- الاختصارات

    @Test
    fun `default shortcuts are usable prompts`() {
        assertTrue(DefaultShortcuts.all.size >= 5)
        DefaultShortcuts.all.forEach {
            assertTrue("اختصار بلا اسم", it.label.isNotBlank())
            assertTrue("أمر قصير جدًا: ${it.label}", it.prompt.length >= 10)
            assertTrue("رمز مفقود: ${it.label}", it.emoji.isNotBlank())
        }
        assertEquals(
            "معرّفات الاختصارات يجب أن تكون فريدة",
            DefaultShortcuts.all.size,
            DefaultShortcuts.all.map { it.id }.toSet().size,
        )
    }

    // ----------------------------------------------------- أدوات المساعد

    @Test
    fun `app data tools are all registered in the catalog`() {
        val names = ToolCatalog.all.map { it.name }.toSet()
        ToolCatalog.appDataToolNames.forEach {
            assertTrue("أداة غير مسجّلة: $it", it in names)
        }
    }
}
