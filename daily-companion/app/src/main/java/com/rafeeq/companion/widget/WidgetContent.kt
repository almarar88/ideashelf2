package com.rafeeq.companion.widget

import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.prayer.DayPrayers
import com.rafeeq.companion.data.prayer.Prayer
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * نصوص مربّع الشاشة الرئيسية.
 *
 * منفصلة عن RemoteViews عمدًا: الودجة تعمل في عملية المشغّل، ولا سبيل
 * لتشغيلها في اختبار وحدة. أمّا هذا فحسابٌ خالص بلا أندرويد، فيُختبر كاملًا —
 * وهو موضع كل المنطق الذي يمكن أن يخطئ: انقلاب اليوم بعد العشاء، العدّ
 * التنازلي عبر منتصف الليل، وحالة «لا مدينة بعد».
 *
 * الودجة لا تفتح شبكة أبدًا: أوقات الصلاة تُحسب فلكيًا، والمهام والعادات
 * من القرص. مربّعٌ يحتاج إنترنت ليعرض وقت الفجر مربّعٌ فارغ في الطائرة.
 */
object WidgetContent {

    private val hour24 = DateTimeFormatter.ofPattern("HH:mm")
    private val hour12 = DateTimeFormatter.ofPattern("h:mm")

    data class View(
        /** «الفجر» أو «الظهر»… أو رسالة الحالة حين لا مدينة. */
        val prayerName: String,
        /** «05:04» أو «5:04 ص»، فارغ حين لا مدينة. */
        val prayerTime: String,
        /** «بعد ٦ س ١١ د» أو «الآن». */
        val countdown: String,
        /** «٣ مهام · عادتان من ٤» — سطر واحد يغني عن الفتح. */
        val summary: String,
        /** هل ثمّة ما يُعرض أصلًا، أم على المستخدم ضبط مدينته؟ */
        val configured: Boolean,
    )

    fun build(
        prayers: DayPrayers?,
        tomorrow: DayPrayers?,
        tasks: List<Task>,
        habits: List<Habit>,
        now: LocalDateTime,
        use24h: Boolean = true,
    ): View {
        val summary = summaryLine(tasks, habits, now.toLocalDate())

        val upcoming = upcoming(prayers, tomorrow, now)
            ?: return View(
                prayerName = "اضبط مدينتك",
                prayerTime = "",
                countdown = "لعرض أوقات الصلاة",
                summary = summary,
                configured = false,
            )

        val (prayer, at) = upcoming
        return View(
            prayerName = prayer.arabic,
            prayerTime = at.format(if (use24h) hour24 else hour12) +
                if (use24h) "" else if (at.hour < 12) " ص" else " م",
            countdown = countdown(Duration.between(now, at)),
            summary = summary,
            configured = true,
        )
    }

    /**
     * الصلاة القادمة، ولو كانت فجر الغد.
     *
     * `DayPrayers.next` يفحص يومًا واحدًا فيعيد null بعد العشاء. بلا الانتقال
     * إلى الغد تُفرَّغ الودجة كل ليلة من العشاء حتى منتصف الليل — وهي ساعات
     * يُنظر فيها إلى الشاشة كثيرًا. نفس العطل أُصلح في نسخة ويندوز.
     */
    fun upcoming(
        today: DayPrayers?,
        tomorrow: DayPrayers?,
        now: LocalDateTime,
    ): Pair<Prayer, LocalDateTime>? {
        today?.next(now)?.let { return it }
        val fajr = tomorrow?.get(Prayer.FAJR) ?: return null
        return Prayer.FAJR to fajr
    }

    /** «بعد ٦ س ١١ د» — بالعربية وبلا ثوانٍ: الودجة تُحدَّث كل دقيقة لا كل ثانية. */
    fun countdown(left: Duration): String {
        if (left.isNegative || left.isZero) return "الآن"
        val totalMinutes = left.toMinutes()
        if (totalMinutes < 1) return "بعد أقل من دقيقة"
        val hours = totalMinutes / 60
        val minutes = totalMinutes % 60
        return when {
            hours > 0 && minutes > 0 -> "بعد $hours س $minutes د"
            hours > 0 -> "بعد $hours س"
            else -> "بعد $minutes د"
        }
    }

    /** سطر المهام والعادات؛ فارغ حين لا شيء مستحقّ — لا «٠ مهام». */
    fun summaryLine(tasks: List<Task>, habits: List<Habit>, today: LocalDate): String {
        val key = today.toString()
        val open = tasks.count { !it.done && (it.dueDate == null || it.dueDate <= key) }
        val doneHabits = habits.count { (it.log[key] ?: 0) >= it.targetPerDay }

        val parts = mutableListOf<String>()
        if (open > 0) parts += plural(open, "مهمة", "مهمّتان", "مهام")
        if (habits.isNotEmpty()) parts += "عادات $doneHabits من ${habits.size}"
        return parts.joinToString(" · ")
    }

    /** العربية تثنّي وتجمع؛ «3 مهمة» خطأ يراه المستخدم كل يوم. */
    private fun plural(count: Int, one: String, two: String, many: String): String = when {
        count == 1 -> "$one واحدة"
        count == 2 -> two
        count in 3..10 -> "$count $many"
        else -> "$count $one"
    }
}
