package com.rafeeq.companion.data.news

import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.data.NewsSource
import com.rafeeq.companion.data.Topic
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import org.xml.sax.Attributes
import org.xml.sax.InputSource
import org.xml.sax.helpers.DefaultHandler
import java.io.StringReader
import javax.xml.parsers.SAXParserFactory
import java.net.URLEncoder
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** التصنيفات التي تظهر كشرائح في شاشة الأخبار. */
object NewsCategories {
    const val TOP = "الأبرز"
    const val WORLD = "عالمي"
    const val LOCAL = "المنطقة"
    const val BUSINESS = "اقتصاد"
    const val TECH = "تقنية"
    const val SCIENCE = "علوم"
    const val SPORTS = "رياضة"
    const val HEALTH = "صحة"
    const val CULTURE = "ثقافة"
    const val MY_TOPICS = "مواضيعي"

    val ordered = listOf(TOP, MY_TOPICS, WORLD, LOCAL, BUSINESS, TECH, SCIENCE, SPORTS, HEALTH, CULTURE)
}

/** مصادر جاهزة تعمل مباشرة بعد التثبيت. يمكن للمستخدم تعطيلها أو إضافة غيرها. */
object DefaultSources {
    val all: List<NewsSource> = listOf(
        NewsSource(id = "aljazeera", name = "الجزيرة نت", url = "https://www.aljazeera.net/xml/rss/all.xml", category = NewsCategories.TOP),
        NewsSource(id = "bbc-ar", name = "BBC عربي", url = "https://feeds.bbci.co.uk/arabic/rss.xml", category = NewsCategories.TOP),
        NewsSource(id = "skynews-ar", name = "سكاي نيوز عربية", url = "https://www.skynewsarabia.com/web/rss/95.xml", category = NewsCategories.TOP),
        NewsSource(id = "alarabiya", name = "العربية", url = "https://www.alarabiya.net/.mrss/ar.xml", category = NewsCategories.TOP),
        NewsSource(id = "rt-ar", name = "RT عربي", url = "https://arabic.rt.com/rss/", category = NewsCategories.WORLD),
        NewsSource(id = "cnn-ar", name = "CNN بالعربية", url = "https://arabic.cnn.com/api/v1/rss/rss.xml", category = NewsCategories.WORLD),
        NewsSource(id = "dw-ar", name = "DW عربية", url = "https://rss.dw.com/rdf/rss-ar-all", category = NewsCategories.WORLD),
        NewsSource(id = "aawsat", name = "الشرق الأوسط", url = "https://aawsat.com/feed", category = NewsCategories.LOCAL),
        NewsSource(id = "alarabiya-biz", name = "العربية Business", url = "https://www.alarabiya.net/.mrss/ar/aswaq.xml", category = NewsCategories.BUSINESS),
        NewsSource(id = "cnbc-ar", name = "CNBC عربية", url = "https://www.cnbcarabia.com/rss", category = NewsCategories.BUSINESS),
        NewsSource(id = "aitnews", name = "البوابة العربية للتقنية", url = "https://aitnews.com/feed/", category = NewsCategories.TECH),
        NewsSource(id = "tech-wd", name = "عالم التقنية", url = "https://www.tech-wd.com/wd/feed/", category = NewsCategories.TECH),
        NewsSource(id = "theverge", name = "The Verge", url = "https://www.theverge.com/rss/index.xml", category = NewsCategories.TECH),
        NewsSource(id = "arstechnica", name = "Ars Technica", url = "https://feeds.arstechnica.com/arstechnica/index", category = NewsCategories.TECH),
        NewsSource(id = "scientificam", name = "Scientific American", url = "https://rss.sciam.com/ScientificAmerican-Global", category = NewsCategories.SCIENCE),
        NewsSource(id = "nasa", name = "NASA", url = "https://www.nasa.gov/news-release/feed/", category = NewsCategories.SCIENCE),
        NewsSource(id = "kooora-gnews", name = "رياضة عربية", url = googleNews("أخبار الرياضة"), category = NewsCategories.SPORTS),
        NewsSource(id = "sport360", name = "سبورت ٣٦٠", url = "https://arabic.sport360.com/feed", category = NewsCategories.SPORTS),
        NewsSource(id = "health-gnews", name = "صحة وطب", url = googleNews("صحة وطب"), category = NewsCategories.HEALTH),
        NewsSource(id = "culture-gnews", name = "ثقافة وفنون", url = googleNews("ثقافة وفنون وكتب"), category = NewsCategories.CULTURE),
    )

    /** موجز أخبار من Google News لأي كلمة مفتاحية — يتيح للمستخدم متابعة أي موضوع. */
    fun googleNews(query: String, lang: String = "ar", country: String = "SA"): String {
        val q = URLEncoder.encode(query, "UTF-8")
        return "https://news.google.com/rss/search?q=$q&hl=$lang&gl=$country&ceid=$country:$lang"
    }
}

class NewsRepository {

    /** يجلب كل المصادر المفعّلة بالتوازي ويُرجع قائمة موحّدة مرتّبة زمنيًا. */
    suspend fun fetchAll(sources: List<NewsSource>, topics: List<Topic>): NewsResult = coroutineScope {
        val topicSources = topics.filter { it.enabled }.map {
            NewsSource(
                id = "topic-${it.id}",
                name = it.query,
                url = DefaultSources.googleNews(it.query),
                category = NewsCategories.MY_TOPICS,
            )
        }
        val targets = sources.filter { it.enabled } + topicSources
        val failures = mutableListOf<String>()

        val results = targets.map { source ->
            async(Dispatchers.IO) {
                runCatching { fetchFeed(source) }
                    .onFailure { synchronized(failures) { failures += source.name } }
                    .getOrDefault(emptyList())
            }
        }.map { it.await() }

        val merged = results.flatten()
            .distinctBy { it.link.substringBefore("?").trimEnd('/') }
            .sortedByDescending { it.publishedAt }

        NewsResult(articles = merged, failedSources = failures.toList(), totalSources = targets.size)
    }

    suspend fun fetchFeed(source: NewsSource): List<Article> = withContext(Dispatchers.IO) {
        val body = Net.text(source.url, mapOf("Accept" to "application/rss+xml, application/xml, text/xml, */*"))
        parseFeed(body, source)
    }

    /** يتحقّق من صحّة رابط موجز قبل إضافته. */
    suspend fun validateFeed(url: String): Result<Pair<String, Int>> = runCatching {
        val body = Net.text(url)
        val title = Regex("<title[^>]*>(.*?)</title>", RegexOption.DOT_MATCHES_ALL)
            .find(body)?.groupValues?.get(1)?.let { cleanText(it) }.orEmpty()
        val items = parseFeed(body, NewsSource(name = title, url = url, category = NewsCategories.TOP))
        if (items.isEmpty()) error("لم يُعثر على أي عناصر في هذا الموجز.")
        title.ifBlank { url } to items.size
    }

    // ------------------------------------------------------------ التحليل

    /**
     * يحلّل موجزات RSS و RDF و Atom بمحلّل SAX القياسي.
     * اخترنا SAX من `javax.xml` لأنه متوفّر على أندرويد وعلى الـ JVM معًا،
     * ما يجعل هذا المنطق قابلًا للاختبار خارج الجهاز، ولأنه لا يحمّل المستند كاملًا في الذاكرة.
     */
    internal fun parseFeed(xml: String, source: NewsSource): List<Article> {
        val articles = mutableListOf<Article>()
        val handler = FeedHandler(source, articles)

        val factory = SAXParserFactory.newInstance().apply {
            isNamespaceAware = false
            runCatching { setFeature("http://apache.org/xml/features/nonvalidating/load-external-dtd", false) }
            runCatching { setFeature("http://xml.org/sax/features/external-general-entities", false) }
            runCatching { setFeature("http://xml.org/sax/features/external-parameter-entities", false) }
        }
        val cleaned = xml.trim().removePrefix("\uFEFF")
        factory.newSAXParser().parse(InputSource(StringReader(cleaned)), handler)
        return articles
    }

    private inner class FeedHandler(
        private val source: NewsSource,
        private val out: MutableList<Article>,
    ) : DefaultHandler() {

        private var inItem = false
        private val text = StringBuilder()

        private var title = ""
        private var link = ""
        private var altLink = ""
        private var description = ""
        private var content = ""
        private var pubDate = ""
        private var image: String? = null

        private fun reset() {
            inItem = true
            title = ""; link = ""; altLink = ""; description = ""
            content = ""; pubDate = ""; image = null
        }

        override fun startElement(uri: String?, localName: String?, qName: String, attrs: Attributes?) {
            text.setLength(0)
            val tag = qName.lowercase(Locale.ROOT)
            if (tag == "item" || tag == "entry") {
                reset()
                return
            }
            if (!inItem || attrs == null) return

            when (tag) {
                "link" -> {
                    // Atom يضع الرابط في السمة href، وRSS في نص العنصر.
                    val href = attrs.getValue("href")
                    val rel = attrs.getValue("rel")
                    if (!href.isNullOrBlank()) {
                        if (rel == null || rel == "alternate") link = href else altLink = href
                    }
                }
                "media:content", "media:thumbnail", "image" -> {
                    val url = attrs.getValue("url")
                    if (image == null && !url.isNullOrBlank() && looksLikeImage(url)) image = url
                }
                "enclosure" -> {
                    val url = attrs.getValue("url")
                    val type = attrs.getValue("type").orEmpty()
                    if (image == null && !url.isNullOrBlank() &&
                        (type.startsWith("image") || looksLikeImage(url))
                    ) image = url
                }
                "itunes:image" -> {
                    val url = attrs.getValue("href")
                    if (image == null && !url.isNullOrBlank()) image = url
                }
            }
        }

        override fun characters(ch: CharArray, start: Int, length: Int) {
            text.appendRange(ch, start, start + length)
        }

        override fun endElement(uri: String?, localName: String?, qName: String) {
            val tag = qName.lowercase(Locale.ROOT)
            val value = text.toString().trim()
            text.setLength(0)
            if (!inItem) return

            when (tag) {
                "item", "entry" -> {
                    inItem = false
                    emit()
                }
                "title" -> if (title.isBlank()) title = value
                "link" -> if (link.isBlank() && value.startsWith("http")) link = value
                "guid", "id" -> if (link.isBlank() && value.startsWith("http")) link = value
                "description", "summary" -> if (description.isBlank()) description = value
                "content", "content:encoded" -> if (content.isBlank()) content = value
                "pubdate", "published", "updated", "dc:date" ->
                    if (pubDate.isBlank()) pubDate = value
            }
        }

        private fun emit() {
            val finalLink = link.ifBlank { altLink }.trim()
            val cleanTitle = cleanText(title)
            if (cleanTitle.isBlank() || !finalLink.startsWith("http")) return
            val html = content.ifBlank { description }
            out += Article(
                id = finalLink.hashCode().toString(),
                title = cleanTitle,
                link = finalLink,
                summary = cleanText(html).take(320),
                imageUrl = image ?: firstImageInHtml(html),
                sourceName = source.name,
                category = source.category,
                publishedAt = parseDate(pubDate),
            )
        }
    }

    private fun looksLikeImage(url: String): Boolean {
        val lower = url.lowercase(Locale.ROOT).substringBefore('?')
        return lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".png") ||
            lower.endsWith(".webp") || lower.endsWith(".gif") || lower.contains("/image")
    }

    private fun firstImageInHtml(html: String): String? =
        Regex("""<img[^>]+src=["']([^"']+)["']""", RegexOption.IGNORE_CASE)
            .find(html)?.groupValues?.get(1)
            ?.takeIf { it.startsWith("http") }

    internal fun cleanText(raw: String): String = raw
        .replace(Regex("<script[^>]*>.*?</script>", setOf(RegexOption.DOT_MATCHES_ALL, RegexOption.IGNORE_CASE)), " ")
        .replace(Regex("<[^>]+>"), " ")
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&hellip;", "…")
        .replace("&mdash;", "—")
        .replace(Regex("&#(\\d+);")) { m ->
            m.groupValues[1].toIntOrNull()?.toChar()?.toString() ?: ""
        }
        .replace(Regex("\\s+"), " ")
        .trim()

    private val dateFormats = listOf(
        DateTimeFormatter.RFC_1123_DATE_TIME,
        DateTimeFormatter.ISO_OFFSET_DATE_TIME,
        DateTimeFormatter.ISO_ZONED_DATE_TIME,
        DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss zzz", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss Z", Locale.ENGLISH),
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.ENGLISH),
    )

    internal fun parseDate(value: String): Long {
        if (value.isBlank()) return System.currentTimeMillis()
        for (format in dateFormats) {
            val parsed = runCatching { ZonedDateTime.parse(value.trim(), format) }.getOrNull()
            if (parsed != null) return parsed.toInstant().toEpochMilli()
        }
        return runCatching {
            java.time.LocalDateTime.parse(value.trim().removeSuffix("Z"))
                .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        }.getOrDefault(System.currentTimeMillis())
    }
}

data class NewsResult(
    val articles: List<Article>,
    val failedSources: List<String> = emptyList(),
    val totalSources: Int = 0,
)
