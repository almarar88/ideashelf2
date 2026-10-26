package com.rafeeq.companion

import com.rafeeq.companion.core.ArabicText
import com.rafeeq.companion.data.Memory
import com.rafeeq.companion.data.ai.Retrieval
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * انتقاء ما يراه المساعد.
 *
 * هذا أكثر ما يؤثّر في جودة الإجابات ولا يكلّف شيئًا: السياق محدود، وما
 * يُحقن فيه يقرّر ما إذا كان المساعد «يتذكّر» أم «نسي». وكل المنطق هنا
 * حسابٌ محلّي، فلا عذر في ألّا يُختبر.
 */
class RetrievalTest {

    // ----------------------------------------------------- التطبيع

    @Test
    fun `التشكيل لا يمنع المطابقة`() {
        assertEquals(ArabicText.normalize("الصَّلاة"), ArabicText.normalize("الصلاة"))
        assertEquals(ArabicText.normalize("مُحَمَّد"), ArabicText.normalize("محمد"))
    }

    @Test
    fun `الهمزات والتاء المربوطة والألف المقصورة تتوحّد`() {
        assertEquals("احمد", ArabicText.normalize("أحمد"))
        assertEquals("احمد", ArabicText.normalize("إحمد"))
        assertEquals("مكه", ArabicText.normalize("مكة"))
        assertEquals("مستشفي", ArabicText.normalize("مستشفى"))
    }

    @Test
    fun `الأرقام العربية تصير لاتينية فالبحث عنها يطابق`() {
        assertEquals("2026", ArabicText.normalize("٢٠٢٦"))
    }

    @Test
    fun `التطويل يُحذف`() {
        assertEquals("جميل", ArabicText.normalize("جـمـيـ__ل".replace("__", "ـ")))
    }

    @Test
    fun `ال التعريف وحروف الجرّ لا تمنع المطابقة`() {
        assertEquals(ArabicText.stem("الكتاب"), ArabicText.stem("كتاب"))
        assertEquals(ArabicText.stem("بالكتاب"), ArabicText.stem("كتاب"))
    }

    /** التجذير خفيف عمدًا: خلط كلمتين لا علاقة بينهما أسوأ من تفويت واحدة. */
    @Test
    fun `التجذير لا يقصّر الكلمة إلى جذر يطابق كل شيء`() {
        assertTrue("لا تُقصَّر القصيرة", ArabicText.stem("كتب").length >= 3)
        assertTrue("لا تُقصَّر «ال» وحدها", ArabicText.stem("الم").length >= 3)
    }

    @Test
    fun `أدوات الربط تُستبعد من الكلمات الدلالية`() {
        val tokens = ArabicText.tokens("ما هو الطقس في دبي اليوم")
        assertFalse("«ما» أداة", tokens.contains("ما"))
        assertFalse("«في» أداة", tokens.contains("في"))
        assertTrue("«طقس» كلمة دلالية", tokens.any { it.contains("طقس") })
        assertTrue("«دبي» كلمة دلالية", tokens.contains("دبي"))
    }

    // ----------------------------------------------------- الترتيب

    private fun memory(text: String, at: Long = 0) = Memory(text = text, createdAt = at)

    /**
     * المشكلة الأصلية: آخر اثنتي عشرة ذكرى مهما كان السؤال.
     *
     * هنا الذكرى المهمّة أقدم الكلّ، ويجب أن تسبق أحدثها لأنها هي المعنيّة.
     */
    @Test
    fun `الذكرى ذات الصلة تسبق الأحدث`() {
        val items = listOf(
            memory("عندي حساسية من الفول السوداني", at = 1),
            memory("أعمل في شركة برمجيات", at = 50),
            memory("أحب القهوة بلا سكر", at = 60),
            memory("اجتماع الفريق كل اثنين", at = 70),
        )
        val top = Retrieval.rank("هل أقدر آكل حلوى فيها فول سوداني؟", items, 1, { it.text })
        assertEquals("عندي حساسية من الفول السوداني", top.first().text)
    }

    @Test
    fun `المطابقة تعمل رغم اختلاف ال التعريف والتشكيل`() {
        val items = listOf(
            memory("أصلّي الفجر في المسجد"),
            memory("أفضّل الرياضة مساءً"),
        )
        val top = Retrieval.rank("متى صلاة فجر؟", items, 1, { it.text })
        assertEquals("أصلّي الفجر في المسجد", top.first().text)
    }

    /** الكلمة الموجودة في كل الذكريات لا تميّز أيًّا منها. */
    @Test
    fun `الكلمة الشائعة تزن أقلّ من النادرة`() {
        val items = listOf(
            memory("مشروع التقرير السنوي متأخّر"),
            memory("مشروع المطبخ انتهى"),
            memory("مشروع الموقع قيد العمل"),
            memory("كلمة السرّ في الخزنة"),
        )
        val top = Retrieval.rank("مشروع الخزنة", items, 1, { it.text })
        assertEquals("«خزنة» نادرة فتفوز على «مشروع» الشائعة",
            "كلمة السرّ في الخزنة", top.first().text)
    }

    @Test
    fun `النصّ الطويل لا يفوز بطوله وحده`() {
        val items = listOf(
            memory("القطة اسمها لولو"),
            memory("كلام كثير " + "عن أمور متنوعة ".repeat(30) + " وفيه ذكر القطة مرّة"),
        )
        val top = Retrieval.rank("ما اسم القطة؟", items, 1, { it.text })
        assertEquals("القطة اسمها لولو", top.first().text)
    }

    @Test
    fun `بلا سؤال ذي معنى نعود إلى الأحدث`() {
        val items = listOf(memory("قديمة", at = 1), memory("حديثة", at = 99))
        val top = Retrieval.rank("؟؟؟", items, 1, { it.text }, recencyOf = { it.createdAt })
        assertEquals("حديثة", top.first().text)
    }

    @Test
    fun `ما لا صلة له يُستبعد ولا يُحشى بصفر`() {
        val items = listOf(memory("القطة اسمها لولو"), memory("الاجتماع الساعة ثلاثة"))
        val top = Retrieval.rank("ما اسم القطة؟", items, 5, { it.text })
        assertEquals("لا يُحشى السياق بما لا يطابق", 1, top.size)
    }

    @Test
    fun `القائمة الفارغة والحدّ صفر لا يرميان`() {
        assertTrue(Retrieval.rank("أي سؤال", emptyList<Memory>(), 5, { it.text }).isEmpty())
        assertTrue(Retrieval.rank("أي سؤال", listOf(memory("شيء")), 0, { it.text }).isEmpty())
    }

    @Test
    fun `الحدّ الأعلى محترم`() {
        val items = (1..40).map { memory("مهمة رقم $it عن المشروع") }
        assertEquals(12, Retrieval.rank("المشروع", items, 12, { it.text }).size)
    }
}
