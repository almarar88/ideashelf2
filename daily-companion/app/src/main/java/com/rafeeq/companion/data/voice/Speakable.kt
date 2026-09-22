package com.rafeeq.companion.data.voice

/**
 * تحويل ما يُقرأ بالعين إلى ما يُقال بالأذن.
 *
 * دوالّ خالصة عمدًا: لا سياق ولا شبكة ولا صوت، فتُختبَر وحدها. المنطق نفسه
 * موجود في نسخة ويندوز — أي تغيير هنا يجب أن يرافقه تغيير هناك، وإلا نطق
 * التطبيقان الجملة نفسها بطريقتين.
 */
object Speakable {

    /**
     * يقسّم نصًّا متدفّقًا إلى جُمل جاهزة للنطق، ويعيد الباقي غير المكتمل.
     *
     * السبب: النموذج يبثّ الرد رمزًا رمزًا. انتظار اكتماله كلّه قبل النطق
     * يجعل المساعد يصمت ثوانٍ ثم يتكلّم — وهو أكثر ما يجعل المساعدات تبدو
     * بطيئة. ننطق كل جملة فور اكتمالها.
     */
    fun takeSentences(buffer: String): Pair<List<String>, String> {
        val ready = mutableListOf<String>()
        var rest = buffer
        // الترقيم العربي والإنجليزي معًا: ؟ ! . ؛ وسطر جديد.
        val boundary = Regex("[.!?؟؛\n]+\\s*")

        while (true) {
            val match = boundary.find(rest) ?: break
            val end = match.range.last + 1
            val piece = rest.substring(0, end).trim()
            rest = rest.substring(end)
            // حرف أو رقم واحد على الأقل. الترقيم وحده لا يستحقّ نداءً مدفوعًا،
            // لكن حدًّا أعلى يُسقط ردودًا عربية قصيرة صحيحة مثل «تمّ» —
            // والتشكيل لا يُحتسب حرفًا، فيقصر ما ليس بقصير.
            if (piece.any { it.isLetterOrDigit() }) ready += piece
        }
        return ready to rest
    }

    /**
     * ينظّف النصّ قبل النطق.
     *
     * بدونه تُنطق علامات Markdown حرفيًا («نجمة نجمة»)، وتُتلى كتل الشيفرة
     * سطرًا سطرًا، وتُهجّأ الروابط حرفًا حرفًا — وكلّه يُحاسَب بالحرف.
     */
    fun clean(text: String): String = text
        // كتل الشيفرة تُختصر بدل أن تُتلى.
        .replace(Regex("```[\\s\\S]*?```"), " (شيفرة) ")
        .replace(Regex("`([^`]+)`"), "$1")
        // الروابط: نُبقي نصّها ونُسقط عنوانها.
        .replace(Regex("\\[([^\\]]+)\\]\\([^)]*\\)"), "$1")
        .replace(Regex("https?://\\S+"), " رابط ")
        .replace(Regex("[*_#>|]"), " ")
        .replace(Regex("(?m)^\\s*[-•]\\s*"), "")
        .replace(Regex("\\s{2,}"), " ")
        .trim()
}
