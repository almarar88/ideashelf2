package com.rafeeq.companion

import com.rafeeq.companion.core.Readable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * استخراج نصّ الصفحة.
 *
 * ما يُعاد هنا يُرسَل إلى النموذج ويُدفع ثمنه بالرموز، فالقمامة فيه تكلّف
 * مرّتين: مالًا وجودةَ إجابة. وأخطر ما فيه السكربت — صفحة أخبار عادية فيها
 * عشرات الكيلوبايتات منه، وإرسالها يملأ السياق بما لا معنى له.
 */
class ReadableTest {

    @Test
    fun `السكربت والتنسيق لا يصلان إلى النموذج`() {
        val html = """
            <html><head><title>خبر</title>
            <style>.a{color:red}</style>
            <script>var x = "نصّ داخل سكربت"; alert(1);</script>
            </head><body><p>المتن الحقيقي.</p></body></html>
        """.trimIndent()
        val page = Readable.extract(html)
        assertFalse("السكربت مُسقَط", page.text.contains("alert"))
        assertFalse("حتى النصّ داخله", page.text.contains("نصّ داخل سكربت"))
        assertFalse("والتنسيق", page.text.contains("color:red"))
        assertTrue("والمتن باقٍ", page.text.contains("المتن الحقيقي"))
    }

    @Test
    fun `العنوان يُستخرج منفصلًا`() {
        val page = Readable.extract("<html><head><title>  عنوان الصفحة </title></head><body><p>متن</p></body></html>")
        assertEquals("عنوان الصفحة", page.title)
    }

    /** بلا هذا تلتصق الفقرات: «الأولىالثانية» كلمة واحدة لا يفهمها النموذج. */
    @Test
    fun `الوسوم الكتلية تفصل الفقرات بأسطر`() {
        val page = Readable.extract("<body><p>الفقرة الأولى</p><p>الفقرة الثانية</p></body>")
        assertFalse("لا التصاق", page.text.contains("الأولىالفقرة"))
        assertTrue(page.text.contains("الفقرة الأولى"))
        assertTrue(page.text.contains("الفقرة الثانية"))
    }

    @Test
    fun `الكيانات تُفكّ بما فيها الرقمية والعربية`() {
        val page = Readable.extract("<body><p>&quot;قال&quot; &amp; &#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577; &#x627;</p></body>")
        assertTrue(page.text.contains("\"قال\""))
        assertTrue(page.text.contains("&") && !page.text.contains("&amp;"))
        assertTrue("الكيان العشري", page.text.contains("العربية"))
        assertTrue("والسّت عشري", page.text.contains("ا"))
    }

    @Test
    fun `النصّ يُقتطع عند الحدّ فلا يبتلع السياق`() {
        val long = "<body><p>" + "كلمة ".repeat(5000) + "</p></body>"
        val page = Readable.extract(long, limit = 500)
        assertTrue("لا يتجاوز الحدّ كثيرًا", page.text.length <= 520)
        assertTrue("ويُعلَّم أنه مقتطع", page.text.endsWith("…"))
    }

    @Test
    fun `صفحة بلا نصّ تعيد فراغًا لا قمامة`() {
        val page = Readable.extract("<html><head><title>ت</title></head><body><script>x()</script></body></html>")
        assertEquals("", page.text)
    }

    @Test
    fun `الصفحة الفارغة أو المشوّهة لا ترمي`() {
        assertEquals("", Readable.extract("").text)
        assertEquals("", Readable.extract("<<<>>").text.trim())
        Readable.extract("<p>غير مغلق")   // لا يرمي
    }

    @Test
    fun `شريط التنقّل والتذييل يُسقطان`() {
        val html = "<body><nav>الرئيسية الأقسام</nav><p>الخبر المهم</p><footer>حقوق النشر</footer></body>"
        val page = Readable.extract(html)
        assertTrue(page.text.contains("الخبر المهم"))
        assertFalse(page.text.contains("حقوق النشر"))
    }
}
