package com.rafeeq.companion.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.weather.WeatherCodes
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.floatingNavSpace
import com.rafeeq.companion.ui.theme.Ink
import com.rafeeq.companion.ui.components.pastelInkAt
import com.rafeeq.companion.ui.components.pastelAt
import com.rafeeq.companion.ui.components.decorAt
import com.rafeeq.companion.ui.components.SectionRow
import com.rafeeq.companion.ui.components.FeatureCard
import com.rafeeq.companion.ui.components.CountChip
import androidx.compose.material.icons.filled.Tune
import androidx.compose.foundation.lazy.itemsIndexed
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.ProgressRing
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.ShimmerBox
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Rose
import com.rafeeq.companion.ui.theme.Sky
import com.rafeeq.companion.ui.theme.Violet
import com.rafeeq.companion.ui.theme.gradientForHour
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.Locale

@Composable
fun HomeScreen(
    viewModel: AppViewModel,
    onOpenNews: () -> Unit,
    onOpenPrayer: () -> Unit,
    onOpenWeather: () -> Unit,
    onOpenAssistant: () -> Unit,
    onOpenDay: () -> Unit,
    onOpenSettings: () -> Unit,
    onOpenArticle: (Article) -> Unit,
    onOpenSearch: () -> Unit = {},
    onOpenVoice: () -> Unit = {},
    onQuickCommand: (String) -> Unit = {},
) {
    val settings by viewModel.settings.collectAsState()
    val tick by viewModel.tick.collectAsState()
    val weather by viewModel.weather.collectAsState()
    val news by viewModel.news.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val habits by viewModel.habits.collectAsState()
    val brief by viewModel.brief.collectAsState()
    val ai by viewModel.ai.collectAsState()

    val now: LocalDateTime = tick.toLocalDateTime()
    val today = now.toLocalDate()
    val heroColors = gradientForHour(now.hour)
    val nextPrayer = viewModel.nextPrayer(now)
    val todayPrayers = viewModel.todayPrayers()
    val zone = viewModel.zoneId()

    val openTasks = tasks.filter { !it.done }
        .sortedWith(compareByDescending<Task> { it.priority }.thenBy { it.createdAt })
    val doneToday = tasks.count { it.done }
    val todayKey = today.toString()
    val habitsDone = habits.count { (it.log[todayKey] ?: 0) >= it.targetPerDay }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 6.dp, bottom = floatingNavSpace()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {

        // ---------------------------------------------------- الترويسة
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        buildString {
                            append("أهلًا")
                            if (settings.userName.isNotBlank()) append("، ${settings.userName}")
                        },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        Dates.longHijriAr(today, settings.hijriOffset),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Box(
                    Modifier
                        .size(52.dp)
                        .clip(CircleShape)
                        .background(pastelAt(now.dayOfMonth))
                        .clickable { onOpenSettings() },
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        settings.userName.trim().take(1).ifBlank { "A" },
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Ink,
                    )
                }
            }
        }

        // ---------------------------------------------------- العنوان العريض
        item {
            Text(
                Dates.greeting(now.hour) + "!",
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 2.dp, bottom = 4.dp),
            )
        }

        // ---------------------------------------------------- البحث
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(26.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable { onOpenSearch() }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Filled.Search,
                    contentDescription = "بحث",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    "ابحث في يومك…",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.Filled.Tune,
                    contentDescription = "تصفية",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(19.dp),
                )
            }
        }

        // ---------------------------------------------------- شرائح الأقسام
        item {
            val chips = listOf(
                Triple("الصلاة", 5, onOpenPrayer),
                Triple("الأخبار", news.articles.size, onOpenNews),
                Triple("مهامي", openTasks.size, onOpenDay),
                Triple("الطقس", weather.bundle?.daily?.size ?: 0, onOpenWeather),
            )
            LazyRow(horizontalArrangement = Arrangement.spacedBy(9.dp)) {
                itemsIndexed(chips) { index, (label, count, action) ->
                    CountChip(
                        label = label,
                        count = count.takeIf { it > 0 },
                        selected = true,
                        color = pastelAt(index + 3),
                        ink = pastelInkAt(index + 3),
                        onClick = action,
                    )
                }
            }
        }

        // ---------------------------------------------------- بطاقة البطل
        item {
            val remaining = nextPrayer?.let { Duration.between(now, it.second) }
            FeatureCard(
                title = nextPrayer?.first?.arabic?.let { "$it بعد ${Dates.humanDuration(remaining!!)}" }
                    ?: "أوقات الصلاة",
                subtitle = nextPrayer?.let {
                    Dates.formatTime(it.second, settings.use24hClock) +
                        (settings.place?.label?.let { place -> "  ·  $place" } ?: "")
                } ?: "حدّد موقعك ليُحسب وقتك بدقّة",
                actionLabel = "افتح المواقيت",
                background = pastelAt(now.hour / 4),
                decoration = decorAt(now.hour / 4),
                avatars = listOf("🕌", "📿", "🌙"),
                extraAvatars = 0,
                onAction = onOpenPrayer,
            )
        }

        // ---------------------------------------------------- بطاقة المساعد
        item {
            FeatureCard(
                title = "اسألني أي شي",
                subtitle = if (settings.hasApiKey) {
                    "أبحث في الإنترنت، أشوف شاشتك، وأنفّذ أوامرك على الهاتف"
                } else {
                    "أضِف مفتاح Anthropic من الإعدادات لتشغيلي"
                },
                actionLabel = if (settings.hasApiKey) "تحدّث معي" else "فعّلني",
                background = pastelAt(now.hour / 4 + 3),
                decoration = decorAt(now.hour / 4 + 2),
                avatars = listOf("✨", "🎙️", "👁️"),
                extraAvatars = 0,
                onAction = { if (settings.hasApiKey) onOpenVoice() else onOpenSettings() },
            )
        }

        // ---------------------------------------------------- أوامر سريعة
        item {
            val actions = listOf(
                QuickAction("رتّب يومي", "🗓️", Violet, "رتّب لي يومي بالاعتماد على مهامي وأوقات الصلاة."),
                QuickAction("لخّص أخباري", "📰", Sky, "لخّص لي أهم أخبار اليوم في خمس نقاط."),
                QuickAction("حالة هاتفي", "🔋", Emerald, "كيف حالة هاتفي الآن؟"),
                QuickAction("شو ألبس؟", "🧥", Amber, "بناءً على طقس اليوم، بماذا تنصحني أن ألبس؟"),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                actions.forEach { action ->
                    QuickActionTile(
                        action = action,
                        modifier = Modifier.weight(1f),
                        enabled = settings.hasApiKey,
                        onClick = { onQuickCommand(action.prompt) },
                    )
                }
            }
        }

        // ---------------------------------------------------- الطقس بالساعة
        weather.bundle?.let { bundle ->
            val upcoming = bundle.hourly
                .filter { it.epochSeconds >= System.currentTimeMillis() / 1000 - 1800 }
                .take(12)
            if (upcoming.isNotEmpty()) {
                item {
                    GlassCard(
                        padding = PaddingValues(vertical = 12.dp, horizontal = 6.dp),
                        onClick = onOpenWeather,
                    ) {
                        Row(
                            Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "الساعات القادمة",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            bundle.daily.firstOrNull()?.let {
                                Text(
                                    "${it.max.toInt()}° / ${it.min.toInt()}°",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        LazyRow(
                            horizontalArrangement = Arrangement.spacedBy(2.dp),
                            contentPadding = PaddingValues(horizontal = 8.dp),
                        ) {
                            items(upcoming) { hour ->
                                val time = Instant.ofEpochSecond(hour.epochSeconds).atZone(zone)
                                val info = WeatherCodes.describe(hour.weatherCode, hour.isDay)
                                Column(
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    verticalArrangement = Arrangement.spacedBy(4.dp),
                                ) {
                                    Text(
                                        String.format(Locale.ENGLISH, "%02d", time.hour),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                    Text(info.emoji, style = MaterialTheme.typography.titleMedium)
                                    Text(
                                        "${hour.temperature.toInt()}°",
                                        style = MaterialTheme.typography.labelLarge,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (weather.bundle == null && weather.loading) {
            item { ShimmerBox(Modifier.fillMaxWidth(), height = 110.dp, RoundedCornerShape(24.dp)) }
        }

        // ---------------------------------------------------- شريط الصلوات
        if (todayPrayers != null) {
            item { SectionTitle("أوقات الصلاة", action = "الكل", onAction = onOpenPrayer) }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(Prayer.entries.toList()) { prayer ->
                        val time = todayPrayers[prayer]
                        val isNext = nextPrayer?.first == prayer && time.toLocalDate() == today
                        PrayerPill(
                            name = prayer.arabic,
                            time = Dates.formatTime(time, settings.use24hClock),
                            highlighted = isNext,
                            dimmed = time.isBefore(now) && !isNext,
                            onClick = onOpenPrayer,
                        )
                    }
                }
            }
        }

        // ---------------------------------------------------- موجز اليوم
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(34.dp).clip(CircleShape).background(Violet.copy(alpha = 0.18f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.AutoAwesome,
                            contentDescription = null,
                            tint = Violet,
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(
                        "موجز يومك",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.weight(1f),
                    )
                    if (settings.hasApiKey) {
                        IconButton(
                            onClick = { viewModel.generateBrief(force = true) },
                            enabled = !ai.briefLoading,
                        ) {
                            if (ai.briefLoading) {
                                CircularProgressIndicator(Modifier.size(17.dp), strokeWidth = 2.dp)
                            } else {
                                Icon(Icons.Filled.Refresh, contentDescription = "تحديث الموجز")
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))

                when {
                    !settings.hasApiKey -> Text(
                        "فعّل المساعد الذكي بإضافة مفتاح Anthropic من الإعدادات، " +
                            "ليكتب لك كل صباح موجزًا يربط طقسك ومهامك وأخبارك في نص واحد.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.clickable { onOpenSettings() },
                    )
                    brief != null && brief!!.date == todayKey ->
                        RichText(brief!!.body, color = MaterialTheme.colorScheme.onSurface)
                    ai.briefLoading -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        ShimmerBox(Modifier.fillMaxWidth(), 14.dp)
                        ShimmerBox(Modifier.fillMaxWidth(0.9f), 14.dp)
                        ShimmerBox(Modifier.fillMaxWidth(0.6f), 14.dp)
                    }
                    else -> Column {
                        Text(
                            "اضغط لتوليد موجز اليوم بناءً على طقسك وصلواتك ومهامك وأخبارك.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        com.rafeeq.companion.ui.components.PrimaryButton("أنشئ موجز اليوم") {
                            viewModel.generateBrief(force = true)
                        }
                    }
                }
            }
        }

        // ---------------------------------------------------- يومي
        item {
            SectionTitle(
                if (openTasks.isEmpty()) "يومك" else "يومك (${openTasks.size} مهمة)",
                action = "فتح",
                onAction = onOpenDay,
            )
        }
        item {
            TodayCard(
                openTasks = openTasks,
                doneCount = doneToday,
                habitsDone = habitsDone,
                habitsTotal = habits.size,
                today = today,
                onToggle = { viewModel.toggleTask(it) },
                onOpen = onOpenDay,
            )
        }

        // ---------------------------------------------------- الأخبار
        item { SectionTitle("أبرز الأخبار", action = "الكل", onAction = onOpenNews) }
        item {
            AnimatedVisibility(
                visible = news.loading && news.articles.isEmpty(),
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(2) {
                        ShimmerBox(Modifier.width(240.dp), 190.dp, RoundedCornerShape(22.dp))
                    }
                }
            }
        }
        item {
            val headlines = news.articles.take(10)
            if (headlines.isNotEmpty()) {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    items(headlines) { article ->
                        HeadlineCard(article) { onOpenArticle(article) }
                    }
                }
            } else if (!news.loading) {
                GlassCard(onClick = { viewModel.refreshNews(force = true) }) {
                    Text(
                        news.error ?: "لا توجد أخبار بعد. اضغط للتحديث.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

// ---------------------------------------------------------------- المكوّنات

@Composable
private fun HeroCard(
    colors: List<Color>,
    now: LocalDateTime,
    use24h: Boolean,
    placeLabel: String?,
    weatherEmoji: String?,
    weatherText: String?,
    nextPrayerName: String?,
    nextPrayerAt: String?,
    remaining: Duration?,
    progress: Float,
    onWeatherClick: () -> Unit,
    onPrayerClick: () -> Unit,
    onPlaceClick: () -> Unit,
) {
    // تدرّج يتحرّك ببطء فيبدو الحيّز حيًّا دون أن يشتّت.
    val transition = rememberInfiniteTransition(label = "hero")
    val shift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(11000, easing = LinearEasing)),
        label = "shift",
    )

    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(30.dp))
            .background(
                Brush.linearGradient(
                    colors = colors,
                    start = Offset(900f * shift, 0f),
                    end = Offset(900f * (1f - shift) + 400f, 1100f),
                ),
            ),
    ) {
        // وهج زخرفي خفيف في الزاوية
        Box(
            Modifier
                .size(190.dp)
                .padding(10.dp)
                .blur(48.dp)
                .background(Color.White.copy(alpha = 0.16f), CircleShape)
                .align(Alignment.TopEnd),
        )

        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    text = Dates.formatTime(now, use24h),
                    style = MaterialTheme.typography.displayMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.height(2.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.clickable { onPlaceClick() },
                ) {
                    Icon(
                        Icons.Filled.LocationOn,
                        contentDescription = null,
                        tint = Color.White.copy(alpha = 0.85f),
                        modifier = Modifier.size(15.dp),
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(
                        text = placeLabel ?: "لم يُحدَّد موقع",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.9f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }

                if (weatherText != null) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color.White.copy(alpha = 0.16f))
                            .clickable { onWeatherClick() }
                            .padding(horizontal = 12.dp, vertical = 7.dp),
                    ) {
                        Text(weatherEmoji.orEmpty(), style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.width(6.dp))
                        Text(
                            weatherText,
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = Color.White,
                        )
                    }
                }
            }

            if (nextPrayerName != null && remaining != null) {
                ProgressRing(
                    progress = progress.coerceIn(0f, 1f),
                    colors = listOf(Color.White, Color.White.copy(alpha = 0.5f)),
                    strokeWidth = 7.dp,
                    modifier = Modifier
                        .size(126.dp)
                        .clickable { onPrayerClick() },
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            nextPrayerName,
                            style = MaterialTheme.typography.labelLarge,
                            color = Color.White.copy(alpha = 0.92f),
                        )
                        Text(
                            Dates.clockDuration(remaining),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            nextPrayerAt.orEmpty(),
                            style = MaterialTheme.typography.labelSmall,
                            color = Color.White.copy(alpha = 0.85f),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun VoiceBar(
    enabled: Boolean,
    onVoice: () -> Unit,
    onChat: () -> Unit,
    onSetup: () -> Unit,
) {
    val transition = rememberInfiniteTransition(label = "voicebar")
    val pulse by transition.animateFloat(
        initialValue = 0.5f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing)),
        label = "pulse",
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(26.dp))
            .background(Brush.horizontalGradient(Gradients.Dusk))
            .clickable { if (enabled) onChat() else onSetup() }
            .padding(start = 8.dp, end = 18.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.18f + 0.10f * pulse))
                .clickable { if (enabled) onVoice() else onSetup() },
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                Icons.Filled.Mic,
                contentDescription = "التحدّث إلى Alcode Ai",
                tint = Color.White,
                modifier = Modifier.size(24.dp),
            )
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                if (enabled) "تحدّث إلى Alcode Ai" else "فعّل المساعد الذكي",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Text(
                if (enabled) "«افتح واتساب» · «ضبط منبّه ٧ الصبح» · «كيف الجو؟»"
                else "أضِف مفتاح Anthropic من الإعدادات",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.88f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private data class QuickAction(
    val label: String,
    val emoji: String,
    val tint: Color,
    val prompt: String,
)

@Composable
private fun QuickActionTile(
    action: QuickAction,
    enabled: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(
                MaterialTheme.colorScheme.surfaceContainerHigh
                    .copy(alpha = if (enabled) 0.6f else 0.3f),
            )
            .clickable(enabled = enabled) { onClick() }
            .padding(vertical = 14.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box(
            Modifier.size(36.dp).clip(CircleShape).background(action.tint.copy(alpha = 0.16f)),
            contentAlignment = Alignment.Center,
        ) {
            Text(action.emoji, style = MaterialTheme.typography.titleMedium)
        }
        Text(
            action.label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            textAlign = TextAlign.Center,
            maxLines = 2,
            color = if (enabled) MaterialTheme.colorScheme.onSurface
            else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun TodayCard(
    openTasks: List<Task>,
    doneCount: Int,
    habitsDone: Int,
    habitsTotal: Int,
    today: LocalDate,
    onToggle: (Task) -> Unit,
    onOpen: () -> Unit,
) {
    GlassCard(padding = PaddingValues(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            val total = openTasks.size + doneCount
            val ratio = if (total == 0) 0f else doneCount.toFloat() / total
            ProgressRing(
                progress = ratio,
                colors = Gradients.Mint,
                strokeWidth = 6.dp,
                modifier = Modifier.size(58.dp),
            ) {
                Text(
                    "$doneCount/$total",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    when {
                        total == 0 -> "لا مهام اليوم"
                        openTasks.isEmpty() -> "أنجزت كل مهامك 🎉"
                        else -> "بقيت ${openTasks.size} مهمة"
                    },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                if (habitsTotal > 0) {
                    Text(
                        "العادات: $habitsDone من $habitsTotal اليوم",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Text(
                "فتح",
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onOpen() }
                    .padding(horizontal = 8.dp, vertical = 4.dp),
            )
        }

        if (openTasks.isNotEmpty()) {
            Spacer(Modifier.height(6.dp))
            openTasks.take(3).forEach { task ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable { onToggle(task) }
                        .padding(horizontal = 4.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        Icons.Filled.RadioButtonUnchecked,
                        contentDescription = null,
                        tint = when (task.priority) {
                            2 -> Rose
                            0 -> MaterialTheme.colorScheme.onSurfaceVariant
                            else -> Cyan
                        },
                        modifier = Modifier.size(19.dp),
                    )
                    Spacer(Modifier.width(11.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            task.title,
                            style = MaterialTheme.typography.bodyMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        task.dueDate?.let { due ->
                            val overdue = runCatching {
                                LocalDate.parse(due).isBefore(today)
                            }.getOrDefault(false)
                            Text(
                                text = (if (overdue) "متأخرة · " else "") + due +
                                    (task.dueTime?.let { " · $it" } ?: ""),
                                style = MaterialTheme.typography.labelSmall,
                                color = if (overdue) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        } else if (doneCount > 0) {
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.CheckCircle,
                    contentDescription = null,
                    tint = Emerald,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    "يوم نظيف. استرِح قليلًا.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PrayerPill(
    name: String,
    time: String,
    highlighted: Boolean,
    dimmed: Boolean,
    onClick: () -> Unit,
) {
    val background = if (highlighted) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.6f)
    val contentColor = when {
        highlighted -> MaterialTheme.colorScheme.onPrimary
        dimmed -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.55f)
        else -> MaterialTheme.colorScheme.onSurface
    }
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(background)
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 11.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(name, style = MaterialTheme.typography.labelMedium, color = contentColor)
        Spacer(Modifier.height(2.dp))
        Text(
            time,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            color = contentColor,
        )
    }
}

@Composable
private fun HeadlineCard(article: Article, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(240.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f))
            .clickable { onClick() },
    ) {
        if (article.hasImage) {
            Box {
                AsyncImage(
                    model = article.imageUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().aspectRatio(1.7f),
                )
                // تدرّج أسفل الصورة ليبقى النص مقروءًا فوق أي صورة.
                Box(
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(1.7f)
                        .background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f)),
                            ),
                        ),
                )
            }
        } else {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(76.dp)
                    .background(Brush.linearGradient(Gradients.Ocean)),
                contentAlignment = Alignment.Center,
            ) {
                Text("📰", style = MaterialTheme.typography.headlineMedium)
            }
        }
        Column(Modifier.padding(12.dp)) {
            Text(
                article.title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(6.dp))
            Text(
                "${article.sourceName} · ${Dates.relativePast(article.publishedAt)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}
