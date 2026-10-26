package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.ArabicText
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * اختيار ما يُحقن في سياق المساعد.
 *
 * كان السياق يأخذ آخر اثنتي عشرة ذكرى مهما كان السؤال، والملاحظات لا
 * تُرسَل أصلًا. فكلّما كتب المستخدم أكثر، رأى المساعد أقلّ ممّا يعنيه: من
 * يحفظ خمسين معلومة عن نفسه يرى المساعد اثنتي عشرة منها فقط، مختارةً
 * بترتيب الإضافة لا بصلتها بالسؤال.
 *
 * هذا ترتيبٌ بالصلة: كلمات السؤال تُطابَق بالنصوص المحفوظة، والكلمة
 * النادرة تزن أكثر من الشائعة (idf) — فمن يسأل عن «حساسية الفول السوداني»
 * تصله تلك الذكرى لا أحدث اثنتي عشرة ملاحظة عن عمله.
 *
 * حسابٌ محلّي خالص: لا نموذج، لا شبكة، لا كلفة، ويعمل مع كل مزوّد.
 */
object Retrieval {

    data class Scored<T>(val item: T, val score: Double)

    /**
     * يرتّب [items] بحسب صلتها بـ [query].
     *
     * [recencyOf] اختياري: عند تساوي الصلة يُقدَّم الأحدث. ومن لا نصّ له
     * يُستبعد لا يُصفَّر — إدراجه بصفر يزاحم ما له معنى.
     */
    fun <T> rank(
        query: String,
        items: List<T>,
        limit: Int,
        textOf: (T) -> String,
        recencyOf: (T) -> Long = { 0L },
    ): List<T> {
        if (items.isEmpty() || limit <= 0) return emptyList()

        val queryTokens = ArabicText.tokens(query).toSet()
        val docs = items.map { it to ArabicText.tokens(textOf(it)) }

        // بلا سؤال ذي معنى (تحية، أو رموز) نعود إلى الأحدث: أصدق من ترتيب عشوائي.
        if (queryTokens.isEmpty()) {
            return items.sortedByDescending(recencyOf).take(limit)
        }

        val total = docs.size.toDouble()
        val seenIn = HashMap<String, Int>()
        for ((_, tokens) in docs) {
            for (token in tokens.toSet()) seenIn[token] = (seenIn[token] ?: 0) + 1
        }

        val scored = docs.mapNotNull { (item, tokens) ->
            if (tokens.isEmpty()) return@mapNotNull null
            val counts = tokens.groupingBy { it }.eachCount()
            var score = 0.0
            for (token in queryTokens) {
                val times = counts[token] ?: continue
                // idf: الكلمة الموجودة في كل شيء لا تميّز شيئًا.
                val idf = ln(1.0 + total / (1.0 + (seenIn[token] ?: 0)))
                score += idf * (1.0 + ln(times.toDouble()))
            }
            // القسمة على جذر الطول تمنع النصّ الطويل من الفوز بطوله وحده.
            if (score <= 0.0) null else Scored(item, score / sqrt(tokens.size.toDouble()))
        }

        return scored
            .sortedWith(compareByDescending<Scored<T>> { it.score }.thenByDescending { recencyOf(it.item) })
            .take(limit)
            .map { it.item }
    }
}
