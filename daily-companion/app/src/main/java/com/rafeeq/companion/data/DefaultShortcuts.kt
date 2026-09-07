package com.rafeeq.companion.data

/** اختصارات جاهزة تظهر فور التثبيت، ويستطيع المستخدم حذفها أو إضافة غيرها. */
object DefaultShortcuts {
    val all: List<Shortcut> = listOf(
        Shortcut(id = "plan", label = "رتّب يومي", emoji = "🗓️",
            prompt = "رتّب لي يومي بالاعتماد على مهامي وأوقات الصلاة."),
        Shortcut(id = "digest", label = "لخّص أخباري", emoji = "📰",
            prompt = "لخّص لي أهم أخبار اليوم في خمس نقاط."),
        Shortcut(id = "status", label = "حالة هاتفي", emoji = "🔋",
            prompt = "كيف حالة هاتفي الآن؟"),
        Shortcut(id = "wear", label = "ماذا ألبس؟", emoji = "🧥",
            prompt = "بناءً على طقس اليوم، بماذا تنصحني أن ألبس؟"),
        Shortcut(id = "night", label = "وضع النوم", emoji = "🌙",
            prompt = "حوّل الهاتف للاهتزاز، خفّض السطوع إلى ٢٠٪، وأطفئ الكشّاف."),
        Shortcut(id = "focus", label = "وضع التركيز", emoji = "🎯",
            prompt = "اكتم الهاتف، واذكر لي أهم ثلاث مهام أبدأ بها الآن."),
    )
}
