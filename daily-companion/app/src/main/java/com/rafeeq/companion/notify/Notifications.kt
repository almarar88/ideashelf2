package com.rafeeq.companion.notify

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.rafeeq.companion.MainActivity
import com.rafeeq.companion.R
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.SettingsRepository
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerTimes
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime

object Channels {
    const val PRAYER = "prayer_times"
    const val PRE_PRAYER = "pre_prayer"
    const val BRIEF = "daily_brief"
    const val TASKS = "task_reminders"

    fun ensure(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return

        val adhanAttributes = AudioAttributes.Builder()
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
            .build()

        manager.createNotificationChannel(
            NotificationChannel(PRAYER, "أوقات الصلاة", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "تنبيه عند دخول وقت كل صلاة"
                enableVibration(true)
                setSound(
                    RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
                    adhanAttributes,
                )
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(PRE_PRAYER, "تنبيه قبل الأذان", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "تذكير قبل دخول وقت الصلاة بعدة دقائق"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(BRIEF, "الموجز اليومي", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "ملخّص يومك في الصباح"
            },
        )
        manager.createNotificationChannel(
            NotificationChannel(TASKS, "تذكير المهام", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "تنبيه عند اقتراب موعد مهمة"
            },
        )
    }
}

object Notifier {

    fun canPost(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun show(context: Context, id: Int, channel: String, title: String, body: String, big: Boolean = false) {
        if (!canPost(context)) return
        Channels.ensure(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pending = PendingIntent.getActivity(
            context, id, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)

        if (big) builder.setStyle(NotificationCompat.BigTextStyle().bigText(body))

        runCatching { NotificationManagerCompat.from(context).notify(id, builder.build()) }
    }
}

/** يجدول تنبيهات الصلاة لليوم الحالي والتالي. */
object PrayerScheduler {

    private const val REQUEST_BASE = 7000
    const val EXTRA_PRAYER = "prayer_key"
    const val EXTRA_KIND = "kind"
    const val KIND_ADHAN = "adhan"
    const val KIND_PRE = "pre"
    const val KIND_BRIEF = "brief"

    fun rescheduleAll(context: Context) {
        val repo = SettingsRepository(context.applicationContext)
        val settings = runCatching { runBlocking { repo.settings.first() } }.getOrNull() ?: return
        val place = settings.place ?: return
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        val zone = runCatching { ZoneId.of(place.timezone) }.getOrElse { ZoneId.systemDefault() }
        val now = ZonedDateTime.now(zone)

        cancelAll(context, manager)

        // نجدول اليوم والغد لضمان استمرار التنبيهات حتى لو لم يُفتح التطبيق.
        listOf(LocalDate.now(zone), LocalDate.now(zone).plusDays(1)).forEachIndexed { dayIndex, date ->
            val day = PrayerTimes.calculate(
                date = date,
                latitude = place.latitude,
                longitude = place.longitude,
                zone = zone,
                config = settings.prayerConfig,
                hijriOffset = settings.hijriOffset,
            )
            Prayer.entries.filter { it.isObligatory }.forEachIndexed { index, prayer ->
                if (prayer.key !in settings.prayerNotifications) return@forEachIndexed
                val time = day[prayer].atZone(zone)
                if (time.isAfter(now)) {
                    schedule(
                        context, manager,
                        requestCode = REQUEST_BASE + dayIndex * 20 + index * 2,
                        atMillis = time.toInstant().toEpochMilli(),
                        prayerKey = prayer.key,
                        kind = KIND_ADHAN,
                    )
                }
                if (settings.preAdhanMinutes > 0) {
                    val pre = time.minusMinutes(settings.preAdhanMinutes.toLong())
                    if (pre.isAfter(now)) {
                        schedule(
                            context, manager,
                            requestCode = REQUEST_BASE + dayIndex * 20 + index * 2 + 1,
                            atMillis = pre.toInstant().toEpochMilli(),
                            prayerKey = prayer.key,
                            kind = KIND_PRE,
                        )
                    }
                }
            }
        }

        if (settings.briefNotification) {
            var brief = now.withHour(settings.briefHour).withMinute(0).withSecond(0).withNano(0)
            if (!brief.isAfter(now)) brief = brief.plusDays(1)
            schedule(
                context, manager,
                requestCode = REQUEST_BASE + 90,
                atMillis = brief.toInstant().toEpochMilli(),
                prayerKey = "",
                kind = KIND_BRIEF,
            )
        }
    }

    private fun schedule(
        context: Context,
        manager: AlarmManager,
        requestCode: Int,
        atMillis: Long,
        prayerKey: String,
        kind: String,
    ) {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra(EXTRA_PRAYER, prayerKey)
            putExtra(EXTRA_KIND, kind)
        }
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        runCatching {
            val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager.canScheduleExactAlarms()
            if (exact) {
                manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
            } else {
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMillis, pending)
            }
        }
    }

    private fun cancelAll(context: Context, manager: AlarmManager) {
        for (code in REQUEST_BASE until REQUEST_BASE + 100) {
            val intent = Intent(context, AlarmReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                context, code, intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE,
            )
            if (pending != null) {
                manager.cancel(pending)
                pending.cancel()
            }
        }
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val kind = intent.getStringExtra(PrayerScheduler.EXTRA_KIND) ?: return
        val key = intent.getStringExtra(PrayerScheduler.EXTRA_PRAYER).orEmpty()
        val prayer = Prayer.entries.firstOrNull { it.key == key }

        when (kind) {
            PrayerScheduler.KIND_ADHAN -> if (prayer != null) {
                Notifier.show(
                    context, id = 100 + prayer.ordinal, channel = Channels.PRAYER,
                    title = "حان الآن وقت ${prayer.arabic}",
                    body = "حيّ على الصلاة، حيّ على الفلاح.",
                )
            }
            PrayerScheduler.KIND_PRE -> if (prayer != null) {
                Notifier.show(
                    context, id = 200 + prayer.ordinal, channel = Channels.PRE_PRAYER,
                    title = "اقترب وقت ${prayer.arabic}",
                    body = "استعد للصلاة.",
                )
            }
            TaskScheduler.KIND_TASK -> {
                val title = intent.getStringExtra(TaskScheduler.EXTRA_TASK_TITLE).orEmpty()
                val at = intent.getStringExtra(TaskScheduler.EXTRA_TASK_WHEN).orEmpty()
                if (title.isNotBlank()) {
                    Notifier.show(
                        context,
                        id = 400 + title.hashCode().and(0xFF),
                        channel = Channels.TASKS,
                        title = "تذكير بمهمة",
                        body = if (at.isBlank()) title else "$title — $at",
                        big = true,
                    )
                }
            }

            HabitScheduler.KIND_HABIT -> {
                val title = intent.getStringExtra(HabitScheduler.EXTRA_HABIT_TITLE).orEmpty()
                val emoji = intent.getStringExtra(HabitScheduler.EXTRA_HABIT_EMOJI).orEmpty()
                if (title.isNotBlank()) {
                    Notifier.show(
                        context,
                        id = 500 + title.hashCode().and(0xFF),
                        channel = Channels.TASKS,
                        title = "$emoji وقت: $title",
                        body = "دقيقة واحدة الآن تحفظ السلسلة.",
                    )
                }
            }

            PrayerScheduler.KIND_BRIEF -> {
                val today = LocalDate.now()
                // نبني سطرًا مفيدًا من البيانات المخزّنة بدل «الموجز جاهز».
                val body = runCatching {
                    val app = context.applicationContext as com.rafeeq.companion.RafeeqApp
                    kotlinx.coroutines.runBlocking {
                        BriefText.build(
                            today = today,
                            weather = app.repos.weatherCache.load(),
                            tasks = app.repos.tasks.load(),
                        )
                    }
                }.getOrElse { "افتح Alcode Ai لترى موجز يومك." }

                Notifier.show(
                    context, id = 300, channel = Channels.BRIEF,
                    title = "${Dates.greeting(java.time.LocalTime.now().hour)} — ${Dates.weekdayAr(today)} 👋",
                    body = body,
                    big = true,
                )
            }
        }
        // نعيد الجدولة بعد كل تنبيه لضمان استمرارية السلسلة.
        runCatching { PrayerScheduler.rescheduleAll(context) }
        if (kind == HabitScheduler.KIND_HABIT) {
            // تذكير العادة يومي، فنعيد جدولته لليوم التالي فور إطلاقه.
            runCatching {
                val app = context.applicationContext as? com.rafeeq.companion.RafeeqApp
                    ?: return@runCatching
                kotlinx.coroutines.runBlocking {
                    HabitScheduler.reschedule(
                        context, app.repos.habits.load(), java.time.ZoneId.systemDefault(),
                    )
                }
            }
        }
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        runCatching { PrayerScheduler.rescheduleAll(context) }
        // تنبيهات المهام تُمسح عند إعادة التشغيل، فنعيد بناءها من الملف مباشرة.
        runCatching {
            val app = context.applicationContext as? com.rafeeq.companion.RafeeqApp ?: return@runCatching
            kotlinx.coroutines.runBlocking {
                val zone = java.time.ZoneId.systemDefault()
                TaskScheduler.reschedule(context, app.repos.tasks.load(), zone)
                HabitScheduler.reschedule(context, app.repos.habits.load(), zone)
            }
        }
    }
}
