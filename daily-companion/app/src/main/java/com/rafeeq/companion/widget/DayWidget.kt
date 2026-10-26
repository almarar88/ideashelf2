package com.rafeeq.companion.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import com.rafeeq.companion.MainActivity
import com.rafeeq.companion.R
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.JsonListStore
import com.rafeeq.companion.data.SettingsRepository
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.prayer.PrayerTimes
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * مربّع الشاشة الرئيسية: الصلاة القادمة ومهام اليوم.
 *
 * الغاية ألّا يُفتح التطبيق أصلًا للسؤال الذي يتكرّر عشر مرّات يوميًا: كم بقي
 * على الصلاة، وماذا بقي عليّ اليوم. كل ذلك من القرص والحساب الفلكي، بلا
 * شبكة — فالودجة تعمل في الطائرة وفي النفق.
 *
 * `goAsync` ضرورية: قراءة DataStore معلّقة، وبدونها يعود البثّ قبل أن تصل
 * البيانات فيُرسم مربّع فارغ.
 */
class DayWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        manager: AppWidgetManager,
        ids: IntArray,
    ) = refresh(context, manager, ids)

    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        WidgetRefresher.schedule(context)
    }

    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        WidgetRefresher.cancel(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(componentOf(context))
            // بلا مربّع على الشاشة لا تحديث ولا جدولة: السلسلة كانت تستمرّ
            // إلى الأبد حتى بعد إزالة المربّع، فتوقظ التطبيق بلا مستفيد.
            if (ids.isEmpty()) {
                WidgetRefresher.cancel(context)
                return
            }
            refresh(context, manager, ids)
            WidgetRefresher.schedule(context)
        }
    }

    private fun refresh(context: Context, manager: AppWidgetManager, ids: IntArray) {
        if (ids.isEmpty()) return
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val views = render(context)
                ids.forEach { manager.updateAppWidget(it, views) }
            } catch (error: Throwable) {
                // مربّع قديم أفضل من مربّع فارغ، والانهيار هنا يُسقط المشغّل.
                android.util.Log.w("DayWidget", "تعذّر تحديث الودجة", error)
            } finally {
                pending.finish()
            }
        }
    }

    private suspend fun render(context: Context): RemoteViews {
        val app = context.applicationContext
        /*
         * المخازن تُبنى هنا مباشرةً لا عبر Repos: الأخيرة تُنشئ محرّك الصوت
         * والمتحكّم بالهاتف وعميل النموذج، ولا شأن للودجة بأيٍّ منها — وبناؤها
         * داخل بثّ المشغّل تأخيرٌ وذاكرة بلا مقابل.
         */
        val settings = SettingsRepository(app).settings.first()
        val place = settings.place

        val zone = runCatching {
            val tz = place?.timezone
            if (tz.isNullOrBlank()) ZoneId.systemDefault() else ZoneId.of(tz)
        }.getOrElse { ZoneId.systemDefault() }

        val now = LocalDateTime.now(zone)
        val today = LocalDate.now(zone)

        fun prayersFor(date: LocalDate) = place?.let {
            runCatching {
                PrayerTimes.calculate(
                    date = date,
                    latitude = it.latitude,
                    longitude = it.longitude,
                    zone = zone,
                    config = settings.prayerConfig,
                    hijriOffset = settings.hijriOffset,
                )
            }.getOrNull()
        }

        val view = WidgetContent.build(
            prayers = prayersFor(today),
            tomorrow = prayersFor(today.plusDays(1)),
            // load() لا items.first(): الأخيرة تعيد القيمة الابتدائية
            // الفارغة فورًا قبل أن يُقرأ الملفّ، فيظهر المربّع بلا مهام.
            tasks = JsonListStore(app, "tasks.json", Task.serializer()).load(),
            habits = JsonListStore(app, "habits.json", Habit.serializer()).load(),
            now = now,
            use24h = settings.use24hClock,
        )

        return RemoteViews(context.packageName, R.layout.widget_day).apply {
            setTextViewText(R.id.widget_prayer_name, view.prayerName)
            setTextViewText(R.id.widget_prayer_time, view.prayerTime)
            setTextViewText(R.id.widget_countdown, view.countdown)
            setTextViewText(R.id.widget_summary, view.summary)
            // سطر فارغ يترك فجوة تبدو عطلًا؛ يُخفى بدل أن يُترك.
            setViewVisibility(
                R.id.widget_summary,
                if (view.summary.isBlank()) View.GONE else View.VISIBLE,
            )
            setOnClickPendingIntent(R.id.widget_root, openApp(context))
        }
    }

    private fun openApp(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    companion object {
        const val ACTION_REFRESH = "com.rafeeq.companion.widget.REFRESH"

        fun componentOf(context: Context) = ComponentName(context, DayWidget::class.java)

        /** تُستدعى بعد أي تغيير يظهر في الودجة: مهمة، عادة، أو مدينة. */
        fun nudge(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(componentOf(context))
            if (ids.isEmpty()) return
            context.sendBroadcast(
                Intent(context, DayWidget::class.java).setAction(ACTION_REFRESH),
            )
        }
    }
}
