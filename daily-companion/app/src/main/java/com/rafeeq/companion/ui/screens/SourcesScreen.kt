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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.news.NewsCategories
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.safeBottomSpace
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.theme.Violet
import kotlinx.coroutines.launch

/** إدارة مصادر الأخبار والمواضيع التي يتابعها المستخدم. */
@Composable
fun SourcesScreen(viewModel: AppViewModel) {
    val sources by viewModel.sources.collectAsState()
    val topics by viewModel.topics.collectAsState()

    var showAddSource by remember { mutableStateOf(false) }
    var newTopic by remember { mutableStateOf("") }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = safeBottomSpace()),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column {
                Text(
                    "المصادر والمواضيع",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "اختر ما يصلك بالضبط. تُجلب الأخبار من موجزات RSS مباشرة دون وسيط.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // -------------------------------------------------- مواضيعي
        item { SectionTitle("مواضيعي") }
        item {
            GlassCard {
                Text(
                    "اكتب أي موضوع يهمّك وسنتابعه لك من مصادر متعددة — مثل «الذكاء الاصطناعي» " +
                        "أو «أسعار النفط» أو اسم فريقك المفضّل.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RafeeqTextField(
                        newTopic, { newTopic = it }, "موضوع جديد",
                        placeholder = "مثال: الذكاء الاصطناعي",
                        modifier = Modifier.weight(1f),
                    )
                    Spacer(Modifier.width(8.dp))
                    IconButton(
                        onClick = {
                            viewModel.addTopic(newTopic)
                            newTopic = ""
                        },
                        enabled = newTopic.isNotBlank(),
                    ) {
                        Icon(Icons.Filled.Add, contentDescription = "إضافة موضوع", tint = Violet)
                    }
                }

                if (topics.isNotEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    topics.forEach { topic ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(
                                Modifier
                                    .size(7.dp)
                                    .clip(CircleShape)
                                    .background(Violet),
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                topic.query,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(
                                onClick = { viewModel.removeTopic(topic) },
                                modifier = Modifier.size(30.dp),
                            ) {
                                Icon(
                                    Icons.Filled.Close,
                                    contentDescription = "حذف",
                                    modifier = Modifier.size(15.dp),
                                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                }
            }
        }

        // -------------------------------------------------- المصادر
        item {
            SectionTitle(
                "مصادر الأخبار (${sources.count { it.enabled }}/${sources.size})",
                action = "إضافة",
                onAction = { showAddSource = true },
            )
        }

        NewsCategories.ordered.filter { it != NewsCategories.MY_TOPICS }.forEach { category ->
            val inCategory = sources.filter { it.category == category }
            if (inCategory.isNotEmpty()) {
                item {
                    Text(
                        category,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(start = 6.dp, top = 6.dp),
                    )
                }
                item {
                    GlassCard(padding = PaddingValues(vertical = 4.dp, horizontal = 6.dp)) {
                        inCategory.forEach { source ->
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .clickable { viewModel.setSourceEnabled(source, !source.enabled) }
                                    .padding(horizontal = 10.dp, vertical = 9.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Column(Modifier.weight(1f)) {
                                    Text(source.name, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        source.url,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                                if (source.custom) {
                                    IconButton(
                                        onClick = { viewModel.removeSource(source) },
                                        modifier = Modifier.size(32.dp),
                                    ) {
                                        Icon(
                                            Icons.Filled.Delete,
                                            contentDescription = "حذف",
                                            tint = MaterialTheme.colorScheme.error,
                                            modifier = Modifier.size(16.dp),
                                        )
                                    }
                                }
                                Switch(
                                    checked = source.enabled,
                                    onCheckedChange = { viewModel.setSourceEnabled(source, it) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddSource) {
        AddSourceDialog(viewModel = viewModel, onDismiss = { showAddSource = false })
    }
}

@Composable
private fun AddSourceDialog(viewModel: AppViewModel, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var category by remember { mutableStateOf(NewsCategories.TOP) }
    var checking by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var ok by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("إضافة مصدر", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "الصق رابط موجز RSS أو Atom. سنتحقّق منه قبل الإضافة.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                RafeeqTextField(url, { url = it; status = null; ok = false }, "رابط الموجز",
                    placeholder = "https://example.com/rss")
                RafeeqTextField(name, { name = it }, "اسم المصدر (اختياري)")
                Text("التصنيف", style = MaterialTheme.typography.labelMedium)
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    NewsCategories.ordered
                        .filter { it != NewsCategories.MY_TOPICS }
                        .chunked(3)
                        .forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                row.forEach {
                                    Chip(it, category == it, { category = it })
                                }
                            }
                        }
                }
                status?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (ok) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.error,
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = url.isNotBlank() && !checking,
                onClick = {
                    if (ok) {
                        viewModel.addSource(
                            name.ifBlank { url.substringAfter("//").substringBefore("/") },
                            url.trim(),
                            category,
                        )
                        onDismiss()
                        return@TextButton
                    }
                    checking = true
                    status = "جارٍ التحقّق…"
                    scope.launch {
                        viewModel.validateFeed(url.trim())
                            .onSuccess { (title, count) ->
                                ok = true
                                if (name.isBlank()) name = title
                                status = "الموجز سليم — $count خبرًا. اضغط مرة أخرى للإضافة."
                            }
                            .onFailure {
                                ok = false
                                status = "رابط غير صالح: ${it.message ?: "تعذّر القراءة"}"
                            }
                        checking = false
                    }
                },
            ) {
                if (checking) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text(if (ok) "إضافة" else "تحقّق")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}
