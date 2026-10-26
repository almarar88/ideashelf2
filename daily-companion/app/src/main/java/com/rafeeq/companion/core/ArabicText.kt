package com.rafeeq.companion.core

/**
 * تطبيع النصّ العربي للمطابقة.
 *
 * المطابقة الحرفية لا تنفع في العربية: «الصلاة» و«صلاة» و«الصلوات» كلمة
 * واحدة في ذهن من كتبها، وثلاث كلمات مختلفة للحاسوب. والمستخدم يكتب بلا
 * تشكيل حينًا وبه حينًا، ويخلط «أ» و«ا»، ويكتب الأرقام عربيةً أو لاتينية.
 *
 * فهنا تطبيعٌ ثمّ تجذيرٌ خفيف. خفيفٌ عمدًا: التجذير العميق يخلط كلماتٍ لا
 * علاقة بينها، وخطأ الخلط هنا أسوأ من خطأ التفويت — نتيجةٌ غريبة تُفقد
 * الثقة، ونتيجةٌ ناقصة تمرّ.
 */
object ArabicText {

    /** التشكيل والتطويل: لا يحملان معنى في المطابقة. */
    private val DIACRITICS = Regex("[\\u064B-\\u065F\\u0670\\u0640]")

    private val STOPWORDS = setOf(
        "من", "في", "على", "الى", "عن", "مع", "هذا", "هذه", "ذلك", "تلك",
        "التي", "الذي", "ما", "لا", "ان", "كان", "يكون", "هل", "كيف", "متى",
        "اين", "لماذا", "لي", "لك", "له", "لها", "او", "ثم", "قد", "كل",
        "بعض", "عند", "بين", "بعد", "قبل", "حتى", "اذا", "كما", "هو", "هي",
        "انا", "انت", "نحن", "هم", "يا", "ايضا", "فقط", "جدا", "شي", "شيء",
        "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is",
        "it", "this", "that", "with", "my", "me", "you", "i",
    )

    /** يوحّد الهمزات والتاء المربوطة والألف المقصورة والأرقام ويزيل التشكيل. */
    fun normalize(input: String): String {
        val builder = StringBuilder(input.length)
        for (ch in DIACRITICS.replace(input, "")) {
            builder.append(
                when (ch) {
                    'أ', 'إ', 'آ', 'ٱ', 'ٲ', 'ٳ' -> 'ا'
                    'ة' -> 'ه'
                    'ى' -> 'ي'
                    'ؤ' -> 'و'
                    'ئ' -> 'ي'
                    'ﻻ' -> 'ل'
                    in '٠'..'٩' -> '0' + (ch - '٠')   // ٠-٩
                    in '۰'..'۹' -> '0' + (ch - '۰')   // ۰-۹ الفارسية
                    else -> ch.lowercaseChar()
                },
            )
        }
        return builder.toString()
    }

    /**
     * تجذير خفيف: يزيل «ال» التعريف وحروف الجرّ الملتصقة واللواحق الشائعة.
     *
     * لا يُقصَّر إلى أقلّ من ثلاثة أحرف أبدًا: ما دون ذلك يصير جذرًا يطابق
     * كل شيء — «كتب» و«كتاب» و«مكتبة» شيء، أمّا «كت» فتطابق نصف المعجم.
     */
    fun stem(word: String): String {
        var w = word
        for (prefix in listOf("وال", "بال", "كال", "فال", "لل", "ال")) {
            if (w.length > prefix.length + 2 && w.startsWith(prefix)) {
                w = w.removePrefix(prefix); break
            }
        }
        for (suffix in listOf("ات", "ون", "ين", "ان", "ها", "هم", "هن", "كم", "نا", "ية", "ه", "ي")) {
            if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
                w = w.removeSuffix(suffix); break
            }
        }
        return w
    }

    /** كلمات دلالية مطبَّعة ومجذَّرة، بلا أدوات الربط ولا الرموز. */
    fun tokens(text: String): List<String> =
        normalize(text)
            .split(Regex("[^\\p{L}\\p{N}]+"))
            .asSequence()
            .filter { it.length > 1 }
            .filterNot { it in STOPWORDS }
            .map { stem(it) }
            .filter { it.isNotBlank() }
            .toList()
}
