package com.rafeeq.companion.ui.screens

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.weather.WeatherCodes
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.ProgressRing
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.ShimmerBox
import com.rafeeq.companion.ui.components.StatTile
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Sky
import com.rafeeq.companion.ui.theme.Violet
import com.rafeeq.companion.ui.theme.gradientForHour
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime

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
) {
    val settings by viewModel.settings.collectAsState()
    val tick by viewModel.tick.collectAsState()
    val weather by viewModel.weather.collectAsState()
    val news by viewModel.news.collectAsState()
    val tasks by viewModel.tasks.collectAsState()
    val brief by viewModel.brief.collectAsState()
    val ai by viewModel.ai.collectAsState()

    val now: LocalDateTime = tick.toLocalDateTime()
    val today = now.toLocalDate()
    val heroColors = gradientForHour(now.hour)
    val nextPrayer = viewModel.nextPrayer(now)
    val todayPrayers = viewModel.todayPrayers()

    val openTasks = tasks.filter { !it.done }
        .sortedWith(compareByDescending<com.rafeeq.companion.data.Task> { it.priority }.thenBy { it.createdAt })
    val doneToday = tasks.count { it.done }

    LazyColumn(
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {

        // ---------------------------------------------------- الترويسة
        item {
            Row(
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = buildString {
                            append(Dates.greeting(now.hour))
                            if (settings.userName.isNotBlank()) append("، ${settings.userName}")
                        },
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = Dates.longGregorianAr(today),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = Dates.longHijriAr(today, settings.hijriOffset),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Filled.Settings, contentDescription = "الإعدادات")
                }
            }
        }

        // ---------------------------------------------------- البطاقة الرئيسية
        item {
            GradientCard(colors = heroColors, padding = PaddingValues(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = Dates.formatTime(now, settings.use24hClock),
                            style = MaterialTheme.typography.displayMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Spacer(Modifier.height(2.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.LocationOn,
                                contentDescription = null,
                                tint = Color.White.copy(alpha = 0.85f),
                                modifier = Modifier.size(15.dp),
                            )
                            Spacer(Modifier.width(4.dp))
                            Text(
                                text = settings.place?.label ?: "لم يُحدَّد موقع",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.9f),
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.clickable { onOpenSettings() },
                            )
                        }

                        weather.bundle?.let { bundle ->
                            val info = WeatherCodes.describe(bundle.now.weatherCode, bundle.now.isDay)
                            Spacer(Modifier.height(10.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.clickable { onOpenWeather() },
                            ) {
                                Text(info.emoji, style = MaterialTheme.typography.headlineSmall)
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    "${bundle.now.temperature.toInt()}° · ${info.text}",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Color.White,
                                )
                            }
                        }
                    }

                    // عدّاد الصلاة القادمة
                    if (nextPrayer != null && todayPrayers != null) {
                        val (prayer, time) = nextPrayer
                        val previous = todayPrayers.current(now)?.second
                            ?: time.minusHours(5)
                        val total = Duration.between(previous, time).seconds.coerceAtLeast(1)
                        val remaining = Duration.between(now, time)
                        val progress = 1f - (remaining.seconds.toFloat() / total.toFloat())

                        ProgressRing(
                            progress = progress.coerceIn(0f, 1f),
                            colors = listOf(Color.White, Color.White.copy(alpha = 0.55f)),
                            strokeWidth = 7.dp,
                            modifier = Modifier
                                .size(124.dp)
                                .clickable { onOpenPrayer() },
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    prayer.arabic,
                                    style = MaterialTheme.typography.labelLarge,
                                    color = Color.White.copy(alpha = 0.9f),
                                )
                                Text(
                                    Dates.clockDuration(remaining),
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White,
                                )
                                Text(
                                    Dates.formatTime(time, settings.use24hClock),
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color.White.copy(alpha = 0.85f),
                                )
                            }
                        }
                    }
                }
            }
        }

        // ---------------------------------------------------- مؤشرات الطقس
        weather.bundle?.let { bundle ->
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatTile(
                        Icons.Filled.WbSunny,
                        "${bundle.now.feelsLike.toInt()}°",
                        "محسوسة",
                        Amber,
                        Modifier.weight(1f),
                    )
                    StatTile(
                        Icons.Filled.WaterDrop,
                        "${bundle.now.humidity}%",
                        "الرطوبة",
                        Sky,
                        Modifier.weight(1f),
                    )
                    StatTile(
                        Icons.Filled.Air,
                        "${bundle.now.windSpeed.toInt()}",
                        "كم/س رياح",
                        Cyan,
                        Modifier.weight(1f),
                    )
                    val aqi = bundle.airQuality
                    StatTile(
                        Icons.Filled.Bolt,
                        aqi?.aqi?.toString() ?: "—",
                        aqi?.let { WeatherCodes.airQualityLabel(it.aqi).first } ?: "جودة الهواء",
                        Emerald,
                        Modifier.weight(1f),
                    )
                }
            }
        }

        if (weather.bundle == null && weather.loading) {
            item { ShimmerBox(Modifier.fillMaxWidth(), height = 84.dp, RoundedCornerShape(18.dp)) }
        }

        // ---------------------------------------------------- موجز الذكاء الاصطناعي
        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(Violet.copy(alpha = 0.18f)),
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
                                CircularProgressIndicator(
                                    modifier = Modifier.size(17.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Icon(Icons.Filled.Refresh, contentDescription = "تحديث الموجز")
                            }
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))

                val todayKey = today.toString()
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
                        PrimaryButton("أنشئ موجز اليوم") { viewModel.generateBrief(force = true) }
                    }
                }
            }
        }

        // ---------------------------------------------------- شريط الصلوات
        if (todayPrayers != null) {
            item {
                SectionTitle("أوقات الصلاة", action = "الكل", onAction = onOpenPrayer)
            }
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(Prayer.entries.toList()) { prayer ->
                        val time = todayPrayers[prayer]
                        val isNext = nextPrayer?.first == prayer &&
                            time.toLocalDate() == today
                        val passed = time.isBefore(now)
                        PrayerPill(
                            name = prayer.arabic,
                            time = Dates.formatTime(time, settings.use24hClock),
                            highlighted = isNext,
                            dimmed = passed && !isNext,
                            onClick = onOpenPrayer,
                        )
                    }
                }
            }
        }

        // ---------------------------------------------------- مهام اليوم
        item {
            SectionTitle(
                if (openTasks.isEmpty()) "مهامك" else "مهامك (${openTasks.size})",
                action = "فتح",
                onAction = onOpenDay,
            )
        }
        item {
            GlassCard(padding = PaddingValues(vertical = 6.dp, horizontal = 6.dp)) {
                if (openTasks.isEmpty()) {
                    Row(
                        Modifier.fillMaxWidth().padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.CheckCircle,
                            contentDescription = null,
                            tint = Emerald,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(
                            if (doneToday > 0) "أنجزت كل مهامك اليوم 🎉" else "لا مهام بعد. أضِف واحدة لتبدأ.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "إضافة",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { onOpenDay() }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                } else {
                    openTasks.take(4).forEach { task ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .clickable { viewModel.toggleTask(task) }
                                .padding(horizontal = 10.dp, vertical = 11.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(
                                Icons.Filled.RadioButtonUnchecked,
                                contentDescription = null,
                                tint = when (task.priority) {
                                    2 -> MaterialTheme.colorScheme.error
                                    0 -> MaterialTheme.colorScheme.onSurfaceVariant
                                    else -> MaterialTheme.colorScheme.primary
                                },
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    task.title,
                                    style = MaterialTheme.typography.bodyMedium,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                val due = task.dueDate
                                if (due != null) {
                                    val overdue = runCatching { LocalDate.parse(due).isBefore(today) }
                                        .getOrDefault(false)
                                    Text(
                                        text = (if (overdue) "متأخرة · " else "") +
                                            due + (task.dueTime?.let { " · $it" } ?: ""),
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (overdue) MaterialTheme.colorScheme.error
                                        else MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                    }
                    if (openTasks.size > 4) {
                        Text(
                            "و${openTasks.size - 4} مهام أخرى",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onOpenDay() }
                                .padding(10.dp),
                        )
                    }
                }
            }
        }

        // ---------------------------------------------------- أبرز الأخبار
        item {
            SectionTitle("أبرز الأخبار", action = "الكل", onAction = onOpenNews)
        }
        item {
            AnimatedVisibility(
                visible = news.loading && news.articles.isEmpty(),
                enter = fadeIn(),
                exit = fadeOut(),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    repeat(2) {
                        ShimmerBox(Modifier.width(230.dp), 168.dp, RoundedCornerShape(20.dp))
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

        // ---------------------------------------------------- زر المساعد
        item {
            GradientCard(colors = Gradients.Dusk, onClick = onOpenAssistant) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("✨", style = MaterialTheme.typography.headlineMedium)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "اسأل رفيقك",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            "رتّب يومك، لخّص خبرًا، اكتب رسالة، أو ناقش قرارًا.",
                            style = MaterialTheme.typography.bodySmall,
                            color = Color.White.copy(alpha = 0.9f),
                        )
                    }
                }
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
    val background = when {
        highlighted -> MaterialTheme.colorScheme.primary
        else -> MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.6f)
    }
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
            .width(238.dp)
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f))
            .clickable { onClick() },
    ) {
        if (article.hasImage) {
            AsyncImage(
                model = article.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(118.dp),
            )
        } else {
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(72.dp)
                    .background(
                        androidx.compose.ui.graphics.Brush.linearGradient(Gradients.Ocean),
                    ),
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
                lineHeight = MaterialTheme.typography.bodyMedium.lineHeight,
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
