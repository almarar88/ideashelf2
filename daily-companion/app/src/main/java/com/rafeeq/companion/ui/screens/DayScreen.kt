package com.rafeeq.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.Note
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.HabitBars
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.SecondaryButton
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Rose
import com.rafeeq.companion.ui.theme.Sky
import com.rafeeq.companion.ui.theme.Violet
import java.time.LocalDate

private val habitColors = listOf(Cyan, Violet, Amber, Emerald, Rose, Sky)
private val noteColors = listOf(Amber, Cyan, Violet, Emerald, Rose)

private const val TAB_TASKS = "المهام"
private const val TAB_HABITS = "العادات"
private const val TAB_NOTES = "الملاحظات"

@Composable
fun DayScreen(viewModel: AppViewModel) {
    val tasks by viewModel.tasks.collectAsState()
    val habits by viewModel.habits.collectAsState()
    val notes by viewModel.notes.collectAsState()
    val settings by viewModel.settings.collectAsState()

    var tab by remember { mutableStateOf(TAB_TASKS) }
    var showTaskDialog by remember { mutableStateOf(false) }
    var showHabitDialog by remember { mutableStateOf(false) }
    var editingNote by remember { mutableStateOf<Note?>(null) }
    var showSmartAdd by remember { mutableStateOf(false) }

    val today = LocalDate.now(viewModel.zoneId())

    Column(Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(start = 16.dp, end = 4.dp, top = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text("يومي", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Text(
                    Dates.longGregorianAr(today),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (settings.hasApiKey && tab == TAB_TASKS) {
                IconButton(onClick = { showSmartAdd = true }) {
                    Icon(
                        Icons.Filled.AutoAwesome,
                        contentDescription = "إضافة ذكية",
                        tint = Violet,
                    )
                }
            }
            IconButton(
                onClick = {
                    when (tab) {
                        TAB_TASKS -> showTaskDialog = true
                        TAB_HABITS -> showHabitDialog = true
                        else -> editingNote = Note(body = "")
                    }
                },
            ) {
                Icon(Icons.Filled.Add, contentDescription = "إضافة")
            }
        }

        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(TAB_TASKS, TAB_HABITS, TAB_NOTES).forEach {
                Chip(label = it, selected = tab == it, onClick = { tab = it })
            }
        }
        Spacer(Modifier.height(10.dp))

        when (tab) {
            TAB_TASKS -> TasksTab(viewModel, tasks, today) { showTaskDialog = true }
            TAB_HABITS -> HabitsTab(viewModel, habits, today) { showHabitDialog = true }
            else -> NotesTab(notes, onEdit = { editingNote = it }, onDelete = { viewModel.deleteNote(it) })
        }
    }

    if (showTaskDialog) {
        TaskDialog(
            onDismiss = { showTaskDialog = false },
            onSave = { viewModel.addTask(it); showTaskDialog = false },
        )
    }

    if (showHabitDialog) {
        HabitDialog(
            onDismiss = { showHabitDialog = false },
            onSave = { viewModel.addHabit(it); showHabitDialog = false },
        )
    }

    editingNote?.let { note ->
        NoteDialog(
            note = note,
            onDismiss = { editingNote = null },
            onSave = { viewModel.saveNote(it); editingNote = null },
        )
    }

    if (showSmartAdd) {
        SmartAddDialog(viewModel = viewModel, onDismiss = { showSmartAdd = false })
    }
}

// ------------------------------------------------------------------ المهام

@Composable
private fun TasksTab(
    viewModel: AppViewModel,
    tasks: List<Task>,
    today: LocalDate,
    onAdd: () -> Unit,
) {
    val open = tasks.filter { !it.done }
        .sortedWith(compareByDescending<Task> { it.priority }.thenBy { it.dueDate ?: "9999" })
    val done = tasks.filter { it.done }.sortedByDescending { it.completedAt ?: 0L }

    if (tasks.isEmpty()) {
        EmptyState(
            emoji = "📝",
            title = "لا مهام بعد",
            subtitle = "أضِف مهمة، أو استخدم الإضافة الذكية لتحويل جملة عادية إلى مهام بمواعيدها.",
        ) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton("أضِف مهمة") { onAdd() }
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        if (open.isNotEmpty()) {
            item { SectionTitle("قيد الإنجاز (${open.size})") }
            items(open, key = { it.id }) { task ->
                TaskRow(task, today, onToggle = { viewModel.toggleTask(task) }) {
                    viewModel.deleteTask(task)
                }
            }
        }
        if (done.isNotEmpty()) {
            item {
                SectionTitle(
                    "مكتملة (${done.size})",
                    action = "مسح",
                    onAction = { viewModel.clearCompletedTasks() },
                )
            }
            items(done.take(20), key = { it.id }) { task ->
                TaskRow(task, today, onToggle = { viewModel.toggleTask(task) }) {
                    viewModel.deleteTask(task)
                }
            }
        }
    }
}

@Composable
private fun TaskRow(task: Task, today: LocalDate, onToggle: () -> Unit, onDelete: () -> Unit) {
    val overdue = !task.done && task.dueDate?.let {
        runCatching { LocalDate.parse(it).isBefore(today) }.getOrDefault(false)
    } == true

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surfaceContainerHigh.copy(alpha = 0.55f))
            .clickable { onToggle() }
            .padding(horizontal = 12.dp, vertical = 13.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            if (task.done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
            contentDescription = null,
            tint = when {
                task.done -> Emerald
                task.priority == 2 -> MaterialTheme.colorScheme.error
                task.priority == 0 -> MaterialTheme.colorScheme.onSurfaceVariant
                else -> MaterialTheme.colorScheme.primary
            },
            modifier = Modifier.size(21.dp),
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                task.title,
                style = MaterialTheme.typography.bodyLarge,
                textDecoration = if (task.done) TextDecoration.LineThrough else null,
                color = if (task.done) MaterialTheme.colorScheme.onSurfaceVariant
                else MaterialTheme.colorScheme.onSurface,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (task.note.isNotBlank()) {
                Text(
                    task.note,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            val meta = listOfNotNull(
                task.dueDate,
                task.dueTime,
                task.tag.takeIf { it.isNotBlank() }?.let { "#$it" },
            )
            if (meta.isNotEmpty()) {
                Text(
                    (if (overdue) "متأخرة · " else "") + meta.joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = if (overdue) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        IconButton(onClick = onDelete, modifier = Modifier.size(34.dp)) {
            Icon(
                Icons.Filled.Delete,
                contentDescription = "حذف",
                tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                modifier = Modifier.size(17.dp),
            )
        }
    }
}

@Composable
private fun TaskDialog(onDismiss: () -> Unit, onSave: (Task) -> Unit) {
    var title by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf(1) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("مهمة جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(title, { title = it }, "المهمة")
                RafeeqTextField(note, { note = it }, "ملاحظة (اختياري)", singleLine = false, minLines = 2)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    RafeeqTextField(
                        date, { date = it }, "التاريخ",
                        placeholder = "2026-09-08", modifier = Modifier.weight(1f),
                    )
                    RafeeqTextField(
                        time, { time = it }, "الوقت",
                        placeholder = "14:30", modifier = Modifier.weight(1f),
                    )
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(0 to "منخفضة", 1 to "عادية", 2 to "مهمة").forEach { (value, label) ->
                        Chip(label, priority == value, { priority = value })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        Task(
                            title = title.trim(),
                            note = note.trim(),
                            dueDate = date.trim().ifBlank { null },
                            dueTime = time.trim().ifBlank { null },
                            priority = priority,
                        ),
                    )
                },
                enabled = title.isNotBlank(),
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

/** يحوّل جملة حرّة إلى مهام باستخدام المساعد. */
@Composable
private fun SmartAddDialog(viewModel: AppViewModel, onDismiss: () -> Unit) {
    var text by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = { if (!loading) onDismiss() },
        title = { Text("إضافة ذكية", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "اكتب يومك بجملة عادية وسأحوّلها إلى مهام بمواعيدها. مثال: " +
                        "«اجتماع الفريق بكرة الساعة ١٠، وأدفع فاتورة الكهرباء قبل نهاية الأسبوع».",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                RafeeqTextField(text, { text = it }, "النص", singleLine = false, minLines = 3)
                error?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = text.isNotBlank() && !loading,
                onClick = {
                    loading = true
                    error = null
                    viewModel.extractTasks(text) { result ->
                        loading = false
                        result.onSuccess {
                            viewModel.showMessage("أُضيفت $it مهمة")
                            onDismiss()
                        }.onFailure { error = it.message ?: "تعذّر التحويل." }
                    }
                },
            ) {
                if (loading) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("حوّل إلى مهام")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !loading) { Text("إلغاء") } },
    )
}

// ------------------------------------------------------------------ العادات

@Composable
private fun HabitsTab(
    viewModel: AppViewModel,
    habits: List<Habit>,
    today: LocalDate,
    onAdd: () -> Unit,
) {
    if (habits.isEmpty()) {
        EmptyState(
            emoji = "🔥",
            title = "ابنِ عادة",
            subtitle = "تتبّع عادة واحدة يوميًا — قراءة، مشي، ذكر، أو أي شيء تريد الالتزام به.",
        ) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton("أضِف عادة") { onAdd() }
        }
        return
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(habits, key = { it.id }) { habit ->
            val todayKey = today.toString()
            val count = habit.log[todayKey] ?: 0
            val color = habitColors[habit.colorIndex % habitColors.size]
            val last14 = (13 downTo 0).map { offset ->
                val key = today.minusDays(offset.toLong()).toString()
                ((habit.log[key] ?: 0).toFloat() / habit.targetPerDay.coerceAtLeast(1))
                    .coerceIn(0f, 1f)
            }
            val streak = calculateStreak(habit, today)

            GlassCard(onClick = { viewModel.incrementHabit(habit) }) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(42.dp).clip(CircleShape).background(color.copy(alpha = 0.16f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(habit.emoji, style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            habit.title,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            buildString {
                                append("$count / ${habit.targetPerDay} اليوم")
                                if (streak > 0) append("  ·  🔥 $streak ${if (streak == 1) "يوم" else "أيام"}")
                            },
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(
                        onClick = { viewModel.deleteHabit(habit) },
                        modifier = Modifier.size(34.dp),
                    ) {
                        Icon(
                            Icons.Filled.Delete,
                            contentDescription = "حذف",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                            modifier = Modifier.size(17.dp),
                        )
                    }
                }
                Spacer(Modifier.height(12.dp))
                HabitBars(
                    values = last14,
                    activeColor = color,
                    modifier = Modifier.fillMaxWidth().height(34.dp),
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "آخر ١٤ يومًا — اضغط البطاقة للتسجيل",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun calculateStreak(habit: Habit, today: LocalDate): Int {
    var streak = 0
    var day = today
    // إن لم تُسجَّل اليوم بعد، نبدأ العدّ من الأمس حتى لا تنكسر السلسلة قبل نهاية اليوم.
    if ((habit.log[today.toString()] ?: 0) < habit.targetPerDay) day = today.minusDays(1)
    while ((habit.log[day.toString()] ?: 0) >= habit.targetPerDay) {
        streak++
        day = day.minusDays(1)
    }
    return streak
}

@Composable
private fun HabitDialog(onDismiss: () -> Unit, onSave: (Habit) -> Unit) {
    var title by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("✅") }
    var target by remember { mutableStateOf("1") }
    var colorIndex by remember { mutableStateOf(0) }
    val emojiChoices = listOf("✅", "📖", "🏃", "💧", "🕌", "🧘", "💪", "🌙", "✍️", "🥗")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("عادة جديدة", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(title, { title = it }, "اسم العادة")
                RafeeqTextField(
                    target, { target = it.filter { c -> c.isDigit() }.take(2) },
                    "المرات المطلوبة يوميًا",
                    keyboardType = androidx.compose.ui.text.input.KeyboardType.Number,
                )
                Text("الرمز", style = MaterialTheme.typography.labelMedium)
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                ) {
                    emojiChoices.forEach { choice ->
                        Box(
                            Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(
                                    if (emoji == choice) MaterialTheme.colorScheme.primary.copy(alpha = 0.2f)
                                    else MaterialTheme.colorScheme.surfaceContainerHighest,
                                )
                                .clickable { emoji = choice },
                            contentAlignment = Alignment.Center,
                        ) { Text(choice) }
                    }
                }
                Text("اللون", style = MaterialTheme.typography.labelMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    habitColors.forEachIndexed { index, color ->
                        Box(
                            Modifier
                                .size(30.dp)
                                .clip(CircleShape)
                                .background(color.copy(alpha = if (colorIndex == index) 1f else 0.4f))
                                .clickable { colorIndex = index },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = title.isNotBlank(),
                onClick = {
                    onSave(
                        Habit(
                            title = title.trim(),
                            emoji = emoji,
                            targetPerDay = target.toIntOrNull()?.coerceIn(1, 20) ?: 1,
                            colorIndex = colorIndex,
                        ),
                    )
                },
            ) { Text("حفظ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إلغاء") } },
    )
}

// ------------------------------------------------------------------ الملاحظات

@Composable
private fun NotesTab(notes: List<Note>, onEdit: (Note) -> Unit, onDelete: (Note) -> Unit) {
    if (notes.isEmpty()) {
        EmptyState(
            emoji = "🗒️",
            title = "لا ملاحظات",
            subtitle = "دوّن فكرة سريعة، قائمة تسوّق، أو ما تريد تذكّره لاحقًا.",
        )
        return
    }

    val sorted = notes.sortedWith(compareByDescending<Note> { it.pinned }.thenByDescending { it.updatedAt })

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 28.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(sorted, key = { it.id }) { note ->
            val color = noteColors[note.colorIndex % noteColors.size]
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(color.copy(alpha = 0.12f))
                    .clickable { onEdit(note) }
                    .padding(14.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Column(Modifier.weight(1f)) {
                    if (note.title.isNotBlank()) {
                        Text(
                            note.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(
                        note.body,
                        style = MaterialTheme.typography.bodyMedium,
                        maxLines = 6,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        Dates.relativePast(note.updatedAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { onDelete(note) }, modifier = Modifier.size(32.dp)) {
                    Icon(
                        Icons.Filled.Delete,
                        contentDescription = "حذف",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f),
                        modifier = Modifier.size(16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun NoteDialog(note: Note, onDismiss: () -> Unit, onSave: (Note) -> Unit) {
    var title by remember { mutableStateOf(note.title) }
    var body by remember { mutableStateOf(note.body) }
    var colorIndex by remember { mutableStateOf(note.colorIndex) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (note.body.isBlank()) "ملاحظة جديدة" else "تعديل الملاحظة", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                RafeeqTextField(title, { title = it }, "العنوان (اختياري)")
                RafeeqTextField(body, { body = it }, "النص", singleLine = false, minLines = 5)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    noteColors.forEachIndexed { index, color ->
                        Box(
                            Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(color.copy(alpha = if (colorIndex == index) 1f else 0.35f))
                                .clickable { colorIndex = index },
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = body.isNotBlank(),
                onClick = {
                    onSave(
                        note.copy(
                            title = title.trim(),
                            body = body.trim(),
                            colorIndex = colorIndex,
                            updatedAt = System.currentTimeMillis(),
                        ),
                    )
                },
            ) { Text("حفظ") }
        },
        dismissButton = {
            Row {
                SecondaryButton("إلغاء") { onDismiss() }
            }
        },
    )
}
