package com.rafeeq.companion.data.ai

import com.rafeeq.companion.data.ai.ClaudeClient.ModelOption

/**
 * مزوّدو النماذج.
 *
 * مسلكان لا ثمانية:
 *   • Anthropic بواجهتها الأصلية — تحتفظ بالتخزين المؤقت للبادئة وبالبحث
 *     الذي يجري على خوادمها، وبالصور داخل نتائج الأدوات (وهي ما يجعل
 *     «شوف الشاشة» ممكنًا). كلّها تضيع في أي طبقة توافق.
 *   • واجهة متوافقة مع OpenAI — وهي ما تعرضه اليوم xAI وGoogle وGroq
 *     وOpenRouter والنماذج المحلّية.
 *
 * نفس السجلّ الموجود في نسخة ويندوز، والعناوين مأخوذة من توثيق كل مزوّد
 * لا من الذاكرة: واجهتا xAI وGoogle تغيّرتا فعلًا عمّا هو شائع.
 *
 * المعرّفات هنا **اقتراحات أولى فقط**. معرّفات النماذج تتبدّل كل أسابيع،
 * ومعرّفٌ قديم مكتوب في الكود يعني رسالة «النموذج غير موجود» لمستخدمٍ لم
 * يخطئ في شيء — وقد وقع هذا فعلًا. الحقيقة تأتي من زرّ «اجلب النماذج»،
 * الذي يسأل حساب المستخدم نفسه عبر GET /models.
 */
data class Provider(
    val id: String,
    val label: String,
    val kind: Kind,
    val baseUrl: String,
    val keyUrl: String,
    val models: List<ModelOption>,
    /** ما يفقده هذا المزوّد، يُعرض للمستخدم صراحةً. */
    val note: String,
    val editableUrl: Boolean = false,
) {
    enum class Kind { ANTHROPIC, OPENAI }
}

object Providers {

    val all = listOf(
        Provider(
            id = "anthropic",
            label = "Anthropic — Claude",
            kind = Provider.Kind.ANTHROPIC,
            baseUrl = "https://api.anthropic.com/v1",
            keyUrl = "https://console.anthropic.com/settings/keys",
            models = ClaudeClient.models,
            note = "الوحيد الذي يبحث في الإنترنت من خوادمه، ويرى لقطات الشاشة، " +
                "ويخزّن البادئة مؤقتًا فيقلّ ثمن المحادثات الطويلة.",
        ),
        Provider(
            id = "xai",
            label = "xAI — Grok",
            kind = Provider.Kind.OPENAI,
            baseUrl = "https://api.x.ai/v1",
            keyUrl = "https://console.x.ai",
            models = listOf(
                ModelOption("grok-4.7", "Grok 4.7", "الأحدث"),
                ModelOption("grok-4.6", "Grok 4.6", ""),
                ModelOption("grok-4.5", "Grok 4.5", ""),
            ),
            note = "الأدوات تعمل. البحث في الإنترنت ورؤية الشاشة لا تعملان — " +
                "هما ميزتا خوادم Anthropic.",
        ),
        Provider(
            id = "google",
            label = "Google — Gemini",
            kind = Provider.Kind.OPENAI,
            // طبقة التوافق الرسمية من Google، لا الواجهة الأصلية.
            baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai",
            keyUrl = "https://aistudio.google.com/apikey",
            models = listOf(
                ModelOption("gemini-3-flash-preview", "Gemini 3 Flash", "سريع"),
                ModelOption("gemini-2.5-flash", "Gemini 2.5 Flash", ""),
                ModelOption("gemini-2.5-pro", "Gemini 2.5 Pro", ""),
            ),
            note = "عبر طبقة التوافق الرسمية من Google، وهي ما تزال تجريبية لديهم.",
        ),
        Provider(
            id = "openai",
            label = "OpenAI — GPT",
            kind = Provider.Kind.OPENAI,
            baseUrl = "https://api.openai.com/v1",
            keyUrl = "https://platform.openai.com/api-keys",
            models = listOf(
                ModelOption("gpt-5", "GPT-5", ""),
                ModelOption("gpt-5-mini", "GPT-5 mini", "أرخص"),
            ),
            note = "الأدوات تعمل. اكتب معرّف أي نموذج متاح في حسابك.",
        ),
        Provider(
            id = "groq",
            label = "Groq — سريع جدًا",
            kind = Provider.Kind.OPENAI,
            baseUrl = "https://api.groq.com/openai/v1",
            keyUrl = "https://console.groq.com/keys",
            models = listOf(ModelOption("llama-3.3-70b-versatile", "Llama 3.3 70B", "")),
            note = "استجابة شديدة السرعة. جودة الأدوات أقلّ من النماذج الكبيرة.",
        ),
        Provider(
            id = "openrouter",
            label = "OpenRouter — كل النماذج",
            kind = Provider.Kind.OPENAI,
            baseUrl = "https://openrouter.ai/api/v1",
            keyUrl = "https://openrouter.ai/keys",
            models = listOf(
                ModelOption("anthropic/claude-sonnet-4.5", "اكتب أي معرّف", ""),
            ),
            note = "بوّابة واحدة إلى عشرات النماذج بمفتاح واحد.",
        ),
        Provider(
            id = "custom",
            label = "عنوان مخصّص",
            kind = Provider.Kind.OPENAI,
            baseUrl = "",
            keyUrl = "",
            models = listOf(ModelOption("", "اكتب معرّف النموذج", "")),
            note = "أي خدمة تتحدّث لغة OpenAI — بما فيها نموذج يعمل على شبكتك.",
            editableUrl = true,
        ),
    )

    fun byId(id: String): Provider = all.firstOrNull { it.id == id } ?: all.first()
}
