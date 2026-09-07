package com.rafeeq.companion

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
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

    /** الشاشة المطلوبة من اختصار الأيقونة (alcode://route/<name>)، تُستهلك مرة واحدة. */
    private val requestedRoute = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        requestedRoute.value = routeOf(intent)

        setContent {
            val vm: AppViewModel = viewModel()
            val settings by vm.settings.collectAsState()

            RafeeqTheme(
                mode = settings.themeMode,
                dynamicColor = settings.dynamicColor,
                fontScale = settings.fontScale,
            ) {
                // التطبيق عربي بالكامل، لذا نفرض اتجاه اليمين إلى اليسار.
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    RafeeqNavigation(
                        viewModel = vm,
                        requestedRoute = requestedRoute.value,
                        onRouteConsumed = { requestedRoute.value = null },
                    )
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        routeOf(intent)?.let { requestedRoute.value = it }
    }

    /** يستخرج اسم الشاشة من رابط الاختصار، ويتجاهل ما لا نعرفه. */
    private fun routeOf(intent: Intent?): String? {
        val uri = intent?.data ?: return null
        if (uri.scheme != "alcode" || uri.host != "route") return null
        return uri.lastPathSegment?.takeIf { it in setOf("assistant", "day", "prayer", "news", "weather") }
    }

    override fun onResume() {
        super.onResume()
        // نضمن أن تنبيهات الصلاة مجدولة بعد أي تغيير في النظام أو الإعدادات.
        lifecycleScope.launch {
            runCatching { PrayerScheduler.rescheduleAll(applicationContext) }
        }
    }
}
