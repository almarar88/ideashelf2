package com.rafeeq.companion.ui.screens

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.HabitBars
import com.rafeeq.companion.ui.components.ProgressRing
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Violet
import java.time.LocalDate
import java.util.Locale

// ================================================================ المحفوظات

/** قائمة القراءة: المقالات التي حفظها المستخدم، مع ملخّصاتها إن وُجدت. */
@Composable
fun SavedScreen(viewModel: AppViewModel, onOpenArticle: (Article) -> Unit) {
    val saved by viewModel.savedArticles.collectAsState()
    var query by remember { mutableStateOf("") }

    val filtered = remember(saved, query) {
        if (query.isBlank()) saved
        else saved.filter {
            (it.article.title + it.article.sourceName).contains(query.trim(), ignoreCase = true)
        }
    }

    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
            Text(
                "المحفوظات",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                if (saved.isEmpty()) "لا مقالات محفوظة بعد"
                else "${saved.size} مقالًا محفوظًا للقراءة لاحقًا",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        if (saved.isEmpty()) {
            EmptyState(
                emoji = "🔖",
                title = "قائمة القراءة فارغة",
                subtitle = "اضغط أيقونة الحفظ على أي خبر ليظهر هنا، حتى بلا إنترنت.",
            )
            return@Column
        }

        Spacer(Modifier.height(10.dp))
        RafeeqTextField(
            value = query,
            onValueChange = { query = it },
            label = "بحث في المحفوظات",
            modifier = Modifier.padding(horizontal = 16.dp),
            trailing = { Icon(Icons.Filled.Search, contentDescription = null) },
        )
        Spacer(Modifier.height(10.dp))

        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 108.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(filtered, key = { it.article.link }) { item ->
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.6f))
                        .clickable { onOpenArticle(item.article) },
                ) {
                    if (item.article.hasImage) {
                        AsyncImage(
                            model = item.article.imageUrl,
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth().height(140.dp),
                        )
                    }
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            item.article.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(5.dp))
                        Text(
                            "${item.article.sourceName} · حُفظ ${Dates.relativePast(item.savedAt)}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )

                        item.aiSummary?.let { summary ->
                            Spacer(Modifier.height(10.dp))
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Violet.copy(alpha = 0.10f))
                                    .padding(12.dp),
                            ) {
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Icon(
                                            Icons.Filled.AutoAwesome,
                                            contentDescription = null,
                                            tint = Violet,
                                            modifier = Modifier.size(14.dp),
                                        )
                                        Spacer(Modifier.width(6.dp))
                                        Text(
                                            "ملخّص محفوظ",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Violet,
                                        )
                                    }
                                    Spacer(Modifier.height(6.dp))
                                    RichText(summary)
                                }
                            }
                        }

                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                            IconButton(
                                onClick = { viewModel.toggleSaved(item.article) },
                                modifier = Modifier.size(34.dp),
                            ) {
                                Icon(
                                    Icons.Filled.Delete,
                                    contentDescription = "إزالة",
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.size(17.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ================================================================ بحث شامل

/** بحث واحد يغطّي المهام والملاحظات والأخبار والمحادثات. */
@Composable
fun SearchScreen(
    viewModel: AppViewModel,
    onOpenArticle: (Article) -> Unit,
    onOpenDay: () -> Unit,
    onOpenAssistant: () -> Unit,
) {
    var query by remember { mutableStateOf("") }

    val tasks by viewModel.tasks.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val news by viewModel.news.collectAsState()
    val conversations by viewModel.conversations.collectAsState()

    val q = query.trim()
    fun String.hit() = q.isNotBlank() && contains(q, ignoreCase = true)

    val taskHits = remember(tasks, q) { tasks.filter { (it.title + it.note).hit() }.take(8) }
    val noteHits = remember(notes, q) { notes.filter { (it.title + it.body).hit() }.take(8) }
    val newsHits = remember(news.articles, q) {
        news.articles.filter { (it.title + it.sourceName).hit() }.take(10)
    }
    val chatHits = remember(conversations, q) {
        conversations.filter { c -> c.title.hit() || c.messages.any { it.content.hit() } }.take(6)
    }
    val total = taskHits.size + noteHits.size + newsHits.size + chatHits.size

    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
            Text("بحث", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "في مهامك وملاحظاتك وأخبارك ومحادثاتك دفعة واحدة",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(10.dp))
        RafeeqTextField(
            value = query,
            onValueChange = { query = it },
            label = "ابحث عن أي شيء",
            modifier = Modifier.padding(horizontal = 16.dp),
            trailing = { Icon(Icons.Filled.Search, contentDescription = null) },
        )
        Spacer(Modifier.height(12.dp))

        if (q.isBlank()) {
            EmptyState("🔍", "اكتب للبحث", "سيظهر كل ما يطابق كلمتك من كل أقسام التطبيق.")
            return@Column
        }
        if (total == 0) {
            EmptyState("🤷", "لا نتائج", "لم أجد شيئًا يطابق «$q».")
            return@Column
        }

        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 108.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (taskHits.isNotEmpty()) {
                item { SectionTitle("مهام (${taskHits.size})", action = "فتح", onAction = onOpenDay) }
                items(taskHits, key = { "t" + it.id }) { task ->
                    ResultRow(
                        emoji = if (task.done) "✅" else "📝",
                        title = task.title,
                        subtitle = listOfNotNull(task.dueDate, task.dueTime).joinToString(" · "),
                        onClick = onOpenDay,
                    )
                }
            }
            if (noteHits.isNotEmpty()) {
                item { SectionTitle("ملاحظات (${noteHits.size})", action = "فتح", onAction = onOpenDay) }
                items(noteHits, key = { "n" + it.id }) { note ->
                    ResultRow(
                        emoji = "🗒️",
                        title = note.title.ifBlank { note.body.take(40) },
                        subtitle = note.body.take(90),
                        onClick = onOpenDay,
                    )
                }
            }
            if (chatHits.isNotEmpty()) {
                item { SectionTitle("محادثات (${chatHits.size})") }
                items(chatHits, key = { "c" + it.id }) { conversation ->
                    ResultRow(
                        emoji = "💬",
                        title = conversation.title,
                        subtitle = "${conversation.messages.size} رسالة · " +
                            Dates.relativePast(conversation.updatedAt),
                        onClick = {
                            viewModel.selectConversation(conversation.id)
                            onOpenAssistant()
                        },
                    )
                }
            }
            if (newsHits.isNotEmpty()) {
                item { SectionTitle("أخبار (${newsHits.size})") }
                items(newsHits, key = { "a" + it.id }) { article ->
                    ResultRow(
                        emoji = "📰",
                        title = article.title,
                        subtitle = "${article.sourceName} · ${Dates.relativePast(article.publishedAt)}",
                        onClick = { onOpenArticle(article) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ResultRow(
    emoji: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.5f))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(emoji)
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

// ================================================================ الإحصاءات

/** لوحة أرقام أسبوعية: الإنجاز، العادات، والاستهلاك. */
@Composable
fun StatsScreen(viewModel: AppViewModel) {
    val tasks by viewModel.tasks.collectAsState()
    val habits by viewModel.habits.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val usage by viewModel.usage.collectAsState()
    val zone = viewModel.zoneId()
    val today = LocalDate.now(zone)

    val last7 = remember(today) { (6 downTo 0).map { today.minusDays(it.toLong()) } }

    // نعدّ المنجز في كل يوم من الأيام السبعة الماضية.
    val completedPerDay = remember(tasks, today) {
        last7.map { day ->
            tasks.count { task ->
                task.done && task.completedAt?.let {
                    java.time.Instant.ofEpochMilli(it).atZone(zone).toLocalDate() == day
                } == true
            }
        }
    }
    val maxDay = (completedPerDay.maxOrNull() ?: 0).coerceAtLeast(1)

    val open = tasks.count { !it.done }
    val done = tasks.count { it.done }
    val rate = if (tasks.isEmpty()) 0f else done.toFloat() / tasks.size

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text(
                    "إحصاءاتك",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "آخر سبعة أيام",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            GlassCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ProgressRing(
                        progress = rate,
                        colors = Gradients.Mint,
                        strokeWidth = 7.dp,
                        modifier = Modifier.size(76.dp),
                    ) {
                        Text(
                            "${(rate * 100).toInt()}%",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(Modifier.width(16.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "نسبة الإنجاز",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "$done منجزة · $open مفتوحة · ${notes.size} ملاحظة",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        item { SectionTitle("المهام المنجزة يوميًا") }
        item {
            GlassCard {
                HabitBars(
                    values = completedPerDay.map { it.toFloat() / maxDay },
                    activeColor = Cyan,
                    modifier = Modifier.fillMaxWidth().height(72.dp),
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    last7.forEach { day ->
                        Text(
                            Dates.weekdayAr(day).take(3),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    "إجمالي الأسبوع: ${completedPerDay.sum()} مهمة",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }

        if (habits.isNotEmpty()) {
            item { SectionTitle("العادات") }
            items(habits, key = { it.id }) { habit ->
                val values = last7.map { day ->
                    ((habit.log[day.toString()] ?: 0).toFloat() /
                        habit.targetPerDay.coerceAtLeast(1)).coerceIn(0f, 1f)
                }
                val kept = values.count { it >= 1f }
                GlassCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(habit.emoji)
                        Spacer(Modifier.width(10.dp))
                        Text(
                            habit.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            "$kept/7",
                            style = MaterialTheme.typography.labelLarge,
                            color = if (kept >= 5) Emerald else MaterialTheme.colorScheme.onSurfaceVariant,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    HabitBars(
                        values = values,
                        activeColor = Emerald,
                        modifier = Modifier.fillMaxWidth().height(28.dp),
                    )
                }
            }
        }

        // ------------------------------------------------ استهلاك المساعد
        usage?.let { stats ->
            if (stats.requests > 0) {
                item { SectionTitle("استهلاك المساعد") }
                item {
                    GlassCard {
                        Text(
                            "منذ التثبيت",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        UsageRow("الطلبات", "${stats.requests}")
                        UsageRow("رموز مُدخلة", formatTokens(stats.inputTokens))
                        UsageRow("رموز مُخرجة", formatTokens(stats.outputTokens))
                        if (stats.cachedTokens > 0) {
                            UsageRow(
                                "من التخزين المؤقت",
                                formatTokens(stats.cachedTokens) + " (أرخص وأسرع)",
                            )
                        }
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "هذه أرقام تقريبية للاسترشاد فقط. الفاتورة الفعلية تظهر في " +
                                "حسابك على Anthropic، وتختلف باختلاف النموذج.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "تصفير العدّاد",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .clickable { viewModel.resetUsage() }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun UsageRow(label: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 3.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(value, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
    }
}

private fun formatTokens(value: Long): String = when {
    value >= 1_000_000 -> String.format(Locale.ENGLISH, "%.1fM", value / 1_000_000.0)
    value >= 1_000 -> String.format(Locale.ENGLISH, "%.1fK", value / 1_000.0)
    else -> value.toString()
}
