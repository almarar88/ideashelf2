package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.HttpFailure
import com.rafeeq.companion.core.Net
import com.rafeeq.companion.core.friendlyMessage
import com.rafeeq.companion.data.control.ActionResult
import com.rafeeq.companion.data.control.ToolSpec
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * حلقة استخدام الأدوات: يطلب من النموذج ردًا، وإن طلب تنفيذ أمر على الهاتف
 * ننفّذه ونُعيد له النتيجة، ويتكرّر ذلك حتى ينتهي.
 *
 * هذه هي الآلية التي تحوّل المساعد من محادثة إلى تنفيذ فعلي.
 */
class AgentRunner(private val apiKeyProvider: () -> String) {

    data class ToolCall(val id: String, val name: String, val input: JsonObject)

    sealed interface Event {
        /** جزء من نصّ الرد أثناء كتابته. */
        data class Text(val delta: String) : Event

        /** النموذج طلب تنفيذ أمر على الهاتف. */
        data class ToolStarted(val call: ToolCall) : Event

        /** انتهى تنفيذ الأمر. */
        data class ToolFinished(val call: ToolCall, val result: ActionResult) : Event

        /** المستخدم رفض تنفيذ أمر حسّاس. */
        data class ToolDenied(val call: ToolCall) : Event

        data class Failed(val message: String) : Event

        data object Completed : Event
    }

    /** ناتج جولة واحدة من النموذج. */
    internal data class Turn(
        val text: String,
        val toolCalls: List<ToolCall>,
        val stopReason: String?,
        val refusal: String?,
    )

    /**
     * يدير الحوار كاملًا حتى ينتهي النموذج أو يبلغ [maxTurns].
     *
     * [history] تُعدَّل مباشرة لتبقى متوافقة مع ما يراه النموذج،
     * [confirm] تُستدعى قبل كل أمر حسّاس، و[execute] تنفّذ الأمر فعليًا.
     */
    suspend fun run(
        model: String,
        system: String,
        history: MutableList<JsonObject>,
        tools: JsonArray,
        effort: String,
        maxTurns: Int = 12,
        specOf: (String) -> ToolSpec?,
        confirm: suspend (ToolCall, ToolSpec) -> Boolean,
        execute: suspend (ToolCall) -> ActionResult,
        emit: suspend (Event) -> Unit,
    ) {
        var turns = 0

        while (turns < maxTurns) {
            turns++

            val turn = try {
                streamTurn(model, system, history, tools, effort) { delta ->
                    emit(Event.Text(delta))
                }
            } catch (error: Throwable) {
                emit(Event.Failed(error.friendlyMessage()))
                return
            }

            if (turn.refusal != null) {
                emit(Event.Failed(turn.refusal))
                return
            }

            // نُعيد رد النموذج كاملًا إلى السجلّ (النص + طلبات الأدوات).
            history += buildAssistantMessage(turn)

            if (turn.toolCalls.isEmpty()) {
                emit(Event.Completed)
                return
            }

            // ننفّذ كل الأدوات المطلوبة ثم نُعيد نتائجها في رسالة واحدة،
            // كما تتطلّب الواجهة عند الاستدعاء المتوازي.
            val results = mutableListOf<Pair<ToolCall, ActionResult>>()
            for (call in turn.toolCalls) {
                val spec = specOf(call.name)
                if (spec != null && spec.sensitive && !confirm(call, spec)) {
                    emit(Event.ToolDenied(call))
                    results += call to ActionResult.fail(
                        "رفض المستخدم تنفيذ هذا الأمر. لا تحاول تنفيذه مرة أخرى، " +
                            "واسأله عمّا يريد بدلًا منه.",
                    )
                    continue
                }
                emit(Event.ToolStarted(call))
                val result = execute(call)
                emit(Event.ToolFinished(call, result))
                results += call to result
            }

            history += buildToolResultsMessage(results)
        }

        emit(Event.Failed("توقّفت بعد $maxTurns خطوة دون إنهاء المهمة."))
    }

    // ------------------------------------------------------------ بناء الرسائل

    internal fun buildAssistantMessage(turn: Turn): JsonObject = buildJsonObject {
        put("role", "assistant")
        putJsonArray("content") {
            if (turn.text.isNotBlank()) {
                add(
                    buildJsonObject {
                        put("type", "text")
                        put("text", turn.text)
                    },
                )
            }
            turn.toolCalls.forEach { call ->
                add(
                    buildJsonObject {
                        put("type", "tool_use")
                        put("id", call.id)
                        put("name", call.name)
                        put("input", call.input)
                    },
                )
            }
        }
    }

    internal fun buildToolResultsMessage(
        results: List<Pair<ToolCall, ActionResult>>,
    ): JsonObject = buildJsonObject {
        put("role", "user")
        putJsonArray("content") {
            results.forEach { (call, result) ->
                add(
                    buildJsonObject {
                        put("type", "tool_result")
                        put("tool_use_id", call.id)
                        put("content", result.detail)
                        if (!result.ok) put("is_error", true)
                    },
                )
            }
        }
    }

    // ------------------------------------------------------------ البثّ

    private suspend fun streamTurn(
        model: String,
        system: String,
        history: List<JsonObject>,
        tools: JsonArray,
        effort: String,
        onDelta: suspend (String) -> Unit,
    ): Turn = withContext(Dispatchers.IO) {
        val payload = buildJsonObject {
            put("model", model)
            put("max_tokens", 8192)
            put("stream", true)
            if (system.isNotBlank()) {
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
            if (tools.isNotEmpty()) put("tools", tools)
            put("messages", JsonArray(history))
        }

        val request = Request.Builder()
            .url(ClaudeClient.ENDPOINT)
            .header("x-api-key", apiKeyProvider().trim().ifBlank { error("لم يُضبط مفتاح Anthropic.") })
            .header("anthropic-version", ClaudeClient.API_VERSION)
            .header("content-type", "application/json")
            .post(
                Net.json.encodeToString(JsonObject.serializer(), payload)
                    .toRequestBody("application/json".toMediaType()),
            )
            .build()

        Net.client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) {
                val body = response.body?.string().orEmpty()
                throw HttpFailure(response.code, extractError(body))
            }
            val source = response.body?.source() ?: error("استجابة فارغة من الخدمة.")

            val text = StringBuilder()
            val toolCalls = mutableListOf<ToolCall>()
            // كل كتلة محتوى لها فهرس، ونجمّع مدخلات الأداة على دفعات نصية.
            val pendingTools = mutableMapOf<Int, PendingTool>()
            var stopReason: String? = null
            var refusal: String? = null
            var currentEvent = ""

            while (!source.exhausted()) {
                val line = source.readUtf8LineStrict()
                when {
                    line.startsWith("event:") -> currentEvent = line.removePrefix("event:").trim()
                    line.startsWith("data:") -> {
                        val data = line.removePrefix("data:").trim()
                        if (data.isEmpty()) continue
                        val obj = runCatching {
                            Net.json.parseToJsonElement(data).jsonObject
                        }.getOrNull() ?: continue

                        when (obj.string("type") ?: currentEvent) {
                            "content_block_start" -> {
                                val index = obj.int("index") ?: continue
                                val block = obj["content_block"]?.jsonObject ?: continue
                                if (block.string("type") == "tool_use") {
                                    pendingTools[index] = PendingTool(
                                        id = block.string("id").orEmpty(),
                                        name = block.string("name").orEmpty(),
                                    )
                                }
                            }

                            "content_block_delta" -> {
                                val index = obj.int("index") ?: continue
                                val delta = obj["delta"]?.jsonObject ?: continue
                                when (delta.string("type")) {
                                    "text_delta" -> delta.string("text")?.let {
                                        text.append(it)
                                        onDelta(it)
                                    }
                                    "input_json_delta" -> delta.string("partial_json")?.let {
                                        pendingTools[index]?.json?.append(it)
                                    }
                                }
                            }

                            "content_block_stop" -> {
                                val index = obj.int("index") ?: continue
                                pendingTools.remove(index)?.let { pending ->
                                    val input = runCatching {
                                        Net.json.parseToJsonElement(
                                            pending.json.toString().ifBlank { "{}" },
                                        ).jsonObject
                                    }.getOrDefault(JsonObject(emptyMap()))
                                    toolCalls += ToolCall(pending.id, pending.name, input)
                                }
                            }

                            "message_delta" -> {
                                val delta = obj["delta"]?.jsonObject
                                stopReason = delta?.string("stop_reason") ?: stopReason
                                if (stopReason == "refusal") {
                                    refusal = delta?.get("stop_details")?.jsonObject
                                        ?.string("explanation")
                                        ?: "تعذّر إكمال هذا الطلب."
                                }
                            }

                            "error" -> {
                                val message = obj["error"]?.jsonObject?.string("message")
                                throw IllegalStateException(message ?: "خطأ من الخدمة")
                            }

                            "message_stop" -> Unit
                        }
                    }
                }
            }

            Turn(text.toString(), toolCalls, stopReason, refusal)
        }
    }

    private class PendingTool(val id: String, val name: String) {
        val json = StringBuilder()
    }

    private fun JsonObject.string(key: String): String? = runCatching {
        val element: JsonElement = this[key] ?: return null
        element.jsonPrimitive.let { if (it is kotlinx.serialization.json.JsonNull) null else it.content }
    }.getOrNull()

    private fun JsonObject.int(key: String): Int? =
        runCatching { this[key]?.jsonPrimitive?.content?.toIntOrNull() }.getOrNull()

    private fun extractError(body: String): String = runCatching {
        Net.json.parseToJsonElement(body).jsonObject["error"]
            ?.jsonObject?.get("message")?.jsonPrimitive?.content
    }.getOrNull() ?: body.take(300)
}
