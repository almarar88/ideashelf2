package com.rafeeq.companion.ui.screens

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.ChatMessage
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.ErrorBanner
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.theme.Gradients

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AssistantScreen(viewModel: AppViewModel, onOpenSettings: () -> Unit) {
    val settings by viewModel.settings.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    val activeId by viewModel.activeConversationId.collectAsState()
    val ai by viewModel.ai.collectAsState()

    val conversation = conversations.firstOrNull { it.id == activeId }
    val messages = conversation?.messages.orEmpty()

    var input by remember { mutableStateOf("") }
    var showHistory by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    LaunchedEffect(messages.size, messages.lastOrNull()?.content?.length) {
        if (messages.isNotEmpty()) {
            runCatching { listState.animateScrollToItem(messages.size - 1) }
        }
    }

    Column(Modifier.fillMaxWidth().imePadding()) {

        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("المساعد", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    conversation?.title ?: "يعرف يومك: طقسك، صلواتك، مهامك وأخبارك",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            IconButton(onClick = { showHistory = true }) {
                Icon(Icons.Filled.History, contentDescription = "المحادثات السابقة")
            }
            IconButton(onClick = { viewModel.newConversation() }) {
                Icon(Icons.Filled.Add, contentDescription = "محادثة جديدة")
            }
        }

        if (!settings.hasApiKey) {
            Column(Modifier.padding(16.dp)) {
                GradientCard(colors = Gradients.Dusk) {
                    Text(
                        "فعّل المساعد الذكي",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        "المساعد يعمل عبر مفتاح Anthropic خاص بك. المفتاح يُحفظ على جهازك فقط، " +
                            "ولا يُرسل إلى أي جهة غير Anthropic مباشرة.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = Color.White.copy(alpha = 0.92f),
                    )
                    Spacer(Modifier.height(14.dp))
                    PrimaryButton("أضِف المفتاح الآن") { onOpenSettings() }
                }
            }
            return@Column
        }

        Box(Modifier.weight(1f)) {
            if (messages.isEmpty()) {
                Column(
                    Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    EmptyState(
                        emoji = "✨",
                        title = "كيف أساعدك اليوم؟",
                        subtitle = "اسألني أي شيء، أو ابدأ بأحد الاقتراحات في الأسفل.",
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    items(messages, key = { it.id }) { message -> MessageBubble(message) }
                    if (ai.streaming && messages.lastOrNull()?.content.isNullOrBlank()) {
                        item { TypingIndicator() }
                    }
                }
            }
        }

        ai.error?.let {
            ErrorBanner(it, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        }

        // ------------------------------------------------ الأوامر السريعة
        AnimatedVisibility(visible = messages.isEmpty() && !ai.streaming) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            ) {
                items(Assistant.quickActions) { action ->
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.75f))
                            .clickable { viewModel.sendMessage(action.prompt) }
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(action.emoji)
                        Spacer(Modifier.width(7.dp))
                        Text(action.label, style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }

        // ------------------------------------------------ حقل الإدخال
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.Bottom,
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("اكتب رسالتك…") },
                shape = RoundedCornerShape(24.dp),
                maxLines = 5,
                modifier = Modifier.weight(1f).heightIn(max = 148.dp),
            )
            Spacer(Modifier.width(8.dp))
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(
                        if (ai.streaming) Brush.linearGradient(Gradients.Ember)
                        else if (input.isBlank()) Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                            ),
                        )
                        else Brush.linearGradient(Gradients.Aurora),
                    )
                    .clickable(enabled = ai.streaming || input.isNotBlank()) {
                        if (ai.streaming) {
                            viewModel.stopStreaming()
                        } else {
                            viewModel.sendMessage(input)
                            input = ""
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (ai.streaming) Icons.Filled.Stop else Icons.Filled.Send,
                    contentDescription = if (ai.streaming) "إيقاف" else "إرسال",
                    tint = if (input.isBlank() && !ai.streaming)
                        MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFF06121F),
                    modifier = Modifier.size(21.dp),
                )
            }
        }
    }

    if (showHistory) {
        ModalBottomSheet(onDismissRequest = { showHistory = false }) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(bottom = 30.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    "المحادثات",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 8.dp),
                )
                if (conversations.isEmpty()) {
                    Text(
                        "لا توجد محادثات بعد.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                conversations.sortedByDescending { it.updatedAt }.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .clickable {
                                viewModel.selectConversation(item.id)
                                showHistory = false
                            }
                            .padding(horizontal = 10.dp, vertical = 11.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                item.title,
                                style = MaterialTheme.typography.bodyMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                fontWeight = if (item.id == activeId) FontWeight.Bold else FontWeight.Normal,
                            )
                            Text(
                                "${item.messages.size} رسالة · ${Dates.relativePast(item.updatedAt)}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        IconButton(onClick = { viewModel.deleteConversation(item.id) }) {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = "حذف",
                                tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == "user"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        if (isUser) {
            Box(
                modifier = Modifier
                    .widthIn(max = 300.dp)
                    .clip(RoundedCornerShape(22.dp, 22.dp, 6.dp, 22.dp))
                    .background(Brush.linearGradient(Gradients.Aurora))
                    .padding(horizontal = 15.dp, vertical = 11.dp),
            ) {
                Text(
                    message.content,
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color(0xFF06121F),
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .widthIn(max = 340.dp)
                    .clip(RoundedCornerShape(22.dp, 22.dp, 22.dp, 6.dp))
                    .background(
                        if (message.error) MaterialTheme.colorScheme.error.copy(alpha = 0.12f)
                        else MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f),
                    )
                    .padding(horizontal = 15.dp, vertical = 12.dp),
            ) {
                RichText(
                    text = message.content,
                    color = if (message.error) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
private fun TypingIndicator() {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(20.dp))
                .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f))
                .padding(horizontal = 16.dp, vertical = 13.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircularProgressIndicator(Modifier.size(14.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(9.dp))
                Text(
                    "يفكّر…",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
