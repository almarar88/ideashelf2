package com.rafeeq.companion.data.ai

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * أدوات تعمل على خوادم Anthropic لا على الهاتف.
 *
 * أهمّها البحث في الإنترنت: بدونه يبقى المساعد أسير ما تدرّب عليه،
 * ومعه يجيب عن سعر اليوم ونتيجة أمس وآخر خبر — وهو الفارق الأكبر
 * بينه وبين مساعد لا يعرف ما بعد تاريخ تدريبه.
 */
object ServerTools {

    /** الإصدار الأحدث (بترشيح ديناميكي) غير مدعوم على Haiku، فنُنزل إليه هناك. */
    private const val SEARCH_LATEST = "web_search_20260209"
    private const val SEARCH_BASIC = "web_search_20250305"

    const val WEB_SEARCH = "web_search"

    fun searchTypeFor(model: String): String =
        if (model.startsWith("claude-haiku")) SEARCH_BASIC else SEARCH_LATEST

    /**
     * تعريف أداة البحث. [maxUses] يحدّ عدد عمليات البحث في الدور الواحد
     * حتى لا تتحوّل سؤالًا بسيطًا إلى فاتورة كبيرة.
     */
    fun webSearch(model: String, maxUses: Int = 4): JsonObject = buildJsonObject {
        put("type", searchTypeFor(model))
        put("name", WEB_SEARCH)
        put("max_uses", maxUses)
    }

    /** أسماء الكتل التي تصل جاهزة من الخادم ويجب إعادتها كما هي في السجلّ. */
    val serverResultBlocks = setOf(
        "web_search_tool_result",
        "web_fetch_tool_result",
        "code_execution_tool_result",
        "bash_code_execution_tool_result",
    )
}
