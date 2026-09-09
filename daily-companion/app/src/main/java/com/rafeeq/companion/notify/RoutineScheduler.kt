package com.rafeeq.companion.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.rafeeq.companion.data.Routine
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * الروتينات: أوامر كاملة تُنفَّذ في وقتها بلا ضغطة.
 *
 * التذكير يقول لك «افعل»؛ الروتين يفعل. هذا الفرق هو سبب وجوده:
 * «كل يوم ٧ صباحًا اقرأ لي مهامي وخلّ الجوال على الاهتزاز» ينفَّذ وحده.
 */
object RoutineScheduler {

    private const val REQUEST_BASE = 41_000
    private const val MAX_SCHEDULED = 20

    const val EXTRA_ROUTINE_ID = "routine_id"
    const val EXTRA_ROUTINE_PROMPT = "routine_prompt"
    const val EXTRA_ROUTINE_LABEL = "routine_label"
    const val KIND_ROUTINE = "routine"

    fun reschedule(context: Context, routines: List<Routine>, zone: ZoneId) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        cancelAll(context, manager)

        val now = LocalDateTime.now(zone)
        routines.asSequence()
            .filter { it.enabled }
            .mapNotNull { routine -> nextFire(routine, now)?.let { routine to it } }
            .sortedBy { (_, at) -> at }
            .take(MAX_SCHEDULED)
            .forEachIndexed { index, (routine, at) ->
                val intent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra(PrayerScheduler.EXTRA_KIND, KIND_ROUTINE)
                    putExtra(EXTRA_ROUTINE_ID, routine.id)
                    putExtra(EXTRA_ROUTINE_PROMPT, routine.prompt)
                    putExtra(EXTRA_ROUTINE_LABEL, routine.label)
                }
                val pending = PendingIntent.getBroadcast(
                    context, REQUEST_BASE + index, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                val millis = at.atZone(zone).toInstant().toEpochMilli()
                runCatching {
                    val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
                        manager.canScheduleExactAlarms()
                    if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, pending)
                    else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, millis, pending)
                }
            }
    }

    /**
     * أقرب موعد قادم للروتين.
     *
     * الفخّ الذي يجب تفاديه: روتين محدّد بأيام معيّنة يجب أن يقفز إلى أقرب
     * يوم مطابق، لا أن يُجدول للغد ثم لا يعمل لأن الغد ليس من أيامه.
     */
    internal fun nextFire(routine: Routine, now: LocalDateTime): LocalDateTime? {
        val time = runCatching { LocalTime.parse(routine.time) }.getOrNull() ?: return null
        var candidate = LocalDateTime.of(now.toLocalDate(), time)
        if (!candidate.isAfter(now)) candidate = candidate.plusDays(1)

        if (routine.days.isEmpty()) return candidate

        var guard = 0
        while (candidate.dayOfWeek.value !in routine.days && guard++ < 8) {
            candidate = candidate.plusDays(1)
        }
        return candidate.takeIf { it.dayOfWeek.value in routine.days }
    }

    private fun cancelAll(context: Context, manager: AlarmManager) {
        for (code in REQUEST_BASE until REQUEST_BASE + MAX_SCHEDULED) {
            val pending = PendingIntent.getBroadcast(
                context, code, Intent(context, AlarmReceiver::class.java),
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            if (pending != null) {
                manager.cancel(pending)
                pending.cancel()
            }
        }
    }
}
