package com.rafeeq.companion.data.voice

import com.rafeeq.companion.core.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.security.MessageDigest

/**
 * أصوات ElevenLabs الواقعية: نطق وتفريغ.
 *
 * نداء HTTPS خام عبر [Net] كما يفعل عميل Anthropic — بلا حزمة إضافية تُضخّم
 * حجم التطبيق. المفتاح يبقى في إعدادات الجهاز ولا يغادره إلا إلى ElevenLabs.
 *
 * النقاط والنماذج من التوثيق الرسمي:
 *   POST /v1/text-to-speech/{voice_id}   ترويسة xi-api-key
 *   POST /v1/speech-to-text              multipart: model_id + file
 *   GET  /v1/voices
 */
object ElevenLabs {

    private const val BASE = "https://api.elevenlabs.io/v1"

    /** نماذج النطق التي تدعم العربية. eleven_flash_v2 مستبعَد: إنجليزي فقط. */
    val models = listOf(
        VoiceModel("eleven_v3_conversational", "محادثة v3", "الأنسب للمساعد — ~٢٨٠ مللي ثانية"),
        VoiceModel("eleven_flash_v2_5", "Flash v2.5", "الأسرع والأرخص — ~٧٥ مللي ثانية"),
        VoiceModel("eleven_v3", "v3", "الأعلى جودة تعبيرية"),
        VoiceModel("eleven_multilingual_v2", "متعدّد اللغات v2", "افتراضي ElevenLabs"),
    )

    const val STT_MODEL = "scribe_v2"

    data class VoiceModel(val id: String, val arabic: String, val hint: String)

    data class Voice(
        val id: String,
        val name: String,
        val accent: String,
        val language: String,
        val previewUrl: String,
    ) {
        val isArabic: Boolean get() = language.startsWith("ar") || accent.startsWith("ar")
    }

    class Failure(message: String) : Exception(message)

    /** يترجم أخطاء الخدمة إلى عربية مفهومة بدل تمرير نصّ الخادم. */
    fun friendly(error: Throwable): String {
        val text = error.message.orEmpty()
        return when {
            text.contains("401") || text.contains("unauthorized", true) ->
                "مفتاح ElevenLabs غير صالح."
            text.contains("402") || text.contains("quota", true) -> "رصيد ElevenLabs انتهى."
            text.contains("429") -> "طلبات كثيرة — انتظر لحظة."
            text.contains("404") -> "الصوت المختار غير موجود في حسابك."
            text.contains("timeout", true) || text.contains("Unable to resolve host") ->
                "ما في اتصال بالإنترنت."
            text.isBlank() -> "تعذّر الوصول إلى ElevenLabs."
            else -> text.take(160)
        }
    }

    // ----------------------------------------------------------- الأصوات

    /**
     * أصوات حساب المستخدم.
     *
     * لا نضمّن معرّفات ثابتة: معرّفات ElevenLabs مرتبطة بالحساب، وأي معرّف
     * نكتبه هنا قد لا يعمل عند مستخدم آخر.
     */
    suspend fun voices(apiKey: String): List<Voice> = withContext(Dispatchers.IO) {
        val request = Request.Builder()
            .url("$BASE/voices")
            .header("xi-api-key", apiKey)
            .build()

        Net.execute(request).use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw Failure("${response.code}: ${body.take(200)}")

            val parsed = Json { ignoreUnknownKeys = true }.parseToJsonElement(body).jsonObject
            val list = parsed["voices"]?.jsonArray ?: return@use emptyList()

            list.mapNotNull { element ->
                val voice = element.jsonObject
                val id = voice["voice_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                val labels = voice["labels"]?.jsonObject
                Voice(
                    id = id,
                    name = voice["name"]?.jsonPrimitive?.content.orEmpty(),
                    accent = labels?.get("accent")?.jsonPrimitive?.content.orEmpty(),
                    language = labels?.get("language")?.jsonPrimitive?.content.orEmpty(),
                    previewUrl = voice["preview_url"]?.jsonPrimitive?.content.orEmpty(),
                )
            // العربية أولًا: هذا تطبيق عربي، وترتيب الخدمة الافتراضي إنجليزي.
            }.sortedByDescending { it.isArabic }
        }
    }

    /** يتحقّق من المفتاح بنداء خفيف. */
    suspend fun testKey(apiKey: String): Result<Unit> = runCatching {
        withContext(Dispatchers.IO) {
            val request = Request.Builder()
                .url("$BASE/user/subscription")
                .header("xi-api-key", apiKey)
                .build()
            Net.execute(request).use { response ->
                if (!response.isSuccessful) {
                    throw Failure("${response.code}: ${response.body?.string()?.take(200).orEmpty()}")
                }
            }
        }
    }

    // ------------------------------------------------------------- النطق

    data class SpeechSettings(
        val voiceId: String,
        val modelId: String,
        val stability: Float = 0.5f,
        val similarity: Float = 0.75f,
        val speed: Float = 1f,
    )

    /**
     * ينطق نصًّا ويعيد ملف mp3.
     *
     * [cacheDir] ذاكرة على القرص بمفتاح (نصّ + صوت + نموذج): ElevenLabs
     * يحاسب بالحرف، والمساعد يكرّر عبارات بعينها كثيرًا — «تمّ»، «ما لقيت
     * شيئًا». نطقها مرّتين دفعٌ مرّتين بلا فائدة.
     */
    suspend fun speak(
        apiKey: String,
        text: String,
        settings: SpeechSettings,
        cacheDir: File,
    ): File = withContext(Dispatchers.IO) {
        val clean = text.trim()
        require(clean.isNotEmpty()) { "نصّ فارغ" }

        val cached = File(cacheDir, cacheName(clean, settings))
        if (cached.exists() && cached.length() > 0) return@withContext cached

        val payload: JsonObject = buildJsonObject {
            put("text", clean)
            put("model_id", settings.modelId)
            // mp3 ٤٤.١ كيلوهرتز و١٢٨ كيلوبت: الافتراضي الموثّق ويكفي للكلام.
            put("output_format", "mp3_44100_128")
            put("voice_settings", buildJsonObject {
                put("stability", settings.stability)
                put("similarity_boost", settings.similarity)
                put("speed", settings.speed)
                put("use_speaker_boost", true)
            })
        }

        val request = Request.Builder()
            .url("$BASE/text-to-speech/${settings.voiceId}")
            .header("xi-api-key", apiKey)
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        Net.execute(request).use { response ->
            if (!response.isSuccessful) {
                throw Failure("${response.code}: ${response.body?.string()?.take(200).orEmpty()}")
            }
            val bytes = response.body?.bytes() ?: throw Failure("ردّ فارغ")
            cacheDir.mkdirs()
            // نكتب في ملف مؤقت ثم نعيد تسميته: انقطاع أثناء الكتابة كان
            // يترك ملفًا ناقصًا في الذاكرة يُقرأ لاحقًا كأنه سليم.
            val temp = File(cacheDir, "${cached.name}.part")
            temp.writeBytes(bytes)
            temp.renameTo(cached)
            cached
        }
    }

    fun cacheName(text: String, settings: SpeechSettings): String {
        val digest = MessageDigest.getInstance("SHA-256")
            .digest("${settings.voiceId}|${settings.modelId}|$text".toByteArray())
        return digest.joinToString("") { "%02x".format(it) }.take(32) + ".mp3"
    }

    // ------------------------------------------------------------ التفريغ

    /** يفرّغ تسجيلًا إلى نصّ. [languageCode] فارغ يعني كشفًا تلقائيًا. */
    suspend fun transcribe(
        apiKey: String,
        audio: File,
        languageCode: String = "ar",
    ): String = withContext(Dispatchers.IO) {
        if (!audio.exists() || audio.length() < 1024) throw Failure("التسجيل قصير جدًا.")

        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("model_id", STT_MODEL)
            .addFormDataPart(
                "file", audio.name,
                audio.asRequestBody("audio/mp4".toMediaType()),
            )
            .apply {
                // تحديد اللغة يرفع الدقّة حسب التوثيق.
                if (languageCode.isNotBlank() && languageCode != "auto") {
                    addFormDataPart("language_code", languageCode)
                }
            }
            .build()

        val request = Request.Builder()
            .url("$BASE/speech-to-text")
            .header("xi-api-key", apiKey)
            .post(body)
            .build()

        Net.execute(request).use { response ->
            val raw = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw Failure("${response.code}: ${raw.take(200)}")
            Json { ignoreUnknownKeys = true }
                .parseToJsonElement(raw).jsonObject["text"]
                ?.jsonPrimitive?.content.orEmpty().trim()
        }
    }

    /** يمسح ذاكرة النطق ويعيد ما حُرّر بالبايت. */
    fun clearCache(cacheDir: File): Long {
        var freed = 0L
        cacheDir.listFiles()?.forEach { file ->
            freed += file.length()
            file.delete()
        }
        return freed
    }

    fun cacheSize(cacheDir: File): Long =
        cacheDir.listFiles()?.sumOf { it.length() } ?: 0L
}
