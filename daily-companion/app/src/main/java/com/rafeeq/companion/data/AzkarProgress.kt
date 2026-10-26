package com.rafeeq.companion.data

import kotlinx.serialization.Serializable
import java.time.LocalDate

/**
 * تقدّم الأذكار داخل اليوم الواحد.
 *
 * كان العدّ في الذاكرة فقط، بحجّة أن الأذكار تُقرأ في جلسة واحدة وأن حفظها
 * يجعل المستخدم يجدها نصف مكتملة بلا سبب. الحجّة صحيحة في شقّها الثاني
 * وخاطئة في الأول: أذكار الصباح تُقرأ في دقائق، ومكالمةٌ أو تدوير الشاشة أو
 * الانتقال إلى تبويب المسبحة يمسح العدّ كلّه ويُعيدك إلى الأول.
 *
 * فالحفظ ليوم واحد: يصمد أمام المقاطعة، ويُمحى وحده عند تغيّر التاريخ — فلا
 * تُفتح أذكار الصباح غدًا وهي نصف مقروءة.
 */
@Serializable
data class AzkarProgress(
    /** yyyy-MM-dd لليوم الذي تخصّه هذه الأعداد. */
    val day: String = "",
    /** مفتاح الذكر -> كم مرّة قُرئ. */
    val counts: Map<String, Int> = emptyMap(),
    val tasbih: Int = 0,
    val rounds: Int = 0,
) {
    companion object {
        /** مفتاح ثابت لا يتبدّل بإعادة الترتيب، ويُصفَّر وحده لو تغيّر النصّ. */
        fun keyOf(tab: String, text: String): String = "$tab:${text.hashCode()}"

        /**
         * التقدّم الصالح لليوم المطلوب.
         *
         * أي تقدّم من يومٍ سابق يُطرح كاملًا: إعادة الاستعمال عبر الأيام هي
         * بالضبط ما يجعل الأذكار تبدو نصف مكتملة بلا سبب.
         */
        fun forToday(stored: AzkarProgress?, today: LocalDate): AzkarProgress {
            val key = today.toString()
            return if (stored != null && stored.day == key) stored else AzkarProgress(day = key)
        }
    }
}
