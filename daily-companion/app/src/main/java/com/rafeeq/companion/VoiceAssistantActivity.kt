package com.rafeeq.companion

import android.Manifest
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.OpenInFull
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rafeeq.companion.data.voice.VoiceEngine
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.OrbState
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.components.VoiceOrb
import com.rafeeq.companion.ui.components.VoiceWave
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.RafeeqTheme

/**
 * المساعد الصوتي — الشاشة التي تظهر عند استدعاء Alcode Ai كمساعد النظام
 * (الضغط المطوّل على زر التشغيل، أو من إيماءة المساعد).
 *
 * شاشة شفافة تنزلق من الأسفل، تستمع فورًا، وتردّ صوتًا ونصًا.
 */
class VoiceAssistantActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)

        setContent {
            val vm: AppViewModel = viewModel()
            val settings by vm.settings.collectAsState()
            RafeeqTheme(mode = settings.themeMode, dynamicColor = settings.dynamicColor) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    VoiceAssistantScreen(
                        viewModel = vm,
                        onClose = { finish() },
                        onExpand = {
                            startActivity(
                                Intent(this, MainActivity::class.java)
                                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                            )
                            finish()
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun VoiceAssistantScreen(
    viewModel: AppViewModel,
    onClose: () -> Unit,
    onExpand: () -> Unit,
) {
    val settings by viewModel.settings.collectAsState()
    val ai by viewModel.ai.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    val activeId by viewModel.activeConversationId.collectAsState()

    val voiceState by viewModel.voice.state.collectAsState()
    val amplitude by viewModel.voice.amplitude.collectAsState()
    val partial by viewModel.voice.partial.collectAsState()

    var spokenText by remember { mutableStateOf("") }
    var errorText by remember { mutableStateOf<String?>(null) }
    var started by remember { mutableStateOf(false) }

    val reply = conversations.firstOrNull { it.id == activeId }
        ?.messages?.lastOrNull { it.role == "assistant" }

    val micPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            listen(viewModel, settings.voiceLanguage, { spokenText = it }, { errorText = it })
        } else {
            errorText = "أحتاج إذن الميكروفون لأسمعك."
        }
    }

    // نبدأ الاستماع فور فتح الشاشة — هذا ما يجعلها تُشبه مساعد النظام.
    LaunchedEffect(Unit) {
        viewModel.voice.prepareTts()
        viewModel.refreshCapabilities()
        if (!started) {
            started = true
            if (!settings.hasApiKey) {
                errorText = "أضِف مفتاح Anthropic من إعدادات Alcode Ai أولًا."
            } else {
                micPermission.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            viewModel.voice.cancel()
            viewModel.voice.stopSpeaking()
        }
    }

    val orbState = when {
        ai.streaming -> OrbState.THINKING
        voiceState == VoiceEngine.State.LISTENING -> OrbState.LISTENING
        voiceState == VoiceEngine.State.PROCESSING -> OrbState.THINKING
        voiceState == VoiceEngine.State.SPEAKING -> OrbState.SPEAKING
        else -> OrbState.IDLE
    }

    val statusLabel = when {
        errorText != null -> "تعذّر"
        ai.runningTool != null -> "أنفّذ الأمر…"
        ai.streaming -> "أفكّر…"
        voiceState == VoiceEngine.State.LISTENING -> "أستمع…"
        voiceState == VoiceEngine.State.PROCESSING -> "لحظة…"
        voiceState == VoiceEngine.State.SPEAKING -> "أتحدّث…"
        else -> "اضغط الميكروفون للتحدّث"
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(
                        Color.Black.copy(alpha = 0.35f),
                        Color.Black.copy(alpha = 0.72f),
                    ),
                ),
            )
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) { onClose() },
    ) {
        AnimatedVisibility(
            visible = true,
            enter = fadeIn() + slideInVertically { it / 2 },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 34.dp, topEnd = 34.dp))
                    .background(MaterialTheme.colorScheme.background)
                    .navigationBarsPadding()
                    .padding(horizontal = 22.dp, vertical = 18.dp)
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { /* نمنع إغلاق الشاشة عند الضغط داخل البطاقة */ },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                // مقبض السحب
                Box(
                    Modifier
                        .width(42.dp)
                        .height(4.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.outlineVariant),
                )

                Spacer(Modifier.height(14.dp))

                VoiceOrb(
                    state = orbState,
                    amplitude = amplitude,
                    colors = Gradients.Aurora + Gradients.Dusk.last(),
                    modifier = Modifier.size(148.dp),
                )

                Spacer(Modifier.height(10.dp))

                Text(
                    statusLabel,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (errorText != null) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )

                if (voiceState == VoiceEngine.State.LISTENING) {
                    Spacer(Modifier.height(8.dp))
                    VoiceWave(
                        amplitude = amplitude,
                        active = true,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.fillMaxWidth(0.7f).height(26.dp),
                    )
                }

                Spacer(Modifier.height(12.dp))

                // ما قاله المستخدم — يظهر أثناء التعرّف ثم يثبت
                val heard = partial.ifBlank { spokenText }
                if (heard.isNotBlank()) {
                    Text(
                        heard,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurface,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                errorText?.let {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        it,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.error,
                        textAlign = TextAlign.Center,
                    )
                }

                // رد المساعد
                val replyText = reply?.content.orEmpty()
                if (replyText.isNotBlank() || reply?.toolRuns?.isNotEmpty() == true) {
                    Spacer(Modifier.height(14.dp))
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .heightIn(max = 260.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.7f))
                            .padding(16.dp)
                            .verticalScroll(rememberScrollState()),
                    ) {
                        reply?.toolRuns?.forEach { run ->
                            Row(
                                Modifier.padding(bottom = 6.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(if (run.ok) "✅" else if (run.denied) "🚫" else "⚠️")
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    run.label,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        if (replyText.isNotBlank()) RichText(replyText)
                    }
                }

                Spacer(Modifier.height(18.dp))

                // أزرار التحكّم
                Row(
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    CircleButton(
                        icon = Icons.Filled.Close,
                        description = "إغلاق",
                        background = MaterialTheme.colorScheme.surfaceContainerHighest,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        onClick = onClose,
                    )

                    val busy = ai.streaming || voiceState == VoiceEngine.State.LISTENING ||
                        voiceState == VoiceEngine.State.SPEAKING
                    Box(
                        Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .background(Brush.linearGradient(Gradients.Aurora))
                            .clickable {
                                errorText = null
                                if (busy) {
                                    viewModel.voice.cancel()
                                    viewModel.voice.stopSpeaking()
                                    viewModel.stopStreaming()
                                } else {
                                    spokenText = ""
                                    micPermission.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            if (busy) Icons.Filled.Stop else Icons.Filled.Mic,
                            contentDescription = if (busy) "إيقاف" else "تحدّث",
                            tint = Color(0xFF06121F),
                            modifier = Modifier.size(30.dp),
                        )
                    }

                    CircleButton(
                        icon = Icons.Filled.OpenInFull,
                        description = "فتح التطبيق",
                        background = MaterialTheme.colorScheme.surfaceContainerHighest,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        onClick = onExpand,
                    )
                }

                Spacer(Modifier.height(8.dp))
            }
        }

        // حوار التأكيد للأوامر الحسّاسة يظهر فوق كل شيء
        ConfirmationOverlay(viewModel)
    }

    // نرسل النص إلى المساعد بمجرد اكتمال التعرّف عليه
    LaunchedEffect(spokenText) {
        if (spokenText.isNotBlank()) {
            viewModel.newConversation()
            viewModel.sendMessage(spokenText, spoken = true)
        }
    }
}

private fun listen(
    viewModel: AppViewModel,
    language: String,
    onResult: (String) -> Unit,
    onError: (String) -> Unit,
) {
    viewModel.voice.startListening(
        languageTag = language,
        onResult = onResult,
        onFailure = onError,
    )
}

@Composable
private fun CircleButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    description: String,
    background: Color,
    tint: Color,
    onClick: () -> Unit,
) {
    Box(
        Modifier
            .size(50.dp)
            .clip(CircleShape)
            .background(background)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = tint, modifier = Modifier.size(21.dp))
    }
}

/** حوار تأكيد الأوامر الحسّاسة — مشترك بين الشاشة الصوتية وشاشة المحادثة. */
@Composable
fun ConfirmationOverlay(viewModel: AppViewModel) {
    val pending by viewModel.pendingConfirmation.collectAsState()

    AnimatedVisibility(visible = pending != null, enter = fadeIn(), exit = fadeOut()) {
        pending?.let { request ->
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.6f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { },
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    Modifier
                        .fillMaxWidth(0.88f)
                        .clip(RoundedCornerShape(26.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                        .padding(22.dp),
                ) {
                    Text("⚠️", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.height(6.dp))
                    Text(
                        request.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        request.details,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(18.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                                .clickable { viewModel.resolveConfirmation(false) }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) { Text("إلغاء", style = MaterialTheme.typography.labelLarge) }

                        Box(
                            Modifier
                                .weight(1f)
                                .clip(CircleShape)
                                .background(Brush.horizontalGradient(Gradients.Aurora))
                                .clickable { viewModel.resolveConfirmation(true) }
                                .padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "نفّذ",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF06121F),
                            )
                        }
                    }
                }
            }
        }
    }
}
