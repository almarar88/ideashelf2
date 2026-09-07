package com.rafeeq.companion

import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * زرّ في لوحة الإعدادات السريعة يفتح المساعد الصوتي مباشرة.
 *
 * يفيد حين لا يكون زر التشغيل مضبوطًا على المساعد، أو على الأجهزة التي
 * تحجز الضغط المطوّل لمساعدها الخاص.
 */
class AssistantTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.apply {
            state = Tile.STATE_INACTIVE
            label = getString(R.string.app_name)
            updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val intent = Intent(this, VoiceAssistantActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // من أندرويد ١٤ لا يُقبل إلا PendingIntent لفتح شاشة من اللوحة.
            val pending = PendingIntent.getActivity(
                this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            startActivityAndCollapse(pending)
        } else {
            @Suppress("DEPRECATION")
            startActivityAndCollapse(intent)
        }
    }
}
