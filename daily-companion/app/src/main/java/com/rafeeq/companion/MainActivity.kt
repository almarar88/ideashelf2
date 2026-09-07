package com.rafeeq.companion

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rafeeq.companion.notify.PrayerScheduler
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.RafeeqNavigation
import com.rafeeq.companion.ui.theme.RafeeqTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        setContent {
            val vm: AppViewModel = viewModel()
            val settings by vm.settings.collectAsState()

            RafeeqTheme(mode = settings.themeMode, dynamicColor = settings.dynamicColor) {
                // التطبيق عربي بالكامل، لذا نفرض اتجاه اليمين إلى اليسار.
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    RafeeqNavigation(vm)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // نضمن أن تنبيهات الصلاة مجدولة بعد أي تغيير في النظام أو الإعدادات.
        lifecycleScope.launch {
            runCatching { PrayerScheduler.rescheduleAll(applicationContext) }
        }
    }
}
