package com.rafeeq.companion.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.Cloud
import androidx.compose.material.icons.filled.Compress
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Umbrella
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.DayForecast
import com.rafeeq.companion.data.HourForecast
import com.rafeeq.companion.data.weather.WeatherCodes
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.floatingNavSpace
import com.rafeeq.companion.ui.components.EmptyState
import com.rafeeq.companion.ui.components.ErrorBanner
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.LoadingList
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.StatTile
import com.rafeeq.companion.ui.components.TemperatureSparkline
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Gradients
import com.rafeeq.companion.ui.theme.Sky
import com.rafeeq.companion.ui.theme.Violet
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

@Composable
fun WeatherScreen(viewModel: AppViewModel, onOpenSettings: () -> Unit) {
    val weather by viewModel.weather.collectAsState()
    val settings by viewModel.settings.collectAsState()
    val zone = viewModel.zoneId()

    if (settings.place == null) {
        EmptyState(
            emoji = "📍",
            title = "لم تحدّد موقعك بعد",
            subtitle = "نحتاج موقعك لجلب الطقس وأوقات الصلاة بدقّة.",
        ) {
            Spacer(Modifier.height(8.dp))
            PrimaryButton("اختر الموقع") { onOpenSettings() }
        }
        return
    }

    val bundle = weather.bundle
    if (bundle == null) {
        if (weather.loading) LoadingList(rows = 3)
        else Column(Modifier.padding(16.dp)) {
            ErrorBanner(
                weather.error ?: "لا توجد بيانات طقس.",
                onRetry = { viewModel.refreshWeather(force = true) },
            )
        }
        return
    }

    val info = WeatherCodes.describe(bundle.now.weatherCode, bundle.now.isDay)
    val heroColors = when {
        !bundle.now.isDay -> Gradients.Dusk
        bundle.now.weatherCode in listOf(0, 1) -> Gradients.Sunrise
        bundle.now.weatherCode in 61..99 -> Gradients.Ocean
        else -> Gradients.Meadow
    }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = floatingNavSpace()),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("الطقس", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(
                        bundle.place.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                IconButton(onClick = { viewModel.refreshWeather(force = true) }) {
                    Icon(Icons.Filled.Refresh, contentDescription = "تحديث")
                }
            }
        }

        item {
            GradientCard(colors = heroColors, padding = PaddingValues(22.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            "${bundle.now.temperature.toInt()}°",
                            style = MaterialTheme.typography.displayLarge,
                            fontWeight = FontWeight.Bold,
                            color = Color.White,
                        )
                        Text(
                            info.text,
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                        )
                        bundle.daily.firstOrNull()?.let {
                            Text(
                                "العظمى ${it.max.toInt()}° · الصغرى ${it.min.toInt()}°",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color.White.copy(alpha = 0.9f),
                            )
                        }
                    }
                    Text(info.emoji, style = MaterialTheme.typography.displayLarge)
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(
                    Icons.Filled.WbSunny, "${bundle.now.feelsLike.toInt()}°", "محسوسة",
                    Amber, Modifier.weight(1f),
                )
                StatTile(
                    Icons.Filled.WaterDrop, "${bundle.now.humidity}%", "رطوبة",
                    Sky, Modifier.weight(1f),
                )
                StatTile(
                    Icons.Filled.Air,
                    "${bundle.now.windSpeed.toInt()}",
                    WeatherCodes.windDirectionAr(bundle.now.windDirection),
                    Cyan, Modifier.weight(1f),
                )
                StatTile(
                    Icons.Filled.Cloud, "${bundle.now.cloudCover}%", "غيوم",
                    Violet, Modifier.weight(1f),
                )
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                bundle.daily.firstOrNull()?.let { today ->
                    StatTile(
                        Icons.Filled.WbSunny,
                        String.format(java.util.Locale.ENGLISH, "%.1f", today.uvIndex),
                        "أشعة ${WeatherCodes.uvLabel(today.uvIndex)}",
                        Amber, Modifier.weight(1f),
                    )
                    StatTile(
                        Icons.Filled.Umbrella,
                        "${today.precipitationProbability}%",
                        "احتمال مطر",
                        Sky, Modifier.weight(1f),
                    )
                }
                StatTile(
                    Icons.Filled.Compress,
                    "${bundle.now.pressure.toInt()}",
                    "ضغط hPa",
                    Emerald, Modifier.weight(1f),
                )
                bundle.airQuality?.let { air ->
                    StatTile(
                        Icons.Filled.Air,
                        air.aqi.toString(),
                        WeatherCodes.airQualityLabel(air.aqi).first,
                        when (WeatherCodes.airQualityLabel(air.aqi).second) {
                            0, 1 -> Emerald
                            2 -> Amber
                            else -> MaterialTheme.colorScheme.error
                        },
                        Modifier.weight(1f),
                    )
                }
            }
        }

        // ------------------------------------------------ الساعات القادمة
        val upcoming = bundle.hourly.filter {
            it.epochSeconds >= System.currentTimeMillis() / 1000 - 3600
        }.take(24)

        if (upcoming.isNotEmpty()) {
            item { SectionTitle("الساعات القادمة") }
            item {
                GlassCard(padding = PaddingValues(vertical = 14.dp, horizontal = 4.dp)) {
                    TemperatureSparkline(
                        values = upcoming.map { it.temperature },
                        lineColors = Gradients.Sunrise,
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(64.dp)
                            .padding(horizontal = 12.dp),
                    )
                    Spacer(Modifier.height(6.dp))
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(4.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp),
                    ) {
                        items(upcoming) { hour -> HourCell(hour, zone) }
                    }
                }
            }
        }

        // ------------------------------------------------ الأيام القادمة
        if (bundle.daily.isNotEmpty()) {
            item { SectionTitle("الأيام القادمة") }
            item {
                GlassCard(padding = PaddingValues(horizontal = 8.dp, vertical = 6.dp)) {
                    val overallMin = bundle.daily.minOf { it.min }
                    val overallMax = bundle.daily.maxOf { it.max }
                    bundle.daily.forEachIndexed { index, day ->
                        DayRow(day, zone, index == 0, overallMin, overallMax, settings.use24hClock)
                    }
                }
            }
        }

        item {
            Text(
                "المصدر: Open-Meteo · تُحدَّث البيانات تلقائيًا كل ١٥ دقيقة.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun HourCell(hour: HourForecast, zone: ZoneId) {
    val time = Instant.ofEpochSecond(hour.epochSeconds).atZone(zone)
    val info = WeatherCodes.describe(hour.weatherCode, hour.isDay)
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .padding(horizontal = 9.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text(
            String.format(java.util.Locale.ENGLISH, "%02d", time.hour),
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(info.emoji, style = MaterialTheme.typography.titleMedium)
        Text(
            "${hour.temperature.toInt()}°",
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
        )
        if (hour.precipitationProbability >= 20) {
            Text(
                "${hour.precipitationProbability}%",
                style = MaterialTheme.typography.labelSmall,
                color = Sky,
            )
        }
    }
}

@Composable
private fun DayRow(
    day: DayForecast,
    zone: ZoneId,
    isToday: Boolean,
    overallMin: Double,
    overallMax: Double,
    use24h: Boolean,
) {
    val date = Instant.ofEpochSecond(day.epochSeconds).atZone(zone).toLocalDate()
    val info = WeatherCodes.describe(day.weatherCode, true)
    val range = (overallMax - overallMin).takeIf { it > 0.5 } ?: 1.0
    val startFraction = ((day.min - overallMin) / range).toFloat().coerceIn(0f, 1f)
    val endFraction = ((day.max - overallMin) / range).toFloat().coerceIn(0f, 1f)

    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            if (isToday) "اليوم" else Dates.weekdayAr(date),
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal,
            modifier = Modifier.width(62.dp),
        )
        Text(info.emoji, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.width(8.dp))
        Text(
            "${day.min.toInt()}°",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.width(30.dp),
        )

        // شريط مدى الحرارة
        Box(
            Modifier
                .weight(1f)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.16f)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(endFraction - startFraction + 0.02f)
                    .height(6.dp)
                    .padding(start = 0.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(
                        androidx.compose.ui.graphics.Brush.horizontalGradient(Gradients.Sunrise),
                    ),
            )
        }

        Spacer(Modifier.width(8.dp))
        Text(
            "${day.max.toInt()}°",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.width(30.dp),
        )
    }

    if (isToday && day.sunriseEpoch > 0) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "🌅 الشروق ${Dates.formatTime(Instant.ofEpochSecond(day.sunriseEpoch).atZone(zone).toLocalTime(), use24h)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                "🌇 الغروب ${Dates.formatTime(Instant.ofEpochSecond(day.sunsetEpoch).atZone(zone).toLocalTime(), use24h)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
