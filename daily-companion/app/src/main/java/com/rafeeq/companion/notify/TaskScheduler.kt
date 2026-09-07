package com.rafeeq.companion.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.rafeeq.companion.data.Task
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId

/**
 * تنبيهات المهام: يجدول إشعارًا لكل مهمة لها موعد.
 *
 * كان حقل التذكير موجودًا في نموذج المهمة لكنه لم يكن يُجدول شيئًا،
 * فكانت المواعيد تمرّ بلا تنبيه. هذا يغلق تلك الفجوة.
 */
object TaskScheduler {

    private const val REQUEST_BASE = 21_000
    private const val MAX_SCHEDULED = 40

    const val EXTRA_TASK_TITLE = "task_title"
    const val EXTRA_TASK_WHEN = "task_when"
    const val KIND_TASK = "task"

    /** يعيد جدولة كل المهام المستحقّة مستقبلًا. يُستدعى بعد أي تغيير في القائمة. */
    fun reschedule(context: Context, tasks: List<Task>, zone: ZoneId) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        cancelAll(context, manager)

        val now = LocalDateTime.now(zone)
        tasks.asSequence()
            .filter { !it.done }
            .mapNotNull { task -> dueAt(task)?.let { task to it } }
            // نطرح دقائق التذكير المسبق، ثم نتجاهل ما مضى وقته.
            .map { (task, due) -> task to due.minusMinutes(task.reminderMinutesBefore.toLong()) }
            .filter { (_, fireAt) -> fireAt.isAfter(now) }
            .sortedBy { (_, fireAt) -> fireAt }
            .take(MAX_SCHEDULED)
            .forEachIndexed { index, (task, fireAt) ->
                schedule(
                    context = context,
                    manager = manager,
                    requestCode = REQUEST_BASE + index,
                    atMillis = fireAt.atZone(zone).toInstant().toEpochMilli(),
                    title = task.title,
                    whenLabel = dueAt(task)?.toLocalTime()?.toString().orEmpty(),
                )
            }
    }

    /** الموعد الكامل للمهمة، أو null إن لم يكن لها تاريخ. */
    internal fun dueAt(task: Task): LocalDateTime? {
        val date = task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: return null
        val time = task.dueTime?.let { runCatching { LocalTime.parse(it) }.getOrNull() }
            // مهمة بتاريخ بلا وقت: نذكّر في التاسعة صباحًا بدل منتصف الليل.
            ?: LocalTime.of(9, 0)
        return LocalDateTime.of(date, time)
    }

    private fun schedule(
        context: Context,
        manager: AlarmManager,
        requestCode: Int,
        atMillis: Long,
        title: String,
        whenLabel: String,
    ) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(PrayerScheduler.EXTRA_KIND, KIND_TASK)
            putExtra(EXTRA_TASK_TITLE, title)
            putExtra(EXTRA_TASK_WHEN, whenLabel)
        }
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        runCatching {
            val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
            if (exact) manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
            else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
        }
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
