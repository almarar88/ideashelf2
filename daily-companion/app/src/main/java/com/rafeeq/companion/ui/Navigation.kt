package com.rafeeq.companion.ui

import android.content.Intent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Mosque
import androidx.compose.material.icons.filled.Newspaper
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.rafeeq.companion.ui.components.ScreenTopBar
import com.rafeeq.companion.ui.screens.AssistantScreen
import com.rafeeq.companion.ui.screens.AzkarScreen
import com.rafeeq.companion.ui.screens.SavedScreen
import com.rafeeq.companion.ui.screens.SearchScreen
import com.rafeeq.companion.ui.screens.ShortcutsScreen
import com.rafeeq.companion.ui.screens.StatsScreen
import com.rafeeq.companion.ui.screens.ControlScreen
import com.rafeeq.companion.ui.screens.DayScreen
import com.rafeeq.companion.ui.screens.HomeScreen
import com.rafeeq.companion.ui.screens.MemoryScreen
import com.rafeeq.companion.ui.screens.NewsScreen
import com.rafeeq.companion.ui.screens.OnboardingScreen
import com.rafeeq.companion.ui.screens.PrayerScreen
import com.rafeeq.companion.ui.screens.SettingsScreen
import com.rafeeq.companion.ui.screens.SourcesScreen
import com.rafeeq.companion.ui.screens.WeatherScreen
import com.rafeeq.companion.VoiceAssistantActivity
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Ink

object Routes {
    const val ONBOARDING = "onboarding"
    const val HOME = "home"
    const val NEWS = "news"
    const val WEATHER = "weather"
    const val PRAYER = "prayer"
    const val ASSISTANT = "assistant"
    const val DAY = "day"
    const val SETTINGS = "settings"
    const val SOURCES = "sources"
    const val CONTROL = "control"
    const val AZKAR = "azkar"
    const val SAVED = "saved"
    const val SEARCH = "search"
    const val STATS = "stats"
    const val SHORTCUTS = "shortcuts"
    const val MEMORY = "memory"
}

private data class Tab(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

private val tabs = listOf(
    Tab(Routes.HOME, "الرئيسية", Icons.Filled.Home),
    Tab(Routes.NEWS, "الأخبار", Icons.Filled.Newspaper),
    Tab(Routes.PRAYER, "الصلاة", Icons.Filled.Mosque),
    Tab(Routes.WEATHER, "الطقس", Icons.Filled.WbSunny),
    Tab(Routes.DAY, "يومي", Icons.Filled.Today),
    Tab(Routes.ASSISTANT, "المساعد", Icons.Filled.AutoAwesome),
)

@Composable
fun RafeeqNavigation(
    viewModel: AppViewModel,
    requestedRoute: String? = null,
    onRouteConsumed: () -> Unit = {},
) {
    val navController = rememberNavController()
    val settings by viewModel.settings.collectAsState()
    val snackbar by viewModel.snackbar.collectAsState()
    val snackbarHost = remember { SnackbarHostState() }
    val context = LocalContext.current

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    // اختصار الأيقونة يفتح شاشته مباشرة بدل الرئيسية.
    LaunchedEffect(requestedRoute, settings.onboarded) {
        val target = requestedRoute ?: return@LaunchedEffect
        if (!settings.onboarded) return@LaunchedEffect
        runCatching { navController.navigate(target) { launchSingleTop = true } }
        onRouteConsumed()
    }

    LaunchedEffect(snackbar) {
        snackbar?.let {
            snackbarHost.showSnackbar(it)
            viewModel.consumeSnackbar()
        }
    }

    // نحدّث البيانات كلما عاد المستخدم للتطبيق.
    LaunchedEffect(settings.place) {
        if (settings.place != null) {
            viewModel.refreshWeather()
            viewModel.refreshNews()
        }
    }

    val openArticle: (com.rafeeq.companion.data.Article) -> Unit = { article ->
        runCatching {
            context.startActivity(
                Intent(Intent.ACTION_VIEW, article.link.toUri())
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }.onFailure { viewModel.showMessage("تعذّر فتح الرابط.") }
    }

    val openVoice: () -> Unit = {
        runCatching {
            context.startActivity(
                Intent(context, VoiceAssistantActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            )
        }.onFailure { viewModel.showMessage("تعذّر فتح المساعد الصوتي.") }
    }

    val showBottomBar = currentRoute in tabs.map { it.route }
    val isSubScreen = currentRoute == Routes.SETTINGS ||
        currentRoute == Routes.SOURCES ||
        currentRoute == Routes.CONTROL ||
        currentRoute == Routes.AZKAR ||
        currentRoute == Routes.SAVED ||
        currentRoute == Routes.SEARCH ||
        currentRoute == Routes.STATS ||
        currentRoute == Routes.SHORTCUTS ||
        currentRoute == Routes.MEMORY

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        containerColor = MaterialTheme.colorScheme.background,
    ) { _ ->
        // الشريط يطفو فوق المحتوى بدل أن يحجز صفًا أسفل الشاشة،
        // فتبقى البطاقات ممتدة حتى الحافة كما في التصميم المرجعي.
        Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .statusBarsPadding(),
        ) {
            if (isSubScreen) {
                ScreenTopBar(
                    onBack = { navController.popBackStack() },
                    backIcon = Icons.Filled.ArrowForward,
                )
            }

            NavHost(
                navController = navController,
                startDestination = if (settings.onboarded) Routes.HOME else Routes.ONBOARDING,
                modifier = Modifier.fillMaxSize(),
            ) {
                composable(Routes.ONBOARDING) {
                    OnboardingScreen(viewModel) {
                        navController.navigate(Routes.HOME) {
                            popUpTo(Routes.ONBOARDING) { inclusive = true }
                        }
                    }
                }

                composable(Routes.HOME) {
                    HomeScreen(
                        viewModel = viewModel,
                        onOpenNews = { navController.navigate(Routes.NEWS) },
                        onOpenPrayer = { navController.navigate(Routes.PRAYER) },
                        onOpenWeather = { navController.navigate(Routes.WEATHER) },
                        onOpenAssistant = { navController.navigate(Routes.ASSISTANT) },
                        onOpenDay = { navController.navigate(Routes.DAY) },
                        onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                        onOpenArticle = openArticle,
                        onOpenSearch = { navController.navigate(Routes.SEARCH) },
                        onOpenVoice = openVoice,
                        onQuickCommand = { prompt ->
                            navController.navigate(Routes.ASSISTANT)
                            viewModel.newConversation()
                            viewModel.sendMessage(prompt)
                        },
                    )
                }

                composable(Routes.NEWS) {
                    NewsScreen(
                        viewModel = viewModel,
                        onOpenArticle = openArticle,
                        onOpenSources = { navController.navigate(Routes.SOURCES) },
                        onOpenSaved = { navController.navigate(Routes.SAVED) },
                    )
                }

                composable(Routes.WEATHER) {
                    WeatherScreen(viewModel) { navController.navigate(Routes.SETTINGS) }
                }

                composable(Routes.PRAYER) {
                    PrayerScreen(
                        viewModel = viewModel,
                        onOpenSettings = { navController.navigate(Routes.SETTINGS) },
                        onOpenAzkar = { navController.navigate(Routes.AZKAR) },
                    )
                }

                composable(Routes.DAY) { DayScreen(viewModel) }

                composable(Routes.ASSISTANT) {
                    AssistantScreen(viewModel) { navController.navigate(Routes.SETTINGS) }
                }

                composable(Routes.SETTINGS) {
                    SettingsScreen(
                        viewModel = viewModel,
                        onOpenSources = { navController.navigate(Routes.SOURCES) },
                        onOpenControl = { navController.navigate(Routes.CONTROL) },
                        onOpenStats = { navController.navigate(Routes.STATS) },
                        onOpenShortcuts = { navController.navigate(Routes.SHORTCUTS) },
                        onOpenMemory = { navController.navigate(Routes.MEMORY) },
                        onOpenSaved = { navController.navigate(Routes.SAVED) },
                    )
                }

                composable(Routes.SOURCES) { SourcesScreen(viewModel) }

                composable(Routes.CONTROL) { ControlScreen(viewModel) }

                composable(Routes.AZKAR) { AzkarScreen() }

                composable(Routes.SAVED) { SavedScreen(viewModel, openArticle) }

                composable(Routes.SEARCH) {
                    SearchScreen(
                        viewModel = viewModel,
                        onOpenArticle = openArticle,
                        onOpenDay = { navController.navigate(Routes.DAY) },
                        onOpenAssistant = { navController.navigate(Routes.ASSISTANT) },
                    )
                }

                composable(Routes.STATS) { StatsScreen(viewModel) }

                composable(Routes.SHORTCUTS) { ShortcutsScreen(viewModel) }

                composable(Routes.MEMORY) { MemoryScreen(viewModel) }
            }
        }

        if (showBottomBar) {
            Box(Modifier.align(Alignment.BottomCenter)) {
                BottomBar(
                    currentRoute = currentRoute,
                    onSelect = { route ->
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                )
            }
        }
        }
    }
}

@Composable
private fun BottomBar(currentRoute: String?, onSelect: (String) -> Unit) {
    // شريط عائم على شكل كبسولة: دائرة سوداء للعنصر النشط ودوائر بيضاء لبقيّته،
    // كما في التصميم — لا خلفية ممتدة ولا نصوص تحت الأيقونات.
    Box(
        Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .padding(bottom = 14.dp),
        contentAlignment = Alignment.Center,
    ) {
        Row(
            modifier = Modifier
                .shadow(
                    14.dp, RoundedCornerShape(34.dp),
                    ambientColor = Ink.copy(alpha = 0.12f),
                    spotColor = Ink.copy(alpha = 0.16f),
                )
                .clip(RoundedCornerShape(34.dp))
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.96f))
                .padding(6.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEach { tab ->
                val selected = currentRoute == tab.route
                val size by animateFloatAsState(
                    targetValue = if (selected) 50f else 46f,
                    animationSpec = tween(220),
                    label = "tabSize",
                )
                Box(
                    Modifier
                        .size(size.dp)
                        .clip(CircleShape)
                        .background(
                            if (selected) Ink
                            else MaterialTheme.colorScheme.surfaceContainerHigh,
                        )
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { onSelect(tab.route) },
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        tab.icon,
                        contentDescription = tab.label,
                        tint = if (selected) Color.White
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}
