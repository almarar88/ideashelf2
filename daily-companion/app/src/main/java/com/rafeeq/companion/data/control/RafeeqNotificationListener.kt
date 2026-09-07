package com.rafeeq.companion.data.control

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * يقرأ الإشعارات الظاهرة ليتمكّن المساعد من تلخيصها أو مسحها.
 * نحتفظ بلقطة نصية فقط — لا نخزّن شيئًا على القرص ولا نرسل شيئًا تلقائيًا.
 */
class RafeeqNotificationListener : NotificationListenerService() {

    data class Item(
        val key: String,
        val packageName: String,
        val appLabel: String,
        val title: String,
        val text: String,
        val postedAt: Long,
    )

    companion object {
        @Volatile
        private var instance: RafeeqNotificationListener? = null

        fun snapshot(): List<Item> = instance?.readActive().orEmpty()

        /** يمسح الإشعارات ويُعيد عددها. [filter] يطابق اسم التطبيق أو الحزمة. */
        fun clear(filter: String?): Int {
            val service = instance ?: return 0
            val items = service.readActive()
            val targets = if (filter.isNullOrBlank()) items else items.filter {
                it.appLabel.contains(filter, ignoreCase = true) ||
                    it.packageName.contains(filter, ignoreCase = true)
            }
            targets.forEach { runCatching { service.cancelNotification(it.key) } }
            return targets.size
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        instance = this
    }

    override fun onListenerDisconnected() {
        instance = null
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) = Unit
    override fun onNotificationRemoved(sbn: StatusBarNotification?) = Unit

    private fun readActive(): List<Item> = runCatching {
        activeNotifications.orEmpty().mapNotNull { sbn ->
            val extras = sbn.notification?.extras ?: return@mapNotNull null
            val title = extras.getCharSequence("android.title")?.toString().orEmpty()
            val text = extras.getCharSequence("android.text")?.toString().orEmpty()
            if (title.isBlank() && text.isBlank()) return@mapNotNull null
            Item(
                key = sbn.key,
                packageName = sbn.packageName,
                appLabel = appLabel(sbn.packageName),
                title = title,
                text = text,
                postedAt = sbn.postTime,
            )
        }.sortedByDescending { it.postedAt }
    }.getOrDefault(emptyList())

    private fun appLabel(packageName: String): String = runCatching {
        val info = packageManager.getApplicationInfo(packageName, 0)
        packageManager.getApplicationLabel(info).toString()
    }.getOrDefault(packageName)
}
