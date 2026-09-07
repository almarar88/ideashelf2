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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.ErrorBanner
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.LoadingList
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.theme.Gradients

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(
    viewModel: AppViewModel,
    onOpenArticle: (Article) -> Unit,
    onOpenSources: () -> Unit,
    onOpenSaved: () -> Unit = {},
) {
    val news by viewModel.news.collectAsState()
    val saved by viewModel.savedArticles.collectAsState()
    val settings by viewModel.settings.collectAsState()

    val categories = viewModel.availableCategories()
    val selected = if (news.selectedCategory in categories) news.selectedCategory
    else categories.firstOrNull().orEmpty()
    val base = viewModel.articlesFor(selected)

    var summaryFor by remember { mutableStateOf<Article?>(null) }
    var query by remember { mutableStateOf("") }
    var searching by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth()) {

        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("الأخبار", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    if (news.lastUpdated > 0)
                        "آخر تحديث ${Dates.relativePast(news.lastUpdated)} · ${news.articles.size} خبرًا"
                    else "اسحب للأسفل للتحديث",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = { searching = !searching; if (!searching) query = "" }) {
                Icon(Icons.Filled.Search, contentDescription = "بحث في الأخبار")
            }
            IconButton(onClick = onOpenSaved) {
                Icon(Icons.Filled.Bookmark, contentDescription = "المحفوظات")
            }
            IconButton(onClick = onOpenSources) {
                Icon(Icons.Filled.Tune, contentDescription = "مصادر الأخبار ومواضيعي")
            }
            IconButton(onClick = { viewModel.refreshNews(force = true) }) {
                Icon(Icons.Filled.Refresh, contentDescription = "تحديث")
            }
        }

        Spacer(Modifier.height(8.dp))

        if (searching) {
            com.rafeeq.companion.ui.components.RafeeqTextField(
                value = query,
                onValueChange = { query = it },
                label = "ابحث في الأخبار المحمّلة",
                modifier = Modifier.padding(horizontal = 16.dp),
            )
            Spacer(Modifier.height(8.dp))
        }

        if (categories.isNotEmpty() && !searching) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp),
            ) {
                items(categories) { category ->
                    Chip(
                        label = category,
                        selected = category == selected,
                        onClick = { viewModel.selectCategory(category) },
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
        }

        val articles = if (query.isBlank()) base else news.articles.filter {
            (it.title + " " + it.summary + " " + it.sourceName).contains(query.trim(), ignoreCase = true)
        }

        PullToRefreshBox(
            isRefreshing = news.loading,
            onRefresh = { viewModel.refreshNews(force = true) },
            modifier = Modifier.fillMaxWidth().weight(1f),
        ) {
            when {
                news.articles.isEmpty() && news.loading -> LoadingList()

                articles.isEmpty() -> Column {
                    news.error?.let {
                        ErrorBanner(
                            it,
                            Modifier.padding(16.dp),
                            onRetry = { viewModel.refreshNews(force = true) },
                        )
                    }
                    EmptyState(
                        emoji = "📰",
                        title = "لا توجد أخبار هنا بعد",
                        subtitle = "أضِف مصادر أو مواضيع تهمّك، ثم اسحب للتحديث.",
                    ) {
                        Spacer(Modifier.height(6.dp))
                        PrimaryButton("إدارة المصادر والمواضيع") { onOpenSources() }
                    }
                }

                else -> LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    if (news.failedSources.isNotEmpty()) {
                        item {
                            ErrorBanner(
                                "تعذّر جلب ${news.failedSources.size} مصدر: " +
                                    news.failedSources.take(3).joinToString("، "),
                            )
                        }
                    }
                    items(articles, key = { it.id + it.category }) { article ->
                        ArticleCard(
                            article = article,
                            saved = saved.any { it.article.link == article.link },
                            canSummarize = settings.hasApiKey,
                            onOpen = { onOpenArticle(article) },
                            onSave = { viewModel.toggleSaved(article) },
                            onSummarize = { summaryFor = article },
                        )
                    }
                }
            }
        }
    }

    summaryFor?.let { article ->
        SummarySheet(
            viewModel = viewModel,
            article = article,
            onDismiss = { summaryFor = null },
            onOpen = { onOpenArticle(article) },
        )
    }
}

@Composable
private fun ArticleCard(
    article: Article,
    saved: Boolean,
    canSummarize: Boolean,
    onOpen: () -> Unit,
    onSave: () -> Unit,
    onSummarize: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(22.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.62f))
            .clickable { onOpen() },
    ) {
        if (article.hasImage) {
            AsyncImage(
                model = article.imageUrl,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(178.dp),
            )
        }

        Column(Modifier.padding(15.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (!article.hasImage) {
                    Box(
                        Modifier
                            .size(6.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(Brush.linearGradient(Gradients.Aurora)),
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Text(
                    text = article.sourceName,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false),
                )
                Text(
                    "  ·  ${Dates.relativePast(article.publishedAt)}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(6.dp))
            Text(
                article.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )

            if (article.summary.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    article.summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (canSummarize) {
                    ActionChip(Icons.Filled.AutoAwesome, "لخّص", onSummarize)
                    Spacer(Modifier.width(8.dp))
                }
                ActionChip(Icons.Filled.OpenInNew, "افتح", onOpen)
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onSave, modifier = Modifier.size(36.dp)) {
                    Icon(
                        if (saved) Icons.Filled.Bookmark else Icons.Filled.BookmarkBorder,
                        contentDescription = if (saved) "إزالة من المحفوظات" else "حفظ",
                        tint = if (saved) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(19.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionChip(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.8f))
            .clickable { onClick() }
            .padding(horizontal = 11.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(5.dp))
        Text(label, style = MaterialTheme.typography.labelMedium)
    }
}

/** ورقة سفلية تعرض ملخّص المقال المولّد بالذكاء الاصطناعي. */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun SummarySheet(
    viewModel: AppViewModel,
    article: Article,
    onDismiss: () -> Unit,
    onOpen: () -> Unit,
) {
    var summary by remember(article.link) { mutableStateOf<String?>(null) }
    var error by remember(article.link) { mutableStateOf<String?>(null) }
    var loading by remember(article.link) { mutableStateOf(true) }

    androidx.compose.runtime.LaunchedEffect(article.link) {
        loading = true
        viewModel.summarizeArticle(article) { result ->
            loading = false
            result.onSuccess { summary = it }
                .onFailure { error = it.message ?: "تعذّر التلخيص." }
        }
    }

    androidx.compose.material3.ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 30.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(article.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "${article.sourceName} · ${Dates.relativePast(article.publishedAt)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            when {
                loading -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                    Text("جارٍ التلخيص…", style = MaterialTheme.typography.bodyMedium)
                }
                error != null -> ErrorBanner(error!!)
                summary != null -> GlassCard { RichText(summary!!) }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PrimaryButton("افتح الخبر") { onOpen(); onDismiss() }
                com.rafeeq.companion.ui.components.SecondaryButton("إغلاق") { onDismiss() }
            }
        }
    }
}
