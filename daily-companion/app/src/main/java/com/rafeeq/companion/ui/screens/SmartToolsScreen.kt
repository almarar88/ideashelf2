package com.rafeeq.companion.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.ai.SmartTools
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.floatingNavSpace

/**
 * أدوات النصّ الذكية.
 *
 * ألصق نصًّا واضغط زرًّا. كانت هذه القدرات مخبوءة خلف «مشاركة» من تطبيق
 * آخر وثلاثًا فقط، فمن أراد تلخيص شيء في يده يفتح المحادثة ويرتجل
 * تعليماته كل مرّة.
 */
@Composable
fun SmartToolsScreen(viewModel: AppViewModel) {
    val state by viewModel.smartTool.collectAsState()
    val clipboard = LocalClipboardManager.current
    var input by remember { mutableStateOf("") }

    LazyColumn(
        contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, floatingNavSpace()),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "أدوات ذكية",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "ألصق أي نصّ — رسالة، مقالًا، بريدًا — واختر ما تريد فعله به.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        item {
            GlassCard {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    label = { Text("النصّ") },
                    minLines = 4,
                    maxLines = 10,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(onClick = {
                        clipboard.getText()?.text?.let { input = it }
                    }) { Text("الصق من الحافظة") }

                    if (input.isNotBlank()) {
                        TextButton(onClick = { input = ""; viewModel.clearSmartTool() }) {
                            Text("امسح")
                        }
                        Text(
                            "${input.length} حرفًا",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        item { SectionTitle("ماذا أفعل به؟") }
        items(SmartTools.all.chunked(2).size) { row ->
            val pair = SmartTools.all.chunked(2)[row]
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pair.forEach { tool ->
                    GlassCard(
                        modifier = Modifier.weight(1f),
                        padding = PaddingValues(12.dp),
                        onClick = { viewModel.runSmartTool(tool.id, input) },
                    ) {
                        Text(
                            "${tool.emoji}  ${tool.label}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            tool.hint,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 2.dp),
                        )
                    }
                }
                // صفٌّ فيه أداة واحدة: نحجز مكان الثانية فلا تتمدّد الأولى.
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }

        if (state.running || state.output.isNotBlank() || state.error.isNotBlank()) {
            item { SectionTitle("النتيجة") }
            item {
                GlassCard {
                    when {
                        state.running -> Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            CircularProgressIndicator(Modifier.height(18.dp))
                            Text(
                                SmartTools.byId(state.toolId)?.let { "${it.label}…" } ?: "…",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }

                        state.error.isNotBlank() -> Text(
                            "⚠️ ${state.error}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )

                        else -> Column {
                            if (state.clipped) {
                                Text(
                                    "النصّ كان أطول من الحدّ، فعُولج أوّله فقط.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(6.dp))
                            }
                            Text(state.output, style = MaterialTheme.typography.bodyLarge)
                            Spacer(Modifier.height(10.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Chip(
                                    label = "نسخ",
                                    selected = false,
                                    onClick = {
                                        clipboard.setText(AnnotatedString(state.output))
                                    },
                                )
                                Chip(
                                    label = "احفظ ملاحظة",
                                    selected = false,
                                    onClick = {
                                        viewModel.saveSmartOutputAsNote(
                                            title = SmartTools.byId(state.toolId)?.label.orEmpty(),
                                            body = state.output,
                                        )
                                    },
                                )
                                // التسلسل: لخّص ثمّ ترجم الملخّص، بلا نسخ ولصق.
                                Chip(
                                    label = "اجعله المدخل",
                                    selected = false,
                                    onClick = {
                                        input = state.output
                                        viewModel.clearSmartTool()
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
