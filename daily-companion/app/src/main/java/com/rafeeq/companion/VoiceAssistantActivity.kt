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
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rafeeq.companion.data.voice.VoiceEngine
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.OrbState
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.components.VoicePulse
import com.rafeeq.companion.ui.theme.RafeeqTheme

/**
 * المساعد الصوتي — يظهر عند استدعاء Alcode Ai كمساعد النظام
 * (الضغط المطوّل على زر التشغيل)، أو من التطبيق واللوحة السريعة.
 *
 * التصميم مقصود أن يكون صغيرًا وهادئًا: بطاقة عائمة قرب أسفل الشاشة تبقى
 * ما تحتها ظاهرًا، تكبر فقط بقدر ما يحتاجه الرد. الشاشة الممتلئة كانت تُشعر
 * بأن التطبيق استولى على الجهاز لأجل أمر من كلمتين.
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
            viewModel.voice.startListening(
                languageTag = settings.voiceLanguage,
                onResult = { spokenText = it },
                onFailure = { errorText = it },
            )
        } else {
            errorText = "أحتاج إذن الميكروفون لأسمعك."
        }
    }

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

    LaunchedEffect(spokenText) {
        if (spokenText.isNotBlank()) {
            viewModel.newConversation()
            viewModel.sendMessage(spokenText, spoken = true)
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

    val status = when {
        errorText != null -> "تعذّر"
        ai.runningTool != null -> "أنفّذ…"
        ai.streaming -> "لحظة…"
        voiceState == VoiceEngine.State.LISTENING -> "أستمع"
        voiceState == VoiceEngine.State.PROCESSING -> "لحظة…"
        voiceState == VoiceEngine.State.SPEAKING -> "أتحدّث"
        else -> "اضغط للتحدّث"
    }

    val heard = partial.ifBlank { spokenText }
    val replyText = reply?.content.orEmpty()
    val busy = ai.streaming || voiceState == VoiceEngine.State.LISTENING

    Box(
        Modifier
            .fillMaxSize()
            // تعتيم خفيف فقط — يبقى ما خلف البطاقة مرئيًا ومفهومًا.
            .background(Color.Black.copy(alpha = 0.28f))
            .clickable(
                interactionSource = remember { MutableInteractionSource() },
                indication = null,
            ) { onClose() },
    ) {
        AnimatedVisibility(
            visible = true,
            enter = fadeIn(tween(180)) + slideInVertically(
                spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = Spring.StiffnessMediumLow),
            ) { it / 3 },
            modifier = Modifier.align(Alignment.BottomCenter),
        ) {
            Column(
                Modifier
                    .navigationBarsPadding()
                    .padding(horizontal = 12.dp, vertical = 14.dp)
                    .clip(RoundedCornerShape(30.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.97f))
                    .border(
                        1.dp,
                        MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f),
                        RoundedCornerShape(30.dp),
                    )
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { },
            ) {
                // ---------------------------------------- الصف الرئيسي
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier
                            .size(44.dp)
                            .clip(CircleShape)
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
                        if (orbState == OrbState.IDLE && heard.isBlank()) {
                            Icon(
                                Icons.Filled.Mic,
                                contentDescription = "تحدّث",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(22.dp),
                            )
                        } else {
                            VoicePulse(
                                state = orbState,
                                amplitude = amplitude,
                                accent = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.fillMaxSize(),
                            )
                        }
                    }

                    Spacer(Modifier.width(14.dp))

                    Column(Modifier.weight(1f)) {
                        Text(
                            status,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (errorText != null) MaterialTheme.colorScheme.error
                            else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            text = heard.ifBlank { errorText ?: "بماذا أساعدك؟" },
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    }

                    Spacer(Modifier.width(8.dp))

                    Box(
                        Modifier
                            .size(30.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                            .clickable { onClose() },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Close,
                            contentDescription = "إغلاق",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(15.dp),
                        )
                    }
                }

                // ---------------------------------------- الرد والأوامر المنفّذة
                AnimatedVisibility(
                    visible = replyText.isNotBlank() || reply?.toolRuns?.isNotEmpty() == true,
                    enter = fadeIn() + expandVertically(),
                    exit = fadeOut() + shrinkVertically(),
                ) {
                    Column {
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp)
                                .height(1.dp)
                                .background(MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f)),
                        )
                        Column(
                            Modifier
                                .fillMaxWidth()
                                .heightIn(max = 220.dp)
                                .verticalScroll(rememberScrollState())
                                .padding(horizontal = 16.dp, vertical = 13.dp),
                        ) {
                            reply?.toolRuns?.forEach { run ->
                                Row(
                                    Modifier.padding(bottom = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Box(
                                        Modifier
                                            .size(5.dp)
                                            .clip(CircleShape)
                                            .background(
                                                if (run.ok) MaterialTheme.colorScheme.primary
                                                else MaterialTheme.colorScheme.error,
                                            ),
                                    )
                                    Spacer(Modifier.width(9.dp))
                                    Text(
                                        run.label,
                                        style = MaterialTheme.typography.labelMedium,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                            if (replyText.isNotBlank()) {
                                if (reply?.toolRuns?.isNotEmpty() == true) Spacer(Modifier.height(4.dp))
                                RichText(replyText)
                            }
                        }
                    }
                }

                // ---------------------------------------- شريط سفلي خفيف
                AnimatedVisibility(visible = replyText.isNotBlank() && !busy) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp)
                            .padding(bottom = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        SoftButton("تابع الحديث", Modifier.weight(1f)) {
                            spokenText = ""
                            micPermission.launch(Manifest.permission.RECORD_AUDIO)
                        }
                        SoftButton("افتح التطبيق", Modifier.weight(1f), icon = true) { onExpand() }
                    }
                }
            }
        }

        ConfirmationOverlay(viewModel)
    }
}

@Composable
private fun SoftButton(
    label: String,
    modifier: Modifier = Modifier,
    icon: Boolean = false,
    onClick: () -> Unit,
) {
    Row(
        modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.8f))
            .clickable { onClick() }
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon) {
            Icon(
                Icons.Filled.KeyboardArrowUp,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(15.dp),
            )
            Spacer(Modifier.width(5.dp))
        }
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
    }
}

/**
 * حوار تأكيد الأوامر الحسّاسة. معطّل افتراضيًا — لا يظهر إلا إن فعّله
 * المستخدم من شاشة التحكّم.
 */
@Composable
fun ConfirmationOverlay(viewModel: AppViewModel) {
    val pending by viewModel.pendingConfirmation.collectAsState()

    AnimatedVisibility(visible = pending != null, enter = fadeIn(), exit = fadeOut()) {
        pending?.let { request ->
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .clickable(
                        interactionSource = remember { MutableInteractionSource() },
                        indication = null,
                    ) { },
                contentAlignment = Alignment.Center,
            ) {
                Column(
                    Modifier
                        .fillMaxWidth(0.86f)
                        .clip(RoundedCornerShape(26.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHigh)
                        .padding(20.dp),
                ) {
                    Text(
                        request.title,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        request.details,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(16.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SoftButton("إلغاء", Modifier.weight(1f)) {
                            viewModel.resolveConfirmation(false)
                        }
                        Box(
                            Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(16.dp))
                                .background(MaterialTheme.colorScheme.primary)
                                .clickable { viewModel.resolveConfirmation(true) }
                                .padding(vertical = 10.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                "نفّذ",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary,
                            )
                        }
                    }
                }
            }
        }
    }
}
