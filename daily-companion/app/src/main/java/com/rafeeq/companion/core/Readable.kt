package com.rafeeq.companion.core

/**
 * استخراج نصّ صفحة الويب القابل للقراءة من HTML.
 *
 * المساعد لم يكن يرى الإنترنت إطلاقًا مع المزوّدين غير Anthropic: أداة
 * «البحث» كانت تفتح المتصفّح للمستخدم ولا تُعيد للنموذج حرفًا. فصار من
 * يشارك رابطًا ويطلب تلخيصه يسمع أن المساعد لا يستطيع فتح الروابط.
 *
 * هذا مستخرِجٌ متعمَّد البساطة: لا محلّل DOM ولا مكتبة قراءة. صفحة الخبر
 * نصّها في الفقرات والعناوين، وإسقاط `script` و`style` والقوائم الجانبية
 * يكفي للتلخيص. والبساطة هنا ميزة: لا اعتماد جديد في الحزمة، ولا سلوك
 * يتغيّر مع تغيّر مكتبة خارجية.
 */
object Readable {

    /** ما لا يُقرأ أصلًا: السكربت والتنسيق والقوالب. */
    private val DROPPED = Regex(
        "<(script|style|noscript|svg|template|iframe|nav|footer|form)\\b[^>]*>.*?</\\1>",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL),
    )
    private val COMMENTS = Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL)
    private val TITLE = Regex("<title[^>]*>(.*?)</title>",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    /** الوسوم الكتلية تصير أسطرًا، وإلا التصقت الفقرات ببعضها كلمةً واحدة. */
    private val BLOCKS = Regex(
        "</?(p|div|br|li|tr|h[1-6]|section|article|blockquote|header)\\b[^>]*>",
        RegexOption.IGNORE_CASE,
    )
    private val TAGS = Regex("<[^>]+>")

    private val ENTITIES = mapOf(
        "&nbsp;" to " ", "&amp;" to "&", "&lt;" to "<", "&gt;" to ">",
        "&quot;" to "\"", "&#39;" to "'", "&apos;" to "'", "&laquo;" to "«",
        "&raquo;" to "»", "&hellip;" to "…", "&mdash;" to "—", "&ndash;" to "–",
    )

    data class Page(val title: String, val text: String)

    /** عنوان الصفحة ونصّها، مقتطعًا عند [limit] حرفًا. */
    fun extract(html: String, limit: Int = 6000): Page {
        val title = TITLE.find(html)?.groupValues?.get(1)?.let { clean(it) }.orEmpty().trim()
        var body = COMMENTS.replace(html, " ")
        body = DROPPED.replace(body, " ")
        body = BLOCKS.replace(body, "\n")
        body = TAGS.replace(body, " ")
        val text = clean(body)
            .lineSequence()
            .map { it.trim() }
            // الأسطر القصيرة جدًا في صفحات الأخبار أزرارٌ وروابط تنقّل لا نصّ.
            .filter { it.length > 2 }
            .joinToString("\n")
            .replace(Regex("\n{3,}"), "\n\n")
            .trim()
        return Page(title, if (text.length <= limit) text else text.take(limit).trimEnd() + "…")
    }

    private fun clean(input: String): String {
        var out = input
        for ((entity, value) in ENTITIES) out = out.replace(entity, value, ignoreCase = true)
        // الكيانات الرقمية: &#1575; و&#x627;
        out = Regex("&#(\\d{1,6});").replace(out) { m ->
            m.groupValues[1].toIntOrNull()?.takeIf { it in 1..0x10FFFF }
                ?.let { String(Character.toChars(it)) } ?: m.value
        }
        out = Regex("&#x([0-9a-fA-F]{1,6});").replace(out) { m ->
            m.groupValues[1].toIntOrNull(16)?.takeIf { it in 1..0x10FFFF }
                ?.let { String(Character.toChars(it)) } ?: m.value
        }
        // مسافات أفقية فقط: الأسطر تُبقى ليفصل بينها لاحقًا.
        return out.replace(Regex("[ \\t\\u00A0]+"), " ")
    }
}
