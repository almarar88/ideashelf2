package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.AppSettings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * طلب واحد بلا أدوات ولا بثّ — يتبع المزوّد الفعّال.
 *
 * كان كل ما عدا المحادثة ينادي Anthropic مباشرةً: الموجز الصباحي، وخطّة
 * اليوم، واستخراج المهام، وأدوات النصّ. فمن بدّل إلى Grok أو Gemini ووضع
 * مفتاحه هناك، كانت هذه المزايا ترسل إلى Anthropic بمفتاح فارغ وتفشل
 * بـ«المفتاح غير صالح» — ويظنّ أن مفتاحه الجديد خاطئ. وبعضها كان يطلب منه
 * صراحةً «أضِف مفتاح Anthropic» بعد أن اختار مزوّدًا آخر عن قصد.
 *
 * تبديل المزوّد يجب أن يبدّل التطبيق كلّه، لا المحادثة وحدها.
 */
class Completion(
    /**
     * مُعلَّقة لا عادية — عمدًا.
     *
     * كانت دالّة عادية تقرأ الإعدادات بـ `runBlocking`. ولأن `text` تُنادى
     * من `viewModelScope` أي على الخيط الرئيسي، كان أوّل سطر فيها يحجب
     * الواجهة على قراءة قرص: يعلّق التطبيق ولا تُفتح الشاشة الرئيسية.
     * التوقيع المُعلَّق يجعل ذلك مستحيلًا.
     */
    private val settingsOf: suspend () -> AppSettings,
    private val claude: ClaudeClient,
) {

    /**
     * يعيد نصّ الردّ. يرمي عند الفشل، ورسالته مترجمة بصيغة المزوّد نفسه.
     */
    suspend fun text(
        system: String,
        user: String,
        maxTokens: Int = 1200,
        effort: String = "medium",
    ): String = withContext(Dispatchers.IO) {
        // كل شيء خارج الخيط الرئيسي، بما في ذلك قراءة الإعدادات.
        val settings = settingsOf()
        val provider = settings.activeProvider

        if (provider.kind == Provider.Kind.ANTHROPIC) {
            return@withContext claude.complete(
                model = settings.activeModel,
                system = system,
                messages = listOf(ClaudeClient.Msg("user", user)),
                maxTokens = maxTokens,
                effort = effort,
            )
        }

        run {
            val url = settings.activeUrl.trimEnd('/')
            val payload = buildJsonObject {
                put("model", settings.activeModel)
                putJsonArray("messages") {
                    add(buildJsonObject { put("role", "system"); put("content", system) })
                    add(buildJsonObject { put("role", "user"); put("content", user) })
                }
                // لا max_tokens: بعض المزوّدين يرفض الحقل وبعضهم يسمّيه غير ذلك،
                // والطول محكومٌ بالتعليمات أصلًا. نفس السبب في فحص المفتاح.
            }
            val request = Request.Builder()
                .url("$url/chat/completions")
                .header("Authorization", "Bearer ${settings.activeKey}")
                .post(payload.toString().toRequestBody("application/json".toMediaType()))
                .build()

            Net.execute(request).use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) {
                    throw IllegalStateException("${response.code}: ${extractMessage(body)}")
                }
                Net.json.parseToJsonElement(body).jsonObject["choices"]?.jsonArray
                    ?.firstOrNull()?.jsonObject
                    ?.get("message")?.jsonObject
                    ?.get("content")?.jsonPrimitive?.contentOrNull
                    .orEmpty()
            }
        }
    }

    private fun extractMessage(body: String): String = runCatching {
        Net.json.parseToJsonElement(body).jsonObject["error"]
            ?.jsonObject?.get("message")?.jsonPrimitive?.content
    }.getOrNull() ?: body.take(200)
}

