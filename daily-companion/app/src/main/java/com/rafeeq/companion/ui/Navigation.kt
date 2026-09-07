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
import com.rafeeq.companion.ui.screens.AssistantScreen
import com.rafeeq.companion.ui.screens.ControlScreen
import com.rafeeq.companion.ui.screens.DayScreen
import com.rafeeq.companion.ui.screens.HomeScreen
import com.rafeeq.companion.ui.screens.NewsScreen
import com.rafeeq.companion.ui.screens.OnboardingScreen
import com.rafeeq.companion.ui.screens.PrayerScreen
import com.rafeeq.companion.ui.screens.SettingsScreen
import com.rafeeq.companion.ui.screens.SourcesScreen
import com.rafeeq.companion.ui.screens.WeatherScreen
import com.rafeeq.companion.VoiceAssistantActivity
import com.rafeeq.companion.ui.theme.Gradients

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
fun RafeeqNavigation(viewModel: AppViewModel) {
    val navController = rememberNavController()
    val settings by viewModel.settings.collectAsState()
    val snackbar by viewModel.snackbar.collectAsState()
    val snackbarHost = remember { SnackbarHostState() }
    val context = LocalContext.current

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

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
        currentRoute == Routes.CONTROL

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (showBottomBar) {
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
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(bottom = padding.calculateBottomPadding())
                .statusBarsPadding(),
        ) {
            if (isSubScreen) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 4.dp, top = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.Filled.ArrowForward, contentDescription = "رجوع")
                    }
                }
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
                    )
                }

                composable(Routes.WEATHER) {
                    WeatherScreen(viewModel) { navController.navigate(Routes.SETTINGS) }
                }

                composable(Routes.PRAYER) {
                    PrayerScreen(viewModel) { navController.navigate(Routes.SETTINGS) }
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
                    )
                }

                composable(Routes.SOURCES) { SourcesScreen(viewModel) }

                composable(Routes.CONTROL) { ControlScreen(viewModel) }
            }
        }
    }
}

@Composable
private fun BottomBar(currentRoute: String?, onSelect: (String) -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .navigationBarsPadding()
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(26.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.9f))
                .padding(horizontal = 5.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            tabs.forEach { tab ->
                val selected = currentRoute == tab.route
                val scale by animateFloatAsState(
                    targetValue = if (selected) 1f else 0.92f,
                    animationSpec = tween(220),
                    label = "tabScale",
                )
                Column(
                    modifier = Modifier
                        .clip(RoundedCornerShape(18.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { onSelect(tab.route) }
                        .padding(horizontal = 7.dp, vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(
                        Modifier
                            .size(width = 40.dp, height = 28.dp)
                            .clip(CircleShape)
                            .background(
                                if (selected) Brush.horizontalGradient(Gradients.Aurora)
                                else Brush.horizontalGradient(
                                    listOf(Color.Transparent, Color.Transparent),
                                ),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            tab.icon,
                            contentDescription = tab.label,
                            tint = if (selected) Color(0xFF06121F)
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(if (selected) 18.dp else 20.dp),
                        )
                    }
                    Spacer(Modifier.height(3.dp))
                    Text(
                        tab.label,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                        color = if (selected) MaterialTheme.colorScheme.onSurface
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
