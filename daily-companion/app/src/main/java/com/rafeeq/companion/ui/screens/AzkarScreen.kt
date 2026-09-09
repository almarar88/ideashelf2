package com.rafeeq.companion.ui.screens

import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.AzkarData
import com.rafeeq.companion.data.Dhikr
import com.rafeeq.companion.ui.components.Chip
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.ProgressRing
import com.rafeeq.companion.ui.theme.Gradients
import java.time.LocalTime

private const val TAB_MORNING = "الصباح"
private const val TAB_EVENING = "المساء"
private const val TAB_TASBIH = "المسبحة"

/**
 * الأذكار والمسبحة — نصوص محفوظة داخل التطبيق تعمل بلا إنترنت.
 * التبويب الافتراضي يتبع وقت اليوم، فلا يحتاج المستخدم لاختياره كل مرة.
 */
@Composable
fun AzkarScreen() {
    val defaultTab = remember {
        if (LocalTime.now().hour in 4..14) TAB_MORNING else TAB_EVENING
    }
    var tab by remember { mutableStateOf(defaultTab) }

    Column(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 8.dp)) {
            Text(
                "الأذكار",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "اضغط على الذِّكر لتعدّه — والعدّاد يتقدّم مع كل ضغطة.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(10.dp))
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            listOf(TAB_MORNING, TAB_EVENING, TAB_TASBIH).forEach {
                Chip(label = it, selected = tab == it, onClick = { tab = it })
            }
        }
        Spacer(Modifier.height(12.dp))

        when (tab) {
            TAB_MORNING -> DhikrList(AzkarData.morning)
            TAB_EVENING -> DhikrList(AzkarData.evening)
            else -> TasbihPanel()
        }
    }
}

@Composable
private fun DhikrList(items: List<Dhikr>) {
    // العدّ محلّي للجلسة: الأذكار تُقرأ في جلسة واحدة، وحفظها بين الجلسات
    // يجعل المستخدم يجدها نصف مكتملة بلا سبب.
    val counts = remember(items) { mutableStateListOf(*Array(items.size) { 0 }) }
    val context = LocalContext.current

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 108.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(items.size) { index ->
            val dhikr = items[index]
            val done = counts[index]
            val complete = done >= dhikr.repeat

            GlassCard(
                onClick = {
                    if (!complete) {
                        counts[index] = done + 1
                        tick(context, counts[index] >= dhikr.repeat)
                    } else {
                        counts[index] = 0
                    }
                },
            ) {
                Row(verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f)) {
                        if (dhikr.note.isNotBlank()) {
                            Text(
                                dhikr.note,
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.primary,
                            )
                            Spacer(Modifier.height(4.dp))
                        }
                        Text(
                            dhikr.text,
                            style = MaterialTheme.typography.bodyLarge,
                            color = if (complete)
                                MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.65f)
                            else MaterialTheme.colorScheme.onSurface,
                            lineHeight = MaterialTheme.typography.bodyLarge.lineHeight,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    ProgressRing(
                        progress = done.toFloat() / dhikr.repeat.coerceAtLeast(1),
                        colors = if (complete) Gradients.Mint else Gradients.Aurora,
                        strokeWidth = 4.dp,
                        modifier = Modifier.size(46.dp),
                    ) {
                        Text(
                            if (complete) "✓" else "${dhikr.repeat - done}",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun TasbihPanel() {
    var selected by remember { mutableStateOf(AzkarData.tasbih.first()) }
    var count by remember { mutableIntStateOf(0) }
    var rounds by remember { mutableIntStateOf(0) }
    val context = LocalContext.current

    Column(Modifier.fillMaxWidth()) {
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(horizontal = 16.dp),
        ) {
            items(AzkarData.tasbih) { dhikr ->
                Chip(
                    label = dhikr.text,
                    selected = dhikr.text == selected.text,
                    onClick = {
                        selected = dhikr
                        count = 0
                        rounds = 0
                    },
                )
            }
        }

        Spacer(Modifier.height(18.dp))

        Box(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .aspectRatio(1f)
                .clip(CircleShape)
                .background(Brush.linearGradient(Gradients.Meadow))
                .clickable {
                    count += 1
                    if (count >= selected.repeat) {
                        rounds += 1
                        count = 0
                        tick(context, strong = true)
                    } else {
                        tick(context, strong = false)
                    }
                },
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    selected.text,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = androidx.compose.ui.graphics.Color.White,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "$count",
                    style = MaterialTheme.typography.displayLarge,
                    fontWeight = FontWeight.Bold,
                    color = androidx.compose.ui.graphics.Color.White,
                )
                Text(
                    "من ${selected.repeat}",
                    style = MaterialTheme.typography.labelLarge,
                    color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.9f),
                )
            }
        }

        Spacer(Modifier.height(16.dp))

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 32.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "الدورات المكتملة: $rounds",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            IconButton(onClick = { count = 0; rounds = 0 }) {
                Icon(Icons.Filled.Refresh, contentDescription = "تصفير")
            }
        }
    }
}

/** اهتزاز خفيف يجعل العدّ محسوسًا دون النظر إلى الشاشة. */
private fun tick(context: android.content.Context, strong: Boolean) {
    val vibrator = context.getSystemService(Vibrator::class.java) ?: return
    runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(if (strong) 60L else 18L, if (strong) 120 else 60),
            )
        }
    }
}
