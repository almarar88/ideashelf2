package com.rafeeq.companion.data.weather

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.AirQuality
import com.rafeeq.companion.data.DayForecast
import com.rafeeq.companion.data.HourForecast
import com.rafeeq.companion.data.Place
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.WeatherNow
import kotlinx.serialization.Serializable
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * مصدر الطقس: Open‑Meteo — مجاني تمامًا ولا يحتاج مفتاح API.
 * https://open-meteo.com
 */
class WeatherRepository {

    suspend fun fetch(place: Place): WeatherBundle {
        val url = buildString {
            append("https://api.open-meteo.com/v1/forecast")
            append("?latitude=${place.latitude}&longitude=${place.longitude}")
            append("&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,")
            append("precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover")
            append("&hourly=temperature_2m,weather_code,precipitation_probability,is_day")
            append("&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,")
            append("uv_index_max,precipitation_probability_max")
            append("&timezone=auto&forecast_days=7&forecast_hours=48")
        }
        val dto = Net.json.decodeFromString(ForecastDto.serializer(), Net.text(url))
        val zone = runCatching { ZoneId.of(dto.timezone ?: place.timezone) }
            .getOrElse { ZoneId.systemDefault() }

        val now = WeatherNow(
            temperature = dto.current?.temperature_2m ?: 0.0,
            feelsLike = dto.current?.apparent_temperature ?: 0.0,
            humidity = dto.current?.relative_humidity_2m ?: 0,
            windSpeed = dto.current?.wind_speed_10m ?: 0.0,
            windDirection = dto.current?.wind_direction_10m ?: 0,
            pressure = dto.current?.pressure_msl ?: 0.0,
            cloudCover = dto.current?.cloud_cover ?: 0,
            precipitation = dto.current?.precipitation ?: 0.0,
            weatherCode = dto.current?.weather_code ?: 0,
            isDay = (dto.current?.is_day ?: 1) == 1,
        )

        val hourly = dto.hourly?.time.orEmpty().mapIndexedNotNull { i, t ->
            val epoch = parseLocal(t, zone) ?: return@mapIndexedNotNull null
            HourForecast(
                epochSeconds = epoch,
                temperature = dto.hourly?.temperature_2m?.getOrNull(i) ?: 0.0,
                weatherCode = dto.hourly?.weather_code?.getOrNull(i) ?: 0,
                precipitationProbability = dto.hourly?.precipitation_probability?.getOrNull(i) ?: 0,
                isDay = (dto.hourly?.is_day?.getOrNull(i) ?: 1) == 1,
            )
        }

        val daily = dto.daily?.time.orEmpty().mapIndexedNotNull { i, t ->
            val epoch = parseLocalDate(t, zone) ?: return@mapIndexedNotNull null
            DayForecast(
                epochSeconds = epoch,
                weatherCode = dto.daily?.weather_code?.getOrNull(i) ?: 0,
                max = dto.daily?.temperature_2m_max?.getOrNull(i) ?: 0.0,
                min = dto.daily?.temperature_2m_min?.getOrNull(i) ?: 0.0,
                sunriseEpoch = dto.daily?.sunrise?.getOrNull(i)?.let { parseLocal(it, zone) } ?: 0L,
                sunsetEpoch = dto.daily?.sunset?.getOrNull(i)?.let { parseLocal(it, zone) } ?: 0L,
                uvIndex = dto.daily?.uv_index_max?.getOrNull(i) ?: 0.0,
                precipitationProbability = dto.daily?.precipitation_probability_max?.getOrNull(i) ?: 0,
            )
        }

        val air = runCatching { fetchAirQuality(place) }.getOrNull()

        return WeatherBundle(
            place = place.copy(timezone = dto.timezone ?: place.timezone),
            now = now,
            hourly = hourly,
            daily = daily,
            airQuality = air,
        )
    }

    private suspend fun fetchAirQuality(place: Place): AirQuality? {
        val url = "https://air-quality-api.open-meteo.com/v1/air-quality" +
            "?latitude=${place.latitude}&longitude=${place.longitude}" +
            "&current=european_aqi,pm2_5,pm10&timezone=auto"
        val dto = Net.json.decodeFromString(AirDto.serializer(), Net.text(url))
        val c = dto.current ?: return null
        return AirQuality(
            aqi = c.european_aqi?.toInt() ?: return null,
            pm25 = c.pm2_5 ?: 0.0,
            pm10 = c.pm10 ?: 0.0,
        )
    }

    private fun parseLocal(value: String, zone: ZoneId): Long? = runCatching {
        LocalDateTime.parse(value, DateTimeFormatter.ISO_LOCAL_DATE_TIME)
            .atZone(zone).toEpochSecond()
    }.getOrNull()

    private fun parseLocalDate(value: String, zone: ZoneId): Long? = runCatching {
        java.time.LocalDate.parse(value).atStartOfDay(zone).toEpochSecond()
    }.getOrNull()

    // ------------------------------------------------------------ DTOs

    @Serializable
    private data class ForecastDto(
        val timezone: String? = null,
        val current: CurrentDto? = null,
        val hourly: HourlyDto? = null,
        val daily: DailyDto? = null,
    )

    @Serializable
    private data class CurrentDto(
        val temperature_2m: Double? = null,
        val relative_humidity_2m: Int? = null,
        val apparent_temperature: Double? = null,
        val is_day: Int? = null,
        val precipitation: Double? = null,
        val weather_code: Int? = null,
        val wind_speed_10m: Double? = null,
        val wind_direction_10m: Int? = null,
        val pressure_msl: Double? = null,
        val cloud_cover: Int? = null,
    )

    @Serializable
    private data class HourlyDto(
        val time: List<String>? = null,
        val temperature_2m: List<Double>? = null,
        val weather_code: List<Int>? = null,
        val precipitation_probability: List<Int>? = null,
        val is_day: List<Int>? = null,
    )

    @Serializable
    private data class DailyDto(
        val time: List<String>? = null,
        val weather_code: List<Int>? = null,
        val temperature_2m_max: List<Double>? = null,
        val temperature_2m_min: List<Double>? = null,
        val sunrise: List<String>? = null,
        val sunset: List<String>? = null,
        val uv_index_max: List<Double>? = null,
        val precipitation_probability_max: List<Int>? = null,
    )

    @Serializable
    private data class AirDto(val current: AirCurrentDto? = null)

    @Serializable
    private data class AirCurrentDto(
        val european_aqi: Double? = null,
        val pm2_5: Double? = null,
        val pm10: Double? = null,
    )
}

/** ترجمة أكواد WMO إلى وصف عربي ورمز. */
object WeatherCodes {

    data class Info(val text: String, val emoji: String, val icon: String)

    fun describe(code: Int, isDay: Boolean = true): Info = when (code) {
        0 -> Info("صحو", if (isDay) "☀️" else "🌙", if (isDay) "clear_day" else "clear_night")
        1 -> Info("صحو غالبًا", if (isDay) "🌤️" else "🌙", if (isDay) "clear_day" else "clear_night")
        2 -> Info("غيوم جزئية", if (isDay) "⛅" else "☁️", "partly")
        3 -> Info("غائم", "☁️", "cloudy")
        45, 48 -> Info("ضباب", "🌫️", "fog")
        51, 53, 55 -> Info("رذاذ خفيف", "🌦️", "drizzle")
        56, 57 -> Info("رذاذ متجمّد", "🌧️", "drizzle")
        61 -> Info("مطر خفيف", "🌦️", "rain")
        63 -> Info("مطر", "🌧️", "rain")
        65 -> Info("مطر غزير", "🌧️", "rain")
        66, 67 -> Info("مطر متجمّد", "🌧️", "rain")
        71 -> Info("ثلج خفيف", "🌨️", "snow")
        73 -> Info("ثلج", "❄️", "snow")
        75 -> Info("ثلج كثيف", "❄️", "snow")
        77 -> Info("حبيبات ثلج", "🌨️", "snow")
        80, 81 -> Info("زخات مطر", "🌦️", "rain")
        82 -> Info("زخات غزيرة", "⛈️", "rain")
        85, 86 -> Info("زخات ثلج", "🌨️", "snow")
        95 -> Info("عاصفة رعدية", "⛈️", "storm")
        96, 99 -> Info("عاصفة مع بَرَد", "⛈️", "storm")
        else -> Info("غير معروف", "🌡️", "cloudy")
    }

    /** وصف جودة الهواء الأوروبي. */
    fun airQualityLabel(aqi: Int): Pair<String, Int> = when {
        aqi <= 20 -> "ممتازة" to 0
        aqi <= 40 -> "جيدة" to 1
        aqi <= 60 -> "متوسطة" to 2
        aqi <= 80 -> "سيئة" to 3
        aqi <= 100 -> "سيئة جدًا" to 4
        else -> "خطِرة" to 5
    }

    fun windDirectionAr(degrees: Int): String {
        val dirs = listOf("شمالية", "شمالية شرقية", "شرقية", "جنوبية شرقية",
            "جنوبية", "جنوبية غربية", "غربية", "شمالية غربية")
        return dirs[(((degrees % 360) + 360) % 360 + 22) / 45 % 8]
    }

    fun uvLabel(uv: Double): String = when {
        uv < 3 -> "منخفض"
        uv < 6 -> "متوسط"
        uv < 8 -> "مرتفع"
        uv < 11 -> "مرتفع جدًا"
        else -> "خطِر"
    }
}
