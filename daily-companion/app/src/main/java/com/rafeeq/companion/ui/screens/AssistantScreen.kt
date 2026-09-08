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
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material.icons.filled.VolumeUp
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import com.rafeeq.companion.ConfirmationOverlay
import com.rafeeq.companion.data.ChatMessage
import com.rafeeq.companion.data.Shortcut
import com.rafeeq.companion.data.voice.VoiceEngine
import com.rafeeq.companion.ui.components.VoiceWave
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.ErrorBanner
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.PrimaryButton
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.FileProvider
import coil3.compose.AsyncImage
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

    val shortcuts by viewModel.shortcuts.collectAsState()

    // اختصارات المستخدم أولًا، ثم الاقتراحات الجاهزة لملء الصف.
    val suggestions = remember(shortcuts) {
        val builtIn = Assistant.quickActions.map {
            Shortcut(id = "builtin:" + it.label, label = it.label, emoji = it.emoji, prompt = it.prompt)
        }
        (shortcuts + builtIn).take(10)
    }

    val clipboard = LocalClipboardManager.current
    val context = LocalContext.current
    var input by remember { mutableStateOf("") }
    var showHistory by remember { mutableStateOf(false) }

    // ---- إرفاق صورة: «شوف هذي» بدل وصفها بالكلام
    var attachment by remember { mutableStateOf<android.net.Uri?>(null) }
    var showAttachMenu by remember { mutableStateOf(false) }
    var pendingCapture by remember { mutableStateOf<android.net.Uri?>(null) }

    val pickImage = rememberLauncherForActivityResult(
        ActivityResultContracts.GetContent(),
    ) { uri -> if (uri != null) attachment = uri }

    val takePhoto = rememberLauncherForActivityResult(
        ActivityResultContracts.TakePicture(),
    ) { saved -> if (saved) attachment = pendingCapture }

    val cameraPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            pendingCapture = newCaptureUri(context)
            pendingCapture?.let { takePhoto.launch(it) }
        } else {
            viewModel.showMessage("أحتاج إذن الكاميرا لألتقط الصورة.")
        }
    }
    val listState = rememberLazyListState()

    val voiceState by viewModel.voice.state.collectAsState()
    val amplitude by viewModel.voice.amplitude.collectAsState()
    val partial by viewModel.voice.partial.collectAsState()
    val listening = voiceState == VoiceEngine.State.LISTENING

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            viewModel.voice.startListening(
                languageTag = settings.voiceLanguage,
                onResult = { viewModel.sendMessage(it, spoken = true) },
                onFailure = { viewModel.showMessage(it) },
            )
        } else {
            viewModel.showMessage("أحتاج إذن الميكروفون لأسمعك.")
        }
    }

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
                    items(messages, key = { it.id }) { message ->
                        MessageBubble(
                            message = message,
                            isLast = message.id == messages.lastOrNull()?.id,
                            onCopy = {
                                clipboard.setText(AnnotatedString(message.content))
                                viewModel.showMessage("نُسخ النص.")
                            },
                            onSpeak = { viewModel.speak(message.content) },
                            onRegenerate = { viewModel.regenerateLast() },
                        )
                    }
                    if (ai.streaming &&
                        (messages.lastOrNull()?.content.isNullOrBlank() || ai.searching != null)
                    ) {
                        item { TypingIndicator(ai) }
                    }
                }
            }
        }

        ai.error?.let {
            ErrorBanner(it, Modifier.padding(horizontal = 16.dp, vertical = 4.dp))
        }

        AnimatedVisibility(visible = listening) {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                VoiceWave(
                    amplitude = amplitude,
                    active = true,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.fillMaxWidth(0.6f).height(22.dp),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    partial.ifBlank { "أستمع…" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // ------------------------------------------------ الأوامر السريعة
        AnimatedVisibility(visible = messages.isEmpty() && !ai.streaming) {
            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            ) {
                items(suggestions, key = { it.id }) { action ->
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

        // ------------------------------------------------ الصورة المرفقة
        attachment?.let { uri ->
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                AsyncImage(
                    model = uri,
                    contentDescription = "الصورة المرفقة",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(54.dp).clip(RoundedCornerShape(12.dp)),
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    "صورة مرفقة — اكتب سؤالك عنها",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { attachment = null }) {
                    Icon(Icons.Filled.Close, contentDescription = "إزالة الصورة")
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
            Box {
                IconButton(
                    onClick = { showAttachMenu = true },
                    modifier = Modifier.size(44.dp),
                ) {
                    Icon(
                        Icons.Filled.AddAPhoto,
                        contentDescription = "إرفاق صورة",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                }
                DropdownMenu(
                    expanded = showAttachMenu,
                    onDismissRequest = { showAttachMenu = false },
                ) {
                    DropdownMenuItem(
                        text = { Text("من المعرض") },
                        leadingIcon = { Icon(Icons.Filled.PhotoLibrary, null) },
                        onClick = {
                            showAttachMenu = false
                            pickImage.launch("image/*")
                        },
                    )
                    DropdownMenuItem(
                        text = { Text("التقاط صورة") },
                        leadingIcon = { Icon(Icons.Filled.AddAPhoto, null) },
                        onClick = {
                            showAttachMenu = false
                            cameraPermission.launch(Manifest.permission.CAMERA)
                        },
                    )
                }
            }
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(
                        if (listening) Brush.linearGradient(Gradients.Ember)
                        else Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                            ),
                        ),
                    )
                    .clickable {
                        if (listening) viewModel.voice.cancel()
                        else micPermission.launch(Manifest.permission.RECORD_AUDIO)
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    Icons.Filled.Mic,
                    contentDescription = "التحدّث",
                    tint = if (listening) Color(0xFF06121F)
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(21.dp),
                )
            }
            Spacer(Modifier.width(8.dp))
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("اكتب أو تحدّث…") },
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
                        else if (input.isBlank() && attachment == null) Brush.linearGradient(
                            listOf(
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                                MaterialTheme.colorScheme.surfaceContainerHighest,
                            ),
                        )
                        else Brush.linearGradient(Gradients.Aurora),
                    )
                    .clickable(enabled = ai.streaming || input.isNotBlank() || attachment != null) {
                        if (ai.streaming) {
                            viewModel.stopStreaming()
                        } else {
                            viewModel.sendMessage(input, image = attachment)
                            input = ""
                            attachment = null
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (ai.streaming) Icons.Filled.Stop else Icons.Filled.Send,
                    contentDescription = if (ai.streaming) "إيقاف" else "إرسال",
                    tint = if (input.isBlank() && attachment == null && !ai.streaming)
                        MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFF06121F),
                    modifier = Modifier.size(21.dp),
                )
            }
        }
    }

    ConfirmationOverlay(viewModel)

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
private fun ToolRunChip(run: com.rafeeq.companion.data.ToolRun) {
    Row(
        modifier = Modifier
            .padding(vertical = 2.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                when {
                    run.denied -> MaterialTheme.colorScheme.error.copy(alpha = 0.12f)
                    run.ok -> MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                    else -> MaterialTheme.colorScheme.error.copy(alpha = 0.12f)
                },
            )
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(if (run.denied) "🚫" else if (run.ok) "✅" else "⚠️")
        Spacer(Modifier.width(6.dp))
        Text(
            run.label,
            style = MaterialTheme.typography.labelMedium,
            color = if (run.ok && !run.denied) MaterialTheme.colorScheme.primary
            else MaterialTheme.colorScheme.error,
        )
    }
}

/**
 * فقاعة رسالة. الضغط على ردّ المساعد يُظهر أزرار النسخ والقراءة وإعادة التوليد،
 * ونُبقيها مخفية حتى لا تزدحم المحادثة.
 */
@Composable
private fun MessageBubble(
    message: ChatMessage,
    isLast: Boolean = false,
    onCopy: () -> Unit = {},
    onSpeak: () -> Unit = {},
    onRegenerate: () -> Unit = {},
) {
    val isUser = message.role == "user"
    var showActions by remember(message.id) { mutableStateOf(false) }
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start,
    ) {
        if (isUser) {
            Column(horizontalAlignment = Alignment.End) {
                message.imagePath?.let { path ->
                    AsyncImage(
                        model = java.io.File(path),
                        contentDescription = "صورة أرسلتها",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .widthIn(max = 220.dp)
                            .height(160.dp)
                            .clip(RoundedCornerShape(18.dp)),
                    )
                    Spacer(Modifier.height(4.dp))
                }
                if (message.content.isNotBlank()) {
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
                }
            }
        } else {
            Column(horizontalAlignment = Alignment.Start) {
                Box(
                    modifier = Modifier
                        .widthIn(max = 340.dp)
                        .clip(RoundedCornerShape(22.dp, 22.dp, 22.dp, 6.dp))
                        .background(
                            if (message.error) MaterialTheme.colorScheme.error.copy(alpha = 0.12f)
                            else MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f),
                        )
                        .clickable { showActions = !showActions }
                        .padding(horizontal = 15.dp, vertical = 12.dp),
                ) {
                    Column {
                        message.toolRuns.forEach { ToolRunChip(it) }
                        if (message.toolRuns.isNotEmpty() && message.content.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                        }
                        if (message.content.isNotBlank()) {
                            RichText(
                                text = message.content,
                                color = if (message.error) MaterialTheme.colorScheme.error
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
                AnimatedVisibility(visible = showActions && message.content.isNotBlank()) {
                    Row(
                        Modifier.padding(top = 2.dp, start = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MessageAction(Icons.Filled.ContentCopy, "نسخ", onCopy)
                        MessageAction(Icons.Filled.VolumeUp, "استمع", onSpeak)
                        if (isLast) MessageAction(Icons.Filled.Refresh, "أعد التوليد", onRegenerate)
                    }
                }
            }
        }
    }
}

@Composable
private fun MessageAction(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            icon,
            contentDescription = label,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(14.dp),
        )
        Spacer(Modifier.width(4.dp))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun TypingIndicator(ai: com.rafeeq.companion.ui.AiState) {
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
                    when {
                        ai.searching != null -> "أبحث في الإنترنت…"
                        ai.runningTool != null -> "أنفّذ الأمر…"
                        else -> "يفكّر…"
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** ملف مؤقت في ذاكرة التطبيق تكتب فيه الكاميرا الصورة الملتقطة. */
private fun newCaptureUri(context: android.content.Context): android.net.Uri? = runCatching {
    val dir = java.io.File(context.cacheDir, "captures").apply { mkdirs() }
    val file = java.io.File(dir, "cap_${System.currentTimeMillis()}.jpg")
    FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
}.getOrNull()
