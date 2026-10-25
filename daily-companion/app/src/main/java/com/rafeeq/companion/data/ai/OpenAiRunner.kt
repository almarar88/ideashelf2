package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.control.ActionResult
import com.rafeeq.companion.data.control.ToolSpec
import kotlinx.coroutines.Dispatchers
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
 * حلقة الأدوات عبر واجهة متوافقة مع OpenAI.
 *
 * توقيعها نسخة من [AgentRunner.run] عمدًا: المُنادي واحد، فلا يختلف ما يشعر
 * به المستخدم باختلاف المزوّد — نفس الأحداث ونفس الموافقة ونفس الحدّ الأقصى
 * للأدوار.
 *
 * الجزء الهشّ ليس بناء الطلب بل تجميع استدعاءات الأدوات: تصل مجزّأة على عدّة
 * أجزاء، والاسم والوسائط مقطّعان، وتُجمَّع بحسب الفهرس لا بترتيب الوصول.
 */
class OpenAiRunner(
    private val apiKeyProvider: () -> String,
    private val baseUrlProvider: () -> String,
) {

    companion object {
        /** أدواتنا موصوفة بشكل Anthropic؛ هذه تترجمها إلى شكل OpenAI. */
        fun toolsToOpenAi(tools: JsonArray): JsonArray = buildJsonArray {
            for (element in tools) {
                val tool = element.jsonObject
                val name = tool["name"]?.jsonPrimitive?.content ?: continue
                // أدوات الخادم (مثل البحث) بلا مخطّط: تُسقَط بدل أن تُرسَل فتُرفض.
                val schema = tool["input_schema"]?.jsonObject ?: continue
                add(buildJsonObject {
                    put("type", "function")
                    putJsonObject("function") {
                        put("name", name)
                        put("description", tool["description"]?.jsonPrimitive?.content ?: "")
                        put("parameters", schema)
                    }
                })
            }
        }

        /** نتيجة كل أداة رسالة مستقلّة بدور `tool`. */
        fun toolResult(callId: String, result: ActionResult): JsonObject = buildJsonObject {
            put("role", "tool")
            put("tool_call_id", callId)
            // لا كتل صور هنا: الواجهة المتوافقة تقبل نصًّا فقط في نتيجة الأداة،
            // فنقول إن ثمّة صورة بدل إرسال ما يُرفض.
            put(
                "content",
                if (result.imageBase64 != null) {
                    "${result.detail}\n(أُلتقطت صورة — غير مدعومة مع هذا المزوّد)"
                } else {
                    result.detail
                },
            )
        }

        /** يترجم أخطاء المزوّدين إلى عربية مفهومة. */
        fun friendly(error: Throwable, provider: Provider): String {
            val text = error.message.orEmpty()
            return when {
                Regex("401|unauthorized|invalid.?api.?key", RegexOption.IGNORE_CASE)
                    .containsMatchIn(text) -> "مفتاح ${provider.label} غير صالح."
                text.contains("429") -> "طلبات كثيرة — انتظر لحظة."
                Regex("402|quota|insufficient|billing", RegexOption.IGNORE_CASE)
                    .containsMatchIn(text) -> "الرصيد انتهى لدى المزوّد."
                Regex("404|model.*not.*found", RegexOption.IGNORE_CASE)
                    .containsMatchIn(text) ->
                    "معرّف النموذج غير موجود لدى هذا المزوّد — راجعه في الإعدادات."
                Regex("ECONNREFUSED|Failed to connect", RegexOption.IGNORE_CASE)
                    .containsMatchIn(text) -> "ما في خدمة على هذا العنوان."
                Regex("Unable to resolve host|timeout|timed out", RegexOption.IGNORE_CASE)
                    .containsMatchIn(text) -> "ما في اتصال."
                text.isBlank() -> "تعذّر الوصول إلى المزوّد."
                else -> text.take(180)
            }
        }
    }

    private data class Turn(
        val text: String,
        val calls: List<AgentRunner.ToolCall>,
        /** رسالة المساعد كما تُعاد إلى الخادم في الدور التالي. */
        val message: JsonObject?,
        val inputTokens: Long,
        val outputTokens: Long,
    )

    suspend fun run(
        provider: Provider,
        model: String,
        system: String,
        history: MutableList<JsonObject>,
        tools: JsonArray,
        maxTurns: Int = 12,
        specOf: (String) -> ToolSpec?,
        confirm: suspend (AgentRunner.ToolCall, ToolSpec) -> Boolean,
        execute: suspend (AgentRunner.ToolCall) -> ActionResult,
        emit: suspend (AgentRunner.Event) -> Unit,
    ) {
        var turns = 0
        while (turns < maxTurns) {
            turns++

            val turn = try {
                streamTurn(model, system, history, tools, emit)
            } catch (error: Throwable) {
                emit(AgentRunner.Event.Failed(friendly(error, provider)))
                return
            }

            if (turn.inputTokens > 0 || turn.outputTokens > 0) {
                emit(AgentRunner.Event.Usage(turn.inputTokens, turn.outputTokens, 0))
            }
            turn.message?.let { history += it }

            if (turn.calls.isEmpty()) return

            for (call in turn.calls) {
                val spec = specOf(call.name)
                if (spec == null) {
                    history += toolResult(
                        call.id,
                        ActionResult(false, "أداة غير معروفة", "أداة غير معروفة: ${call.name}"),
                    )
                    continue
                }
                if (!confirm(call, spec)) {
                    emit(AgentRunner.Event.ToolDenied(call))
                    history += toolResult(
                        call.id,
                        ActionResult(false, "أُلغي بطلبك", "رفض المستخدم التنفيذ."),
                    )
                    continue
                }
                emit(AgentRunner.Event.ToolStarted(call))
                val result = execute(call)
                emit(AgentRunner.Event.ToolFinished(call, result))
                history += toolResult(call.id, result)
            }
        }
        emit(AgentRunner.Event.Failed("طالت سلسلة الأدوات أكثر من اللازم — أوقفتها."))
    }

    private suspend fun streamTurn(
        model: String,
        system: String,
        history: List<JsonObject>,
        tools: JsonArray,
        emit: suspend (AgentRunner.Event) -> Unit,
    ): Turn = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("model", model)
            putJsonArray("messages") {
                // تعليمات النظام رسالة أولى هنا، لا حقلًا مستقلًّا كما عند Anthropic.
                add(buildJsonObject { put("role", "system"); put("content", system) })
                history.forEach { add(it) }
            }
            if (tools.isNotEmpty()) {
                put("tools", toolsToOpenAi(tools))
                put("tool_choice", "auto")
            }
            put("stream", true)
            putJsonObject("stream_options") { put("include_usage", true) }
        }

        val base = baseUrlProvider().trimEnd('/')
        val request = Request.Builder()
            .url("$base/chat/completions")
            .header("Authorization", "Bearer ${apiKeyProvider()}")
            .header("Content-Type", "application/json")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        Net.execute(request).use { response ->
            if (!response.isSuccessful) {
                val body = response.body?.string().orEmpty()
                throw IllegalStateException("${response.code}: ${extractError(body)}")
            }
            val source = response.body?.source()
                ?: throw IllegalStateException("ردّ فارغ من المزوّد")

            val text = StringBuilder()
            var inputTokens = 0L
            var outputTokens = 0L
            // الأجزاء مجمّعة بالفهرس: هكذا يرسلها المزوّد.
            val partial = sortedMapOf<Int, Triple<StringBuilder, StringBuilder, StringBuilder>>()

            while (true) {
                val line = source.readUtf8Line() ?: break
                if (!line.startsWith("data:")) continue
                val payloadLine = line.removePrefix("data:").trim()
                if (payloadLine.isEmpty() || payloadLine == "[DONE]") continue

                val event = runCatching {
                    Net.json.parseToJsonElement(payloadLine).jsonObject
                }.getOrNull() ?: continue

                event["usage"]?.jsonObject?.let { usage ->
                    inputTokens = usage["prompt_tokens"]?.jsonPrimitive?.content?.toLongOrNull() ?: inputTokens
                    outputTokens = usage["completion_tokens"]?.jsonPrimitive?.content?.toLongOrNull() ?: outputTokens
                }

                val choice = event["choices"]?.jsonArray?.firstOrNull()?.jsonObject ?: continue
                val delta = choice["delta"]?.jsonObject ?: continue

                delta["content"]?.jsonPrimitive?.contentOrNullSafe()?.let { piece ->
                    if (piece.isNotEmpty()) {
                        text.append(piece)
                        emit(AgentRunner.Event.Text(piece))
                    }
                }

                delta["tool_calls"]?.jsonArray?.forEach { element ->
                    val piece = element.jsonObject
                    val index = piece["index"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                    val slot = partial.getOrPut(index) {
                        Triple(StringBuilder(), StringBuilder(), StringBuilder())
                    }
                    piece["id"]?.jsonPrimitive?.contentOrNullSafe()?.let {
                        slot.first.setLength(0); slot.first.append(it)
                    }
                    piece["function"]?.jsonObject?.let { fn ->
                        fn["name"]?.jsonPrimitive?.contentOrNullSafe()?.let { slot.second.append(it) }
                        fn["arguments"]?.jsonPrimitive?.contentOrNullSafe()?.let { slot.third.append(it) }
                    }
                }
            }

            val calls = mutableListOf<AgentRunner.ToolCall>()
            val wire = buildJsonArray {
                for ((index, slot) in partial) {
                    val name = slot.second.toString()
                    if (name.isBlank()) continue
                    val id = slot.first.toString().ifBlank { "call_$index" }
                    val args = slot.third.toString().ifBlank { "{}" }
                    val parsed = runCatching {
                        Net.json.parseToJsonElement(args).jsonObject
                    // وسائط مشوّهة: ننفّذ بما لدينا بدل إسقاط الاستدعاء كلّه.
                    }.getOrElse { JsonObject(emptyMap()) }
                    calls += AgentRunner.ToolCall(id, name, parsed)
                    add(buildJsonObject {
                        put("id", id)
                        put("type", "function")
                        putJsonObject("function") { put("name", name); put("arguments", args) }
                    })
                }
            }

            val message = if (text.isNotEmpty() || wire.isNotEmpty()) {
                buildJsonObject {
                    put("role", "assistant")
                    put("content", if (text.isEmpty()) JsonPrimitive(null as String?) else JsonPrimitive(text.toString()))
                    if (wire.isNotEmpty()) put("tool_calls", wire)
                }
            } else {
                null
            }

            Turn(text.toString(), calls, message, inputTokens, outputTokens)
        }
    }
}

/** `content` قد يأتي null في البثّ؛ هذه تتجنّب رميه كنصّ "null". */
private fun JsonPrimitive.contentOrNullSafe(): String? =
    if (this is kotlinx.serialization.json.JsonNull) null else content

private fun extractError(body: String): String = runCatching {
    Net.json.parseToJsonElement(body).jsonObject["error"]
        ?.jsonObject?.get("message")?.jsonPrimitive?.content
}.getOrNull() ?: body.take(200)
