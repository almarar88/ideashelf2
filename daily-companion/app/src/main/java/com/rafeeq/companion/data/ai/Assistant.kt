package com.rafeeq.companion.data.ai

import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.prayer.DayPrayers
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.weather.WeatherCodes
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * يبني السياق والتعليمات التي تُرسل إلى النموذج.
 * الفكرة: النموذج يعرف يومك (الوقت، الطقس، الصلاة، مهامك، أخبارك)
 * فيصبح رفيقًا حقيقيًا بدل روبوت محادثة عام.
 */
object Assistant {

    /** لقطة عن حالة اليوم تُحقن في تعليمات النظام. */
    data class Context(
        val userName: String,
        val now: LocalDateTime,
        val placeLabel: String,
        val hijriDate: String,
        val gregorianDate: String,
        val weather: WeatherBundle?,
        val prayers: DayPrayers?,
        val tasks: List<Task>,
        val habits: List<Habit>,
        val headlines: List<Article>,
        val persona: String,
        val use24h: Boolean,
    )

    private const val BASE_PERSONA = """أنت "رفيقي" — مساعد شخصي يومي يتحدث العربية الفصحى المبسّطة بطبيعية.

أسلوبك:
- ابدأ بالإجابة أو الخلاصة مباشرة. لا مقدمات ولا اعتذارات ولا تكرار للسؤال.
- عملي ومختصر. جملة مفيدة خير من فقرة مزخرفة.
- إن كان السؤال يحتاج خطوات، اكتبها كقائمة قصيرة.
- لا تجامل على حساب الدقة. إن كان في كلام المستخدم خطأ، صحّحه بلطف ووضوح.
- لا تختلق معلومة. إن لم تكن تعرف، قل ذلك واقترح كيف يمكن التحقّق.
- استعمل معطيات اليوم أدناه عندما تكون ذات صلة فقط، ولا تسردها بلا داعٍ.
- إذا سألك المستخدم بالإنجليزية أو بلهجته، أجبه بنفس لغته."""

    fun systemPrompt(context: Context): String = buildString {
        appendLine(BASE_PERSONA)
        if (context.persona.isNotBlank()) {
            appendLine()
            appendLine("تعليمات إضافية من المستخدم (لها الأولوية على أسلوبك الافتراضي):")
            appendLine(context.persona.trim())
        }
        appendLine()
        appendLine("--- معطيات اليوم ---")
        if (context.userName.isNotBlank()) appendLine("اسم المستخدم: ${context.userName}")
        appendLine("الوقت الآن: ${Dates.formatTime(context.now, context.use24h)}")
        appendLine("التاريخ: ${context.gregorianDate} — ${context.hijriDate}")
        if (context.placeLabel.isNotBlank()) appendLine("الموقع: ${context.placeLabel}")

        context.weather?.let { w ->
            val info = WeatherCodes.describe(w.now.weatherCode, w.now.isDay)
            appendLine(
                "الطقس: ${info.text}، ${w.now.temperature.toInt()}° " +
                    "(محسوسة ${w.now.feelsLike.toInt()}°)، رطوبة ${w.now.humidity}%، " +
                    "رياح ${w.now.windSpeed.toInt()} كم/س",
            )
            w.daily.firstOrNull()?.let {
                appendLine("توقّع اليوم: عظمى ${it.max.toInt()}° / صغرى ${it.min.toInt()}°، احتمال مطر ${it.precipitationProbability}%")
            }
        }

        context.prayers?.let { p ->
            val times = Prayer.entries.filter { it.isObligatory }.joinToString("، ") {
                "${it.arabic} ${Dates.formatTime(p[it], context.use24h)}"
            }
            appendLine("أوقات الصلاة: $times")
            p.next(context.now)?.let { (prayer, time) ->
                appendLine(
                    "الصلاة القادمة: ${prayer.arabic} بعد " +
                        Dates.humanDuration(java.time.Duration.between(context.now, time)),
                )
            }
        }

        val pending = context.tasks.filter { !it.done }
        if (pending.isNotEmpty()) {
            appendLine("مهام غير منجزة (${pending.size}):")
            pending.take(15).forEach { task ->
                val due = task.dueDate?.let { d -> " — موعدها $d${task.dueTime?.let { " $it" } ?: ""}" }.orEmpty()
                val priority = when (task.priority) { 2 -> " [مهمة]"; 0 -> " [منخفضة]"; else -> "" }
                appendLine("• ${task.title}$due$priority")
            }
        }

        val today = LocalDate.now().toString()
        val habitsToday = context.habits.filter { (it.log[today] ?: 0) < it.targetPerDay }
        if (habitsToday.isNotEmpty()) {
            appendLine("عادات لم تكتمل اليوم: " + habitsToday.joinToString("، ") { it.title })
        }

        if (context.headlines.isNotEmpty()) {
            appendLine("أبرز العناوين الآن:")
            context.headlines.take(8).forEach { appendLine("• ${it.title} (${it.sourceName})") }
        }
        appendLine("--- نهاية المعطيات ---")
    }

    /** الملخّص اليومي — النص الذي يظهر في بطاقة "موجزك". */
    fun dailyBriefPrompt(): String = """
اكتب لي موجز اليوم بالاعتماد على المعطيات أعلاه.

الشروط:
- ابدأ بجملة واحدة تلخّص شكل اليوم (الطقس + أهم التزام).
- ثم ٣ إلى ٥ نقاط قصيرة فقط: ما يستحق انتباهي اليوم، بترتيب الأهمية.
- اربط النصائح بالواقع: إن كان الجو حارًا اقترح توقيتًا أنسب، إن كانت مهمة متأخرة نبّهني.
- إن كان في العناوين ما يخصّني فعلًا فاذكره بجملة، وإلا فتجاهله.
- اختم بسطر واحد فيه اقتراح عملي واحد لليوم.
- لا عناوين ولا تنسيق ثقيل. نص نظيف قصير لا يتجاوز ١٢٠ كلمة.
""".trim()

    fun planDayPrompt(): String = """
رتّب لي يومي.

- ابنِ جدولًا زمنيًا واقعيًا من الآن حتى نهاية اليوم.
- احترم أوقات الصلاة المذكورة ولا تضع مهمة تتعارض معها.
- ضع المهام الصعبة في أوقات التركيز، والمهام الخفيفة بعد الوجبات.
- اترك فترات راحة، ولا تحشُ اليوم.
- اعرضه كقائمة: الوقت ثم المهمة، سطر لكل بند.
- إن كانت المهام أكثر من طاقة اليوم، قل ذلك صراحة واقترح ما يُؤجَّل.
""".trim()

    fun summarizeArticlePrompt(article: Article): String = """
لخّص هذا الخبر:

العنوان: ${article.title}
المصدر: ${article.sourceName}
المقتطف: ${article.summary.ifBlank { "غير متوفر" }}
الرابط: ${article.link}

اكتب:
1) ثلاث نقاط: ماذا حدث؟ لماذا يهم؟ ما التالي؟
2) سطر أخير: مدى موثوقية ما ورد بناءً على المقتطف — وإن كان المقتطف ناقصًا فقل إنك تحتاج النص الكامل ولا تخمّن التفاصيل.

لا تخترع أرقامًا أو تصريحات غير موجودة في النص أعلاه.
""".trim()

    fun digestPrompt(articles: List<Article>): String = buildString {
        appendLine("هذه عناوين اليوم. اصنع لي نشرة مختصرة:")
        appendLine()
        articles.take(25).forEachIndexed { i, a ->
            appendLine("${i + 1}. ${a.title} — ${a.sourceName}")
        }
        appendLine()
        appendLine("المطلوب:")
        appendLine("- اجمع العناوين المتشابهة في موضوع واحد بدل تكرارها.")
        appendLine("- أعطني ٤ إلى ٦ مواضيع فقط، كل موضوع بسطرين: ما الخبر، ولماذا يهم.")
        appendLine("- رتّبها بحسب الأهمية الفعلية لا بحسب ترتيب القائمة.")
        appendLine("- تجاهل العناوين الترويجية أو المكرّرة.")
    }

    /** استخراج مهام من نص حر يكتبه المستخدم. */
    fun extractTasksPrompt(text: String, today: LocalDate): String = """
حوّل النص التالي إلى مهام.

النص: "$text"
تاريخ اليوم: $today

أعد النتيجة على شكل أسطر فقط، كل سطر مهمة واحدة بهذه الصيغة بالضبط:
TASK | العنوان | yyyy-MM-dd أو - | HH:mm أو - | 0 أو 1 أو 2

حيث الرقم الأخير أولوية المهمة (0 منخفضة، 1 عادية، 2 مهمة).
إن لم يُذكر تاريخ أو وقت ضع علامة "-".
افهم التعبيرات النسبية مثل "بكرة" و"بعد أسبوع" وحوّلها إلى تاريخ فعلي.
لا تكتب أي شيء آخر قبل أو بعد الأسطر.
""".trim()

    /** يحلّل ناتج استخراج المهام إلى كائنات فعلية. */
    fun parseExtractedTasks(output: String): List<Task> =
        output.lineSequence()
            .map { it.trim() }
            .filter { it.startsWith("TASK") }
            .mapNotNull { line ->
                val parts = line.split("|").map { it.trim() }
                if (parts.size < 5) return@mapNotNull null
                val title = parts[1].takeIf { it.isNotBlank() } ?: return@mapNotNull null
                Task(
                    title = title,
                    dueDate = parts[2].takeIf { it != "-" && it.isNotBlank() },
                    dueTime = parts[3].takeIf { it != "-" && it.isNotBlank() },
                    priority = parts[4].toIntOrNull()?.coerceIn(0, 2) ?: 1,
                )
            }
            .toList()

    /** أوامر سريعة تظهر كأزرار في شاشة المساعد. */
    data class QuickAction(val label: String, val emoji: String, val prompt: String)

    val quickActions = listOf(
        QuickAction("رتّب يومي", "🗓️", planDayPrompt()),
        QuickAction("لخّص أخباري", "📰", "اعطني خلاصة أهم ما ورد في العناوين أعلاه في ٥ نقاط، وتجاهل المكرّر."),
        QuickAction("ماذا ألبس؟", "🧥", "بناءً على طقس اليوم، بماذا تنصحني أن ألبس وما الذي آخذه معي؟ جملتان فقط."),
        QuickAction("اكتب رسالة", "✍️", "أريد كتابة رسالة. اسألني سؤالًا واحدًا فقط: لمن الرسالة وما الهدف منها؟ ثم اكتبها مباشرة."),
        QuickAction("لخّص لي نصًا", "📄", "سألصق لك نصًا في الرسالة القادمة. لخّصه في نقاط، واذكر أي ادعاء يحتاج تحققًا."),
        QuickAction("فكرة للعشاء", "🍽️", "اقترح ٣ أفكار لوجبة اليوم تناسب الطقس والوقت الحالي، مع مكوّنات متوفرة عادة."),
        QuickAction("راجع قراري", "⚖️", "سأصف قرارًا أفكر فيه. حلّله: ما الافتراضات الخفية، وما أسوأ سيناريو، وما توصيتك ولماذا."),
        QuickAction("علّمني شيئًا", "💡", "علّمني فكرة مفيدة واحدة اليوم في ٤ أسطر، واختر شيئًا عمليًا لا معلومة عامة."),
    )
}
