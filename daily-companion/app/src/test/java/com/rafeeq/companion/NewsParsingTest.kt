package com.rafeeq.companion

import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.news.NewsCategories
import com.rafeeq.companion.data.NewsSource
import com.rafeeq.companion.data.news.DefaultSources
import com.rafeeq.companion.data.news.NewsRepository
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class NewsParsingTest {

    private val repo = NewsRepository()
    private val source = NewsSource(name = "اختبار", url = "https://x/rss", category = NewsCategories.TECH)

    private val rss = """
        <?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
          <channel>
            <title>موجز تجريبي</title>
            <item>
              <title>عنوان الخبر الأول</title>
              <link>https://example.com/a</link>
              <description><![CDATA[<p>وصف يحتوي <b>وسوم</b> وكيانات &amp; مثل &quot;هذه&quot;.</p>]]></description>
              <pubDate>Mon, 07 Sep 2026 09:30:00 +0300</pubDate>
              <media:content url="https://example.com/a.jpg" />
            </item>
            <item>
              <title>الخبر الثاني بلا صورة صريحة</title>
              <link>https://example.com/b</link>
              <description><![CDATA[نص ثم <img src="https://cdn.example.com/b.png" /> صورة داخل المحتوى]]></description>
              <pubDate>Mon, 07 Sep 2026 08:00:00 +0300</pubDate>
            </item>
            <item>
              <title>عنصر بلا رابط صالح</title>
              <link>ليس رابطًا</link>
            </item>
          </channel>
        </rss>
    """.trimIndent()

    private val atom = """
        <?xml version="1.0" encoding="utf-8"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <title>Atom Feed</title>
          <entry>
            <title>Atom entry title</title>
            <link rel="alternate" href="https://example.org/one" />
            <published>2026-09-06T14:00:00Z</published>
            <summary>Some &lt;b&gt;summary&lt;/b&gt; text</summary>
          </entry>
        </feed>
    """.trimIndent()

    @Test
    fun `parses rss items with images titles and dates`() {
        val items = repo.parseFeed(rss, source)
        assertEquals("يجب تجاهل العنصر بلا رابط صالح", 2, items.size)

        val first = items[0]
        assertEquals("عنوان الخبر الأول", first.title)
        assertEquals("https://example.com/a", first.link)
        assertEquals("https://example.com/a.jpg", first.imageUrl)
        assertEquals(NewsCategories.TECH, first.category)
        assertTrue("يجب إزالة وسوم HTML", !first.summary.contains("<b>"))
        assertTrue("يجب فك كيانات HTML", first.summary.contains("\"هذه\""))
        assertTrue(first.publishedAt > 0)
    }

    @Test
    fun `falls back to first image inside html content`() {
        val items = repo.parseFeed(rss, source)
        assertEquals("https://cdn.example.com/b.png", items[1].imageUrl)
    }

    @Test
    fun `parses atom entries using href links`() {
        val items = repo.parseFeed(atom, source)
        assertEquals(1, items.size)
        assertEquals("https://example.org/one", items[0].link)
        assertEquals("Atom entry title", items[0].title)
        assertTrue(items[0].summary.contains("summary"))
    }

    @Test
    fun `malformed xml does not crash the caller`() {
        val result = runCatching { repo.parseFeed("<rss><channel><item>", source) }
        assertTrue("التحليل الفاشل يجب أن يُرمى كاستثناء يلتقطه المستدعي، لا أن يُعطّل التطبيق",
            result.isFailure || result.getOrNull()?.isEmpty() == true)
    }

    @Test
    fun `date parsing handles common feed formats`() {
        val rfc = repo.parseDate("Mon, 07 Sep 2026 09:30:00 +0300")
        val iso = repo.parseDate("2026-09-07T09:30:00Z")
        assertTrue(rfc > 0 && iso > 0)
        // نفس اللحظة تقريبًا بفارق المنطقة الزمنية (٣ ساعات).
        assertEquals(3 * 3600 * 1000L, iso - rfc)
    }

    @Test
    fun `google news url is built and encoded correctly`() {
        val url = DefaultSources.googleNews("الذكاء الاصطناعي")
        assertTrue(url.startsWith("https://news.google.com/rss/search?q="))
        assertTrue("يجب ترميز النص العربي", url.contains("%D8%"))
        assertTrue(url.contains("hl=ar"))
    }

    @Test
    fun `default sources are unique and well formed`() {
        val all = DefaultSources.all
        assertEquals("لا يجوز تكرار المعرّفات", all.size, all.map { it.id }.distinct().size)
        all.forEach {
            assertTrue("رابط غير صالح: ${it.url}", it.url.startsWith("https://"))
            assertTrue("تصنيف غير معروف: ${it.category}", it.category in NewsCategories.ordered)
        }
    }

    // ------------------------------------------------------- استخراج المهام

    @Test
    fun `parses task lines produced by the assistant`() {
        val output = """
            TASK | اجتماع الفريق | 2026-09-08 | 10:00 | 2
            TASK | دفع فاتورة الكهرباء | 2026-09-12 | - | 1
            TASK | شراء حليب | - | - | 0
            نص زائد يجب تجاهله
        """.trimIndent()

        val tasks = Assistant.parseExtractedTasks(output)
        assertEquals(3, tasks.size)
        assertEquals("اجتماع الفريق", tasks[0].title)
        assertEquals("2026-09-08", tasks[0].dueDate)
        assertEquals("10:00", tasks[0].dueTime)
        assertEquals(2, tasks[0].priority)
        assertNull(tasks[1].dueTime)
        assertNull(tasks[2].dueDate)
        assertEquals(0, tasks[2].priority)
    }

    @Test
    fun `ignores malformed task lines`() {
        val tasks = Assistant.parseExtractedTasks("TASK | ناقص\nTASK|||\nlorem")
        assertTrue(tasks.isEmpty())
    }

    @Test
    fun `extract prompt carries today's date so relative dates resolve`() {
        val prompt = Assistant.extractTasksPrompt("اجتماع بكرة", LocalDate.of(2026, 9, 7))
        assertTrue(prompt.contains("2026-09-07"))
        assertTrue(prompt.contains("اجتماع بكرة"))
    }

    @Test
    fun `quick actions are non empty and unique`() {
        val actions = Assistant.quickActions
        assertTrue(actions.size >= 6)
        assertEquals(actions.size, actions.map { it.label }.distinct().size)
        actions.forEach { assertNotNull(it.prompt.ifBlank { null }) }
    }
}
