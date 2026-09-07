package com.rafeeq.companion

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
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
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.RichText
import com.rafeeq.companion.ui.theme.RafeeqTheme

/**
 * يستقبل أي نص أو رابط تشاركه من أي تطبيق.
 *
 * هذا يجعل المساعد متاحًا داخل بقية تطبيقاتك دون فتحه: حدّد نصًا في المتصفّح
 * أو شارك رابط مقال، واختر Alcode Ai، فيعطيك خلاصته فورًا.
 */
class ShareActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        val shared = when (intent?.action) {
            Intent.ACTION_SEND -> intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
            Intent.ACTION_PROCESS_TEXT ->
                intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString().orEmpty()
            else -> ""
        }.trim()

        val subject = intent?.getStringExtra(Intent.EXTRA_SUBJECT).orEmpty()

        if (shared.isBlank()) {
            finish()
            return
        }

        setContent {
            val vm: AppViewModel = viewModel()
            val settings by vm.settings.collectAsState()
            RafeeqTheme(mode = settings.themeMode, dynamicColor = settings.dynamicColor) {
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
                    ShareSheet(
                        viewModel = vm,
                        text = shared,
                        subject = subject,
                        onClose = { finish() },
                    )
                }
            }
        }
    }
}

private data class ShareAction(val label: String, val emoji: String, val instruction: String)

private val shareActions = listOf(
    ShareAction("لخّص", "📝", "لخّص النص التالي في ٣ نقاط قصيرة، ثم سطر عمّا يحتاج تحقّقًا."),
    ShareAction("اشرح ببساطة", "💡", "اشرح النص التالي بلغة بسيطة لمن لا يعرف الموضوع، في ٤ أسطر."),
    ShareAction("ترجم", "🌐", "ترجم النص التالي إلى العربية بترجمة طبيعية لا حرفية. إن كان عربيًا فترجمه إلى الإنجليزية."),
    ShareAction("حوّل لمهام", "✅", "استخرج من النص التالي المهام والمواعيد، واكتبها قائمة قصيرة."),
    ShareAction("ما رأيك؟", "⚖️", "حلّل النص التالي: ما الادعاء الأساسي، ما الذي يدعمه، وما الذي يحتاج تدقيقًا."),
    ShareAction("رد مقترح", "✍️", "اكتب ردًا مناسبًا وموجزًا على النص التالي، بنبرة مهذّبة وعملية."),
)

@Composable
private fun ShareSheet(
    viewModel: AppViewModel,
    text: String,
    subject: String,
    onClose: () -> Unit,
) {
    val settings by viewModel.settings.collectAsState()
    val settingsLoaded by viewModel.settingsLoaded.collectAsState()
    val ai by viewModel.ai.collectAsState()
    val conversations by viewModel.conversations.collectAsState()
    val activeId by viewModel.activeConversationId.collectAsState()

    var sent by remember { mutableStateOf(false) }

    val reply = conversations.firstOrNull { it.id == activeId }
        ?.messages?.lastOrNull { it.role == "assistant" }
    val replyText = reply?.content.orEmpty()

    Box(
        Modifier
            .fillMaxSize()
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
                Row(
                    Modifier.fillMaxWidth().padding(start = 18.dp, end = 14.dp, top = 15.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "نصّ مشارَك",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Text(
                            subject.ifBlank { text },
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
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

                if (settingsLoaded && !settings.hasApiKey) {
                    Text(
                        "أضِف مفتاح Anthropic من إعدادات Alcode Ai لتفعيل هذه الميزة.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(18.dp),
                    )
                    return@Column
                }

                if (!settingsLoaded) {
                    Text(
                        "لحظة…",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(18.dp),
                    )
                } else if (!sent) {
                    Spacer(Modifier.height(12.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            horizontal = 16.dp,
                        ),
                    ) {
                        items(shareActions) { action ->
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(
                                        MaterialTheme.colorScheme.surfaceContainerHighest
                                            .copy(alpha = 0.85f),
                                    )
                                    .clickable {
                                        sent = true
                                        viewModel.newConversation()
                                        viewModel.sendMessage(
                                            "${action.instruction}\n\n---\n$text",
                                        )
                                    }
                                    .padding(horizontal = 14.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(action.emoji)
                                Spacer(Modifier.width(7.dp))
                                Text(action.label, style = MaterialTheme.typography.labelMedium)
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                } else {
                    Spacer(Modifier.height(10.dp))
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
                            .heightIn(min = 60.dp, max = 300.dp)
                            .verticalScroll(rememberScrollState())
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                    ) {
                        if (replyText.isBlank() && ai.streaming) {
                            Text(
                                "لحظة…",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        } else {
                            RichText(replyText.ifBlank { ai.error ?: "لم يصل رد." })
                        }
                    }
                }
            }
        }
    }
}
