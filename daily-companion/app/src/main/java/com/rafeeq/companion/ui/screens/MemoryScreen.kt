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
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.AlertDialog
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.pastelAt
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Ink

/**
 * ما يعرفه المساعد عنك، وما ينفّذه بلا أن تطلب.
 *
 * الشفافية هنا ليست تحسينًا اختياريًا: مساعد يحفظ عنك أشياء لا تراها
 * ولا تستطيع حذفها ليس مساعدًا بل مراقبًا. كل سطر هنا قابل للحذف.
 */
@Composable
fun MemoryScreen(viewModel: AppViewModel) {
    val memories by viewModel.memories.collectAsState()
    val routines by viewModel.routines.collectAsState()

    var showAddMemory by remember { mutableStateOf(false) }
    var showAddRoutine by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 4.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(Modifier.padding(horizontal = 4.dp)) {
                Text(
                    "ذاكرة المساعد",
                    style = MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "ما يحفظه عنك ليبني عليه في كل محادثة. كل شيء هنا على جهازك، " +
                        "وتستطيع حذف أي سطر متى شئت.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        // -------------------------------------------------------- الذاكرة
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionTitle("يعرف عنك (${memories.size})", modifier = Modifier.weight(1f))
                PrimaryButton("إضافة") { showAddMemory = true }
            }
        }

        if (memories.isEmpty()) {
            item {
                GlassCard {
                    Text(
                        "ما حفظ شيئًا بعد. قل له مثلًا: «تذكّر أني أصوم الاثنين والخميس» " +
                            "أو «تذكّر أن اجتماع الفريق كل أحد ٩ صباحًا».",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        itemsIndexed(memories.reversed(), key = { _, it -> it.id }) { index, memory ->
            GlassCard(padding = PaddingValues(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(38.dp).clip(CircleShape).background(pastelAt(index)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Psychology, null,
                            tint = Ink.copy(alpha = 0.7f),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(memory.text, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            memory.category + "  ·  " + Dates.relativePast(memory.createdAt) +
                                if (memory.bySelf) "" else "  ·  أضفتها بنفسك",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(
                        onClick = { viewModel.deleteMemory(memory.id) },
                        modifier = Modifier.size(34.dp),
                    ) {
                        Icon(
                            Icons.Filled.Delete, "حذف",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(17.dp),
                        )
                    }
                }
            }
        }

        // -------------------------------------------------------- الروتين
        item { Spacer(Modifier.height(8.dp)) }
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                SectionTitle("روتيناتك (${routines.size})", modifier = Modifier.weight(1f))
                PrimaryButton("إضافة") { showAddRoutine = true }
            }
        }

        if (routines.isEmpty()) {
            item {
                GlassCard {
                    Text(
                        "الروتين أمر ينفّذه المساعد وحده في وقته — لا مجرّد تنبيه. " +
                            "مثال: «كل يوم ٧ صباحًا اقرأ مهامي وحوّل الجوال للاهتزاز».",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        itemsIndexed(routines, key = { _, it -> it.id }) { index, routine ->
            GlassCard(padding = PaddingValues(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(38.dp).clip(CircleShape).background(pastelAt(index + 2)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            Icons.Filled.Schedule, null,
                            tint = Ink.copy(alpha = 0.7f),
                            modifier = Modifier.size(18.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            routine.label,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            routine.time + "  ·  " + daysLabel(routine.days),
                            style = MaterialTheme.typography.labelSmall,
                            color = Amber,
                        )
                        Text(
                            routine.prompt,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 2,
                        )
                    }
                    Switch(
                        checked = routine.enabled,
                        onCheckedChange = { viewModel.setRoutineEnabled(routine.id, it) },
                    )
                    IconButton(
                        onClick = { viewModel.deleteRoutine(routine.id) },
                        modifier = Modifier.size(34.dp),
                    ) {
                        Icon(
                            Icons.Filled.Delete, "حذف",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(17.dp),
                        )
                    }
                }
            }
        }

        item {
            Text(
                "الروتين ينفّذ أمرًا كاملًا على المساعد، لذا يحتاج مفتاح Anthropic واتصالًا. " +
                    "الأوامر الحسّاسة (اتصال، رسالة) لا تُنفَّذ تلقائيًا لأن أحدًا لا يؤكّدها.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
            )
        }
    }

    if (showAddMemory) {
        AddMemoryDialog(
            onDismiss = { showAddMemory = false },
            onSave = { text, category ->
                viewModel.addMemory(text, category)
                showAddMemory = false
            },
        )
    }

    if (showAddRoutine) {
        AddRoutineDialog(
            onDismiss = { showAddRoutine = false },
            onSave = { label, prompt, time, days ->
                viewModel.addRoutine(label, prompt, time, days)
                showAddRoutine = false
            },
        )
    }
}

private fun daysLabel(days: Set<Int>): String {
    if (days.isEmpty()) return "كل يوم"
    val names = listOf("الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد")
    return days.sorted().joinToString("، ") { names[it - 1] }
}

@Composable
private fun AddMemoryDialog(onDismiss: () -> Unit, onSave: (String, String) -> Unit) {
    var text by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("عام") }
    val categories = listOf("عام", "تفضيل", "عمل", "عائلة", "صحة", "مواعيد")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("معلومة جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(
                    text, { text = it }, "ماذا يجب أن يتذكّر؟",
                    placeholder = "أفضّل المواعيد بعد العصر",
                    singleLine = false, minLines = 2,
                )
                Text("التصنيف", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    categories.take(3).forEach { value ->
                        Chip(value, category == value, onClick = { category = value })
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    categories.drop(3).forEach { value ->
                        Chip(value, category == value, onClick = { category = value })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = text.isNotBlank(), onClick = { onSave(text, category) }) {
                Text("حفظ")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

@Composable
private fun AddRoutineDialog(
    onDismiss: () -> Unit,
    onSave: (String, String, String, Set<Int>) -> Unit,
) {
    var label by remember { mutableStateOf("") }
    var prompt by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("07:00") }
    var days by remember { mutableStateOf(setOf<Int>()) }
    val names = listOf("اث", "ثل", "أر", "خم", "جم", "سب", "أح")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("روتين جديد", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(label, { label = it }, "الاسم", placeholder = "صباح الخير")
                RafeeqTextField(
                    prompt, { prompt = it }, "الأمر الذي يُنفَّذ",
                    placeholder = "اقرأ لي مهام اليوم والطقس، وحوّل الجوال للاهتزاز",
                    singleLine = false, minLines = 3,
                )
                RafeeqTextField(time, { time = it }, "الوقت", placeholder = "07:00")
                Text("الأيام (فارغ = كل يوم)", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    names.forEachIndexed { index, name ->
                        val value = index + 1
                        Box(
                            Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(
                                    if (value in days) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.surfaceContainerHighest,
                                )
                                .clickable {
                                    days = if (value in days) days - value else days + value
                                },
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                name,
                                style = MaterialTheme.typography.labelSmall,
                                color = if (value in days) MaterialTheme.colorScheme.onPrimary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = label.isNotBlank() && prompt.isNotBlank() &&
                    runCatching { java.time.LocalTime.parse(time.trim()) }.isSuccess,
                onClick = { onSave(label, prompt, time.trim(), days) },
            ) { Text("جدولة") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}
