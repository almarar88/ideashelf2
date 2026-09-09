package com.rafeeq.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RafeeqTextField

/**
 * اختصارات المستخدم: عبارة قصيرة تحمل أمرًا كاملًا للمساعد.
 *
 * الفائدة أن الأوامر المركّبة («حوّل للاهتزاز وخفّض السطوع واذكر مهامي»)
 * تصبح ضغطة واحدة بدل إعادة كتابتها كل مرة.
 */
@Composable
fun ShortcutsScreen(viewModel: AppViewModel) {
    val shortcuts by viewModel.shortcuts.collectAsState()
    var showAdd by remember { mutableStateOf(false) }

    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(start = 16.dp, end = 16.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    "اختصاراتي",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "أوامر جاهزة تظهر في شاشة المساعد بضغطة واحدة",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            PrimaryButton("إضافة") { showAdd = true }
        }

        Spacer(Modifier.height(12.dp))

        LazyColumn(
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 108.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(shortcuts, key = { it.id }) { shortcut ->
                GlassCard(padding = PaddingValues(14.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surfaceContainerHighest),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(shortcut.emoji, style = MaterialTheme.typography.titleMedium)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                shortcut.label,
                                style = MaterialTheme.typography.bodyLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                shortcut.prompt,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 2,
                            )
                        }
                        IconButton(
                            onClick = { viewModel.deleteShortcut(shortcut.id) },
                            modifier = Modifier.size(34.dp),
                        ) {
                            Icon(
                                Icons.Filled.Delete,
                                contentDescription = "حذف",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(17.dp),
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAdd) {
        AddShortcutDialog(
            onDismiss = { showAdd = false },
            onSave = { label, emoji, prompt ->
                viewModel.addShortcut(label, emoji, prompt)
                showAdd = false
            },
        )
    }
}

@Composable
private fun AddShortcutDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit,
) {
    var label by remember { mutableStateOf("") }
    var prompt by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("⚡") }
    val choices = listOf("⚡", "🌙", "🎯", "🚗", "🏠", "💼", "🛏️", "☕", "📞", "🕌")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اختصار جديد", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(label, { label = it }, "الاسم", placeholder = "وضع القيادة")
                RafeeqTextField(
                    prompt, { prompt = it }, "الأمر الكامل",
                    placeholder = "شغّل بلوتوث، افتح الخرائط، وارفع صوت الوسائط إلى ٧٠٪",
                    singleLine = false, minLines = 3,
                )
                Text("الرمز", style = MaterialTheme.typography.labelMedium)
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    choices.forEach { choice ->
                        Box(
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(
                                    if (emoji == choice)
                                        MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                                    else MaterialTheme.colorScheme.surfaceContainerHighest,
                                )
                                .clickable { emoji = choice },
                            contentAlignment = Alignment.Center,
                        ) { Text(choice) }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = label.isNotBlank() && prompt.isNotBlank(),
                onClick = { onSave(label, emoji, prompt) },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}
