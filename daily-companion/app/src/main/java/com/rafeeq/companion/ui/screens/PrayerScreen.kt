package com.rafeeq.companion.ui.screens

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.NotificationsOff
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerTimes
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.safeBottomSpace
import com.rafeeq.companion.ui.components.floatingNavSpace
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.ProgressRing
import com.rafeeq.companion.ui.components.QiblaCompass
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.theme.Gradients
import java.time.Duration
import java.time.LocalDate

@Composable
fun PrayerScreen(
    viewModel: AppViewModel,
    onOpenSettings: () -> Unit,
    onOpenAzkar: () -> Unit = {},
) {
    val settings by viewModel.settings.collectAsState()
    val tick by viewModel.tick.collectAsState()
    val zone = viewModel.zoneId()
    val now = tick.toLocalDateTime()

    var offsetDays by remember { mutableStateOf(0) }
    var showMonth by remember { mutableStateOf(false) }
    val shownDate = LocalDate.now(zone).plusDays(offsetDays.toLong())
    val place = settings.place

    if (place == null) {
        EmptyState(
            emoji = "🕌",
            title = "حدّد موقعك أولًا",
            subtitle = "أوقات الصلاة تُحسب فلكيًا من إحداثيات موقعك، وتعمل بعدها بدون إنترنت.",
        ) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton("اختر الموقع") { onOpenSettings() }
        }
        return
    }

    val day = viewModel.prayersFor(shownDate) ?: return
    val nextPrayer = viewModel.nextPrayer(now)

    if (showMonth) {
        MonthTimetableSheet(
            viewModel = viewModel,
            anchor = shownDate,
            use24h = settings.use24hClock,
            onDismiss = { showMonth = false },
        )
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = floatingNavSpace()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("الصلاة", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        "${place.label} · ${settings.calculationMethod.arabic}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { showMonth = true }) {
                    Icon(Icons.Filled.CalendarMonth, contentDescription = "جدول الشهر")
                }
                IconButton(onClick = onOpenSettings) {
                    Icon(Icons.Filled.Notifications, contentDescription = "إعدادات الصلاة")
                }
            }
        }

        // -------------------------------------------------- عدّاد الصلاة القادمة
        if (offsetDays == 0 && nextPrayer != null) {
            item {
                val (prayer, time) = nextPrayer
                val previous = day.current(now)?.second ?: time.minusHours(5)
                val total = Duration.between(previous, time).seconds.coerceAtLeast(1)
                val remaining = Duration.between(now, time)

                GradientCard(colors = Gradients.Meadow, padding = PaddingValues(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                "الصلاة القادمة",
                                style = MaterialTheme.typography.labelLarge,
                                color = Color.White.copy(alpha = 0.9f),
                            )
                            Text(
                                prayer.arabic,
                                style = MaterialTheme.typography.displaySmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                            Text(
                                "${Dates.formatTime(time, settings.use24hClock)} · بعد ${Dates.humanDuration(remaining)}",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Color.White.copy(alpha = 0.92f),
                            )
                        }
                        ProgressRing(
                            progress = 1f - remaining.seconds.toFloat() / total.toFloat(),
                            colors = listOf(Color.White, Color.White.copy(alpha = 0.5f)),
                            strokeWidth = 7.dp,
                            modifier = Modifier.size(104.dp),
                        ) {
                            Text(
                                Dates.clockDuration(remaining),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White,
                            )
                        }
                    }
                }
            }
        }

        // -------------------------------------------------- متصفح التواريخ
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { offsetDays -= 1 }) {
                    Icon(Icons.Filled.ChevronRight, contentDescription = "اليوم السابق")
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        when (offsetDays) {
                            0 -> "اليوم"
                            1 -> "غدًا"
                            -1 -> "أمس"
                            else -> Dates.weekdayAr(shownDate)
                        },
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        Dates.longHijriAr(shownDate, settings.hijriOffset),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                    )
                    Text(
                        Dates.longGregorianAr(shownDate),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { offsetDays += 1 }) {
                    Icon(Icons.Filled.ChevronLeft, contentDescription = "اليوم التالي")
                }
            }
        }

        // -------------------------------------------------- جدول الأوقات
        item {
            GlassCard(padding = PaddingValues(horizontal = 6.dp, vertical = 6.dp)) {
                Prayer.entries.forEach { prayer ->
                    val time = day[prayer]
                    val isNext = offsetDays == 0 && nextPrayer?.first == prayer
                    val notified = prayer.key in settings.prayerNotifications

                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(
                                if (isNext) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                else Color.Transparent,
                            )
                            .padding(horizontal = 12.dp, vertical = 13.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(
                                    if (isNext) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.outlineVariant,
                                ),
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(
                            prayer.arabic,
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = if (isNext) FontWeight.Bold else FontWeight.Normal,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            Dates.formatTime(time, settings.use24hClock),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (isNext) MaterialTheme.colorScheme.primary
                            else MaterialTheme.colorScheme.onSurface,
                        )
                        if (prayer.isObligatory) {
                            IconButton(
                                onClick = { viewModel.togglePrayerNotification(prayer, !notified) },
                                modifier = Modifier.size(38.dp),
                            ) {
                                Icon(
                                    if (notified) Icons.Filled.Notifications else Icons.Filled.NotificationsOff,
                                    contentDescription = "تنبيه ${prayer.arabic}",
                                    tint = if (notified) MaterialTheme.colorScheme.primary
                                    else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                                    modifier = Modifier.size(18.dp),
                                )
                            }
                        }
                    }
                }
            }
        }

        // -------------------------------------------------- ثلث الليل الأخير
        item {
            val tomorrow = viewModel.prayersFor(shownDate.plusDays(1))
            if (tomorrow != null) {
                val (midnight, lastThird) = PrayerTimes.nightThirds(day, tomorrow[Prayer.FAJR])
                GlassCard {
                    Text(
                        "قيام الليل",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column {
                            Text(
                                "منتصف الليل الشرعي",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                Dates.formatTime(midnight, settings.use24hClock),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                "بداية الثلث الأخير",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(
                                Dates.formatTime(lastThird, settings.use24hClock),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = MaterialTheme.colorScheme.tertiary,
                            )
                        }
                    }
                }
            }
        }

        // -------------------------------------------------- الأذكار
        item {
            GlassCard(onClick = onOpenAzkar) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("📿", style = MaterialTheme.typography.headlineSmall)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "الأذكار والمسبحة",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "أذكار الصباح والمساء ومسبحة بعدّاد — تعمل بلا إنترنت",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        // -------------------------------------------------- القبلة
        item { SectionTitle("اتجاه القبلة") }
        item {
            val context = LocalContext.current
            val (hasCompass, heading) = rememberCompassHeading(context)
            val bearing = PrayerTimes.qiblaBearing(place.latitude, place.longitude)
            val distance = PrayerTimes.distanceToKaaba(place.latitude, place.longitude)

            GlassCard {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .aspectRatio(1.25f),
                    contentAlignment = Alignment.Center,
                ) {
                    QiblaCompass(
                        qiblaBearing = bearing,
                        deviceHeading = heading ?: 0f,
                        modifier = Modifier.fillMaxWidth(0.82f).aspectRatio(1f),
                    )
                    Text("🕋", style = MaterialTheme.typography.headlineSmall)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "زاوية القبلة ${bearing.toInt()}° عن الشمال · " +
                        "المسافة ${distance.toInt()} كم",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (!hasCompass) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "جهازك لا يحتوي على بوصلة، لذا يظهر السهم بالنسبة للشمال الجغرافي مباشرة.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.error,
                    )
                } else {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "أمسك الجهاز أفقيًا وابتعد عن المعادن للحصول على قراءة دقيقة.",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item {
            GlassCard(onClick = onOpenSettings) {
                Text(
                    "طريقة الحساب: ${settings.calculationMethod.arabic}",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "مذهب العصر: ${settings.asrMethod.arabic}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "اضغط لتغيير الطريقة أو ضبط الفروق بالدقائق لكل صلاة.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}

/**
 * يقرأ اتجاه الجهاز من مستشعرات الدوران. يُرجع null إن لم تتوفّر بوصلة.
 */
/**
 * جدول الشهر كاملًا. الحساب فلكي محلي، فلا حاجة لإنترنت ولا لتحميل جدول جاهز.
 */
@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
private fun MonthTimetableSheet(
    viewModel: AppViewModel,
    anchor: LocalDate,
    use24h: Boolean,
    onDismiss: () -> Unit,
) {
    var monthOffset by remember { mutableStateOf(0) }
    val month = remember(anchor, monthOffset) { anchor.withDayOfMonth(1).plusMonths(monthOffset.toLong()) }
    val today = LocalDate.now(viewModel.zoneId())
    val columns = listOf(Prayer.FAJR, Prayer.SUNRISE, Prayer.DHUHR, Prayer.ASR, Prayer.MAGHRIB, Prayer.ISHA)

    val days = remember(month, viewModel.settings.value) {
        (0 until month.lengthOfMonth()).mapNotNull { i ->
            val date = month.plusDays(i.toLong())
            viewModel.prayersFor(date)?.let { date to it }
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp).padding(bottom = safeBottomSpace())) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { monthOffset-- }) {
                    Icon(Icons.Filled.ChevronRight, contentDescription = "الشهر السابق")
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        Dates.longGregorianAr(month).substringAfter("، "),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "جدول الشهر — ${days.size} يومًا",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { monthOffset++ }) {
                    Icon(Icons.Filled.ChevronLeft, contentDescription = "الشهر التالي")
                }
            }

            Spacer(Modifier.height(6.dp))

            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                    .padding(vertical = 6.dp, horizontal = 4.dp),
            ) {
                Text(
                    "اليوم",
                    Modifier.width(38.dp),
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                )
                columns.forEach {
                    Text(
                        it.arabic,
                        Modifier.weight(1f),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                    )
                }
            }

            LazyColumn(Modifier.heightIn(max = 460.dp)) {
                items(days, key = { it.first.toString() }) { (date, prayers) ->
                    val isToday = date == today
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(
                                if (isToday) MaterialTheme.colorScheme.primary.copy(alpha = 0.12f)
                                else Color.Transparent,
                            )
                            .padding(vertical = 7.dp, horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            date.dayOfMonth.toString(),
                            Modifier.width(38.dp),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
                        )
                        columns.forEach { prayer ->
                            Text(
                                Dates.formatTime(prayers[prayer], use24h),
                                Modifier.weight(1f),
                                style = MaterialTheme.typography.labelSmall,
                                textAlign = TextAlign.Center,
                                color = if (prayer == Prayer.SUNRISE)
                                    MaterialTheme.colorScheme.onSurfaceVariant
                                else MaterialTheme.colorScheme.onSurface,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun rememberCompassHeading(context: Context): Pair<Boolean, Float?> {
    val sensorManager = remember {
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    }
    val rotationSensor = remember(sensorManager) {
        sensorManager?.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sensorManager?.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR)
    }
    var heading by remember { mutableFloatStateOf(Float.NaN) }

    DisposableEffect(rotationSensor) {
        if (sensorManager == null || rotationSensor == null) {
            onDispose { }
        } else {
            val matrix = FloatArray(9)
            val orientation = FloatArray(3)
            val listener = object : SensorEventListener {
                override fun onSensorChanged(event: SensorEvent) {
                    SensorManager.getRotationMatrixFromVector(matrix, event.values)
                    SensorManager.getOrientation(matrix, orientation)
                    val degrees = Math.toDegrees(orientation[0].toDouble()).toFloat()
                    val normalized = (degrees + 360f) % 360f
                    // تنعيم بسيط لتفادي اهتزاز السهم.
                    heading = if (heading.isNaN()) normalized
                    else {
                        val diff = ((normalized - heading + 540f) % 360f) - 180f
                        (heading + diff * 0.18f + 360f) % 360f
                    }
                }

                override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
            }
            sensorManager.registerListener(listener, rotationSensor, SensorManager.SENSOR_DELAY_UI)
            onDispose { sensorManager.unregisterListener(listener) }
        }
    }

    return (rotationSensor != null) to (if (heading.isNaN()) null else heading)
}
