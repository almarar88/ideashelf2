package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.HttpFailure
import com.rafeeq.companion.core.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * عميل واجهة Anthropic Messages عبر HTTP مباشرة.
 *
 * لماذا HTTP خام بدل حزمة الـ SDK الرسمية؟ حزمة Java الرسمية مبنية لبيئة JVM
 * الكاملة (Jackson + Reflection) وليست مدعومة رسميًا على أندرويد، وإدخالها
 * يضخّم حجم التطبيق ويكسر التصغير (R8). الاستدعاء المباشر هنا خفيف ومستقر.
 *
 * المفتاح يبقى على جهاز المستخدم فقط (DataStore) ولا يُرسل لأي جهة سوى Anthropic.
 */
class ClaudeClient(private val apiKeyProvider: () -> String) {

    companion object {
        const val ENDPOINT = "https://api.anthropic.com/v1/messages"
        const val API_VERSION = "2023-06-01"

        /** النماذج المتاحة للاختيار داخل الإعدادات. */
        val models = listOf(
            ModelOption("claude-opus-5", "Claude Opus 5", "الأذكى — للمهام المعقّدة والتخطيط"),
            ModelOption("claude-sonnet-5", "Claude Sonnet 5", "متوازن — سريع واقتصادي للاستخدام اليومي"),
            ModelOption("claude-haiku-4-5", "Claude Haiku 4.5", "الأسرع والأرخص — للملخّصات القصيرة"),
        )

        val effortLevels = listOf(
            "low" to "سريع",
            "medium" to "متوازن",
            "high" to "عميق",
        )
    }

    data class ModelOption(val id: String, val label: String, val description: String)

    data class Msg(val role: String, val content: String)

    /**
     * إرسال محادثة والحصول على الرد كاملًا (بدون بثّ).
     * يُستخدم للمهام القصيرة مثل تلخيص خبر.
     */
    suspend fun complete(
        model: String,
        system: String,
        messages: List<Msg>,
        maxTokens: Int = 4096,
        effort: String = "medium",
    ): String = withContext(Dispatchers.IO) {
        val payload = buildPayload(model, system, messages, maxTokens, effort, stream = false)
        val request = buildRequest(payload)
        Net.execute(request).use { response ->
            val body = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw HttpFailure(response.code, extractApiError(body))
            parseNonStreaming(body)
        }
    }

    /**
     * بثّ الرد قطعةً قطعة عبر SSE ليظهر النص أثناء كتابته — تجربة أسرع بكثير.
     */
    fun stream(
        model: String,
        system: String,
        messages: List<Msg>,
        maxTokens: Int = 8192,
        effort: String = "medium",
    ): Flow<StreamEvent> = callbackFlow {
        val payload = buildPayload(model, system, messages, maxTokens, effort, stream = true)
        val call = Net.client.newCall(buildRequest(payload))

        val worker = Thread {
            try {
                call.execute().use { response ->
                    if (!response.isSuccessful) {
                        val body = response.body?.string().orEmpty()
                        trySend(StreamEvent.Failure(HttpFailure(response.code, extractApiError(body))))
                        close()
                        return@use
                    }
                    val source = response.body?.source()
                    if (source == null) {
                        trySend(StreamEvent.Failure(IllegalStateException("استجابة فارغة")))
                        close()
                        return@use
                    }
                    var currentEvent = ""
                    while (!source.exhausted()) {
                        val line = source.readUtf8LineStrict()
                        when {
                            line.startsWith("event:") -> currentEvent = line.removePrefix("event:").trim()
                            line.startsWith("data:") -> {
                                val data = line.removePrefix("data:").trim()
                                if (data.isEmpty()) continue
                                handleSseData(currentEvent, data)?.let { trySend(it) }
                                if (currentEvent == "message_stop") {
                                    close(); return@use
                                }
                            }
                        }
                    }
                    close()
                }
            } catch (e: Throwable) {
                trySend(StreamEvent.Failure(e))
                close()
            }
        }
        worker.isDaemon = true
        worker.start()

        awaitClose { runCatching { call.cancel() } }
    }.flowOn(Dispatchers.IO)

    sealed interface StreamEvent {
        data class Delta(val text: String) : StreamEvent
        data class Done(val stopReason: String?) : StreamEvent
        data class Refused(val explanation: String) : StreamEvent
        data class Failure(val error: Throwable) : StreamEvent
    }

    private fun handleSseData(event: String, data: String): StreamEvent? {
        val obj = runCatching { Net.json.parseToJsonElement(data).jsonObject }.getOrNull() ?: return null
        return when (obj["type"]?.jsonPrimitive?.contentOrNullSafe() ?: event) {
            "content_block_delta" -> {
                val delta = obj["delta"]?.jsonObject
                val type = delta?.get("type")?.jsonPrimitive?.contentOrNullSafe()
                if (type == "text_delta") {
                    delta["text"]?.jsonPrimitive?.contentOrNullSafe()?.let { StreamEvent.Delta(it) }
                } else null
            }
            "message_delta" -> {
                val stop = obj["delta"]?.jsonObject?.get("stop_reason")?.jsonPrimitive?.contentOrNullSafe()
                if (stop == "refusal") {
                    val explanation = obj["delta"]?.jsonObject?.get("stop_details")
                        ?.jsonObject?.get("explanation")?.jsonPrimitive?.contentOrNullSafe()
                    StreamEvent.Refused(explanation ?: "تعذّر إكمال هذا الطلب.")
                } else StreamEvent.Done(stop)
            }
            "error" -> {
                val message = obj["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNullSafe()
                StreamEvent.Failure(IllegalStateException(message ?: "خطأ من الخدمة"))
            }
            else -> null
        }
    }

    private fun buildRequest(payload: JsonObject): Request {
        val key = apiKeyProvider().trim()
        require(key.isNotBlank()) { "لم يتم ضبط مفتاح Anthropic بعد." }
        return Request.Builder()
            .url(ENDPOINT)
            .header("x-api-key", key)
            .header("anthropic-version", API_VERSION)
            .header("content-type", "application/json")
            .post(
                Net.json.encodeToString(JsonObject.serializer(), payload)
                    .toRequestBody("application/json".toMediaType()),
            )
            .build()
    }

    private fun buildPayload(
        model: String,
        system: String,
        messages: List<Msg>,
        maxTokens: Int,
        effort: String,
        stream: Boolean,
    ): JsonObject = buildJsonObject {
        put("model", model)
        put("max_tokens", maxTokens)
        if (stream) put("stream", true)

        if (system.isNotBlank()) {
            // نضع تعليمات النظام في كتلة قابلة للتخزين المؤقت لتقليل الكلفة
            // في المحادثات الطويلة (نفس البادئة تتكرّر مع كل رسالة).
            putJsonArray("system") {
                add(
                    buildJsonObject {
                        put("type", "text")
                        put("text", system)
                        putJsonObject("cache_control") { put("type", "ephemeral") }
                    },
                )
            }
        }

        putJsonObject("output_config") { put("effort", effort) }

        put(
            "messages",
            buildJsonArray {
                messages.filter { it.content.isNotBlank() }.forEach { msg ->
                    add(
                        buildJsonObject {
                            put("role", msg.role)
                            put("content", msg.content)
                        },
                    )
                }
            },
        )
    }

    private fun parseNonStreaming(body: String): String {
        val obj = Net.json.parseToJsonElement(body).jsonObject
        if (obj["stop_reason"]?.jsonPrimitive?.contentOrNullSafe() == "refusal") {
            val explanation = obj["stop_details"]?.jsonObject?.get("explanation")
                ?.jsonPrimitive?.contentOrNullSafe()
            throw IllegalStateException(explanation ?: "تعذّر إكمال هذا الطلب.")
        }
        val content = obj["content"] as? JsonArray ?: return ""
        return content.mapNotNull { block ->
            val o = block.jsonObject
            if (o["type"]?.jsonPrimitive?.contentOrNullSafe() == "text") {
                o["text"]?.jsonPrimitive?.contentOrNullSafe()
            } else null
        }.joinToString("\n").trim()
    }

    private fun extractApiError(body: String): String = runCatching {
        Net.json.parseToJsonElement(body).jsonObject["error"]
            ?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNullSafe()
    }.getOrNull() ?: body.take(300)

    /** يتحقّق من صلاحية المفتاح بطلب صغير جدًا. */
    suspend fun validateKey(model: String): Result<Unit> = runCatching {
        complete(
            model = model,
            system = "",
            messages = listOf(Msg("user", "قل: تم")),
            maxTokens = 16,
            effort = "low",
        )
        Unit
    }
}

private fun JsonPrimitive.contentOrNullSafe(): String? =
    if (this is kotlinx.serialization.json.JsonNull) null else content
