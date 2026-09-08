package com.rafeeq.companion.data

import kotlinx.serialization.Serializable
import java.util.UUID

// ---------------------------------------------------------------- الموقع

@Serializable
data class Place(
    val name: String,
    val country: String = "",
    val admin: String = "",
    val latitude: Double,
    val longitude: Double,
    val timezone: String = "",
    val elevation: Double = 0.0,
) {
    val label: String get() = listOf(name, admin, country).filter { it.isNotBlank() }.distinct().joinToString("، ")
    companion object {
        val Makkah = Place("مكة المكرمة", "السعودية", latitude = 21.3891, longitude = 39.8579, timezone = "Asia/Riyadh")
    }
}

// ---------------------------------------------------------------- الطقس

@Serializable
data class WeatherNow(
    val temperature: Double,
    val feelsLike: Double,
    val humidity: Int,
    val windSpeed: Double,
    val windDirection: Int = 0,
    val pressure: Double = 0.0,
    val cloudCover: Int = 0,
    val precipitation: Double = 0.0,
    val weatherCode: Int,
    val isDay: Boolean,
)

@Serializable
data class HourForecast(
    val epochSeconds: Long,
    val temperature: Double,
    val weatherCode: Int,
    val precipitationProbability: Int,
    val isDay: Boolean = true,
)

@Serializable
data class DayForecast(
    val epochSeconds: Long,
    val weatherCode: Int,
    val max: Double,
    val min: Double,
    val sunriseEpoch: Long,
    val sunsetEpoch: Long,
    val uvIndex: Double,
    val precipitationProbability: Int,
)

@Serializable
data class AirQuality(
    val aqi: Int,
    val pm25: Double,
    val pm10: Double,
)

@Serializable
data class WeatherBundle(
    val place: Place,
    val now: WeatherNow,
    val hourly: List<HourForecast>,
    val daily: List<DayForecast>,
    val airQuality: AirQuality? = null,
    val fetchedAt: Long = System.currentTimeMillis(),
)

// ---------------------------------------------------------------- الأخبار

@Serializable
data class NewsSource(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val url: String,
    val category: String,
    val enabled: Boolean = true,
    /** مصادر مضافة من المستخدم يمكن حذفها. */
    val custom: Boolean = false,
)

@Serializable
data class Topic(
    val id: String = UUID.randomUUID().toString(),
    val query: String,
    val enabled: Boolean = true,
)

@Serializable
data class Article(
    val id: String,
    val title: String,
    val link: String,
    val summary: String = "",
    val imageUrl: String? = null,
    val sourceName: String = "",
    val category: String = "",
    val publishedAt: Long = 0L,
) {
    val hasImage: Boolean get() = !imageUrl.isNullOrBlank()
}

@Serializable
data class SavedArticle(
    val article: Article,
    val savedAt: Long = System.currentTimeMillis(),
    val aiSummary: String? = null,
)

// ---------------------------------------------------------------- يومي

@Serializable
data class Task(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val note: String = "",
    /** yyyy-MM-dd */
    val dueDate: String? = null,
    /** HH:mm */
    val dueTime: String? = null,
    val priority: Int = 1, // 0 منخفضة، 1 عادية، 2 مهمة
    val done: Boolean = false,
    val completedAt: Long? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val tag: String = "",
    val reminderMinutesBefore: Int = 0,
    /** تكرار المهمة: daily أو weekly أو monthly. عند الإنجاز تُولَّد النسخة التالية. */
    val repeat: String? = null,
)

@Serializable
data class Habit(
    val id: String = UUID.randomUUID().toString(),
    val title: String,
    val emoji: String = "✅",
    val targetPerDay: Int = 1,
    /** yyyy-MM-dd -> عدد المرات */
    val log: Map<String, Int> = emptyMap(),
    val createdAt: Long = System.currentTimeMillis(),
    val colorIndex: Int = 0,
    /** وقت التذكير اليومي بصيغة HH:mm، أو null بلا تذكير. */
    val reminderTime: String? = null,
)

@Serializable
data class Note(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "",
    val body: String,
    val pinned: Boolean = false,
    val colorIndex: Int = 0,
    val updatedAt: Long = System.currentTimeMillis(),
)

// ---------------------------------------------------------------- المساعد

/** سجلّ أمر نفّذه المساعد على الهاتف — يُعرض في المحادثة ليعرف المستخدم ما جرى. */
@Serializable
data class ToolRun(
    val name: String,
    val label: String,
    val ok: Boolean,
    val denied: Boolean = false,
)

@Serializable
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String, // "user" | "assistant"
    val content: String,
    val createdAt: Long = System.currentTimeMillis(),
    val error: Boolean = false,
    /** الأوامر التي نفّذها المساعد ضمن هذا الرد. */
    val toolRuns: List<ToolRun> = emptyList(),
    /** مسار صورة أرفقها المستخدم مع هذه الرسالة، إن وُجدت. */
    val imagePath: String? = null,
)

@Serializable
data class Conversation(
    val id: String = UUID.randomUUID().toString(),
    val title: String = "محادثة جديدة",
    val messages: List<ChatMessage> = emptyList(),
    val updatedAt: Long = System.currentTimeMillis(),
)

/** اختصار يعرّفه المستخدم: عبارة قصيرة تُرسل أمرًا جاهزًا للمساعد. */
@Serializable
data class Shortcut(
    val id: String = UUID.randomUUID().toString(),
    val label: String,
    val emoji: String = "⚡",
    val prompt: String,
    val createdAt: Long = System.currentTimeMillis(),
)

/** تقدير استهلاك المحادثة — يُقرأ من ردّ الواجهة البرمجية. */
@Serializable
data class UsageStats(
    val inputTokens: Long = 0,
    val outputTokens: Long = 0,
    val cachedTokens: Long = 0,
    val requests: Long = 0,
)

@Serializable
data class DailyBrief(
    /** yyyy-MM-dd */
    val date: String,
    val body: String,
    val createdAt: Long = System.currentTimeMillis(),
)
