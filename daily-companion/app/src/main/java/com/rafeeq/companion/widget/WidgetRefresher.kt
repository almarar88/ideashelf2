package com.rafeeq.companion.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock

/**
 * تحديث الودجة كل دقيقة.
 *
 * `updatePeriodMillis` في وصف الودجة لا ينزل تحت نصف ساعة، وعدّادٌ تنازلي
 * يتأخّر نصف ساعة ليس عدّادًا. فنستعمل منبّهًا غير دقيق (inexact) يتكرّر كل
 * دقيقة: النظام يجمعه مع غيره فلا يوقظ الجهاز وحده، والدقّة المطلوبة هنا
 * دقيقة لا ثانية.
 *
 * عمدًا ليس منبّهًا دقيقًا: الدقيق يحتاج إذنًا خاصًّا من أندرويد ١٢، وطلبه
 * لأجل عدّاد في مربّع مبالغة لا تُبرَّر.
 */
object WidgetRefresher {

    private const val EVERY_MINUTE = 60_000L

    private fun intent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        1,
        Intent(context, DayWidget::class.java).setAction(DayWidget.ACTION_REFRESH),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    fun schedule(context: Context) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        runCatching {
            manager.set(
                AlarmManager.ELAPSED_REALTIME,
                SystemClock.elapsedRealtime() + EVERY_MINUTE,
                intent(context),
            )
        }
    }

    fun cancel(context: Context) {
        val manager = context.getSystemService(AlarmManager::class.java) ?: return
        runCatching { manager.cancel(intent(context)) }
    }
}
