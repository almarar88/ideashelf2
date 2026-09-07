package com.rafeeq.companion.notify

import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.WeatherBundle
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.roundToInt

/**
 * نصّ إشعار الموجز الصباحي.
 *
 * كان الإشعار يقول «الموجز جاهز» فقط، وهو طلب فتح لا معلومة.
 * هنا نبني سطرًا يغني عن الفتح: حرارة اليوم، تحذير مطر، وأقرب مهامك.
 *
 * كل شيء من الذاكرة المحلية — لا شبكة داخل مستقبِل التنبيه.
 */
object BriefText {

    /** فوق هذه النسبة نعتبر المطر متوقعًا بما يكفي لتغيير خطة الخروج. */
    const val RAIN_THRESHOLD = 50

    /** بعد يوم كامل تصبح بيانات الطقس المخزّنة غير جديرة بالتحذير. */
    private const val MAX_AGE_MS = 24L * 60 * 60 * 1000

    fun build(
        today: LocalDate,
        weather: WeatherBundle?,
        tasks: List<Task>,
        nowMillis: Long = System.currentTimeMillis(),
        zone: ZoneId = ZoneId.systemDefault(),
    ): String {
        val parts = mutableListOf<String>()

        val fresh = weather?.takeIf { nowMillis - it.fetchedAt <= MAX_AGE_MS }
        val day = fresh?.daily?.firstOrNull {
            Instant.ofEpochSecond(it.epochSeconds).atZone(zone).toLocalDate() == today
        } ?: fresh?.daily?.firstOrNull()

        if (day != null) {
            parts += "🌡️ ${day.min.roundToInt()}° إلى ${day.max.roundToInt()}°"
            if (day.precipitationProbability >= RAIN_THRESHOLD) {
                parts += "☔ احتمال المطر ${day.precipitationProbability}% — خذ مظلّتك"
            }
        }

        val due = tasks.asSequence()
            .filter { !it.done }
            .filter { it.dueDate == today.toString() }
            .sortedBy { it.dueTime ?: "99:99" }
            .toList()

        if (due.isNotEmpty()) {
            val titles = due.take(2).joinToString("، ") { it.title }
            parts += if (due.size > 2) "📌 ${due.size} مهام اليوم: $titles…" else "📌 $titles"
        }

        val overdue = tasks.count {
            !it.done && it.dueDate != null &&
                runCatching { LocalDate.parse(it.dueDate).isBefore(today) }.getOrDefault(false)
        }
        if (overdue > 0) parts += "⏳ $overdue متأخرة"

        return if (parts.isEmpty()) "افتح Alcode Ai لترى موجز يومك."
        else parts.joinToString("  ·  ")
    }
}
