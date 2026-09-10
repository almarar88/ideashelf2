/**
 * الأخبار: جلب موجزات RSS/Atom مباشرة من مصادرها.
 *
 * بلا وسيط وبلا تتبّع — التطبيق يطلب الموجز من الناشر كما يفعل أي قارئ RSS.
 * التحليل مكتوب هنا بلا مكتبة: الموجزات بنية بسيطة، وإضافة حزمة كاملة
 * لأجلها تكبّر التطبيق وتضيف سطحًا أمنيًا بلا مقابل.
 */

export interface NewsSource {
  id: string
  name: string
  url: string
  category: string
  enabled: boolean
  custom?: boolean
}

export interface Article {
  title: string
  link: string
  summary: string
  sourceName: string
  category: string
  publishedAt: number
  image?: string
}

export const CATEGORIES = [
  'الأهم', 'العالم', 'محلي', 'اقتصاد', 'تقنية', 'علوم', 'رياضة', 'صحة', 'ثقافة',
]

const googleNews = (query: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=SA&ceid=SA:ar`

export const DEFAULT_SOURCES: NewsSource[] = [
  { id: 'aljazeera', name: 'الجزيرة نت', url: 'https://www.aljazeera.net/xml/rss/all.xml', category: 'الأهم', enabled: true },
  { id: 'bbc-ar', name: 'BBC عربي', url: 'https://feeds.bbci.co.uk/arabic/rss.xml', category: 'الأهم', enabled: true },
  { id: 'skynews-ar', name: 'سكاي نيوز عربية', url: 'https://www.skynewsarabia.com/web/rss/95.xml', category: 'الأهم', enabled: true },
  { id: 'alarabiya', name: 'العربية', url: 'https://www.alarabiya.net/.mrss/ar.xml', category: 'الأهم', enabled: true },
  { id: 'rt-ar', name: 'RT عربي', url: 'https://arabic.rt.com/rss/', category: 'العالم', enabled: true },
  { id: 'cnn-ar', name: 'CNN بالعربية', url: 'https://arabic.cnn.com/api/v1/rss/rss.xml', category: 'العالم', enabled: true },
  { id: 'dw-ar', name: 'DW عربية', url: 'https://rss.dw.com/rdf/rss-ar-all', category: 'العالم', enabled: true },
  { id: 'aawsat', name: 'الشرق الأوسط', url: 'https://aawsat.com/feed', category: 'محلي', enabled: true },
  { id: 'alarabiya-biz', name: 'العربية Business', url: 'https://www.alarabiya.net/.mrss/ar/aswaq.xml', category: 'اقتصاد', enabled: true },
  { id: 'cnbc-ar', name: 'CNBC عربية', url: 'https://www.cnbcarabia.com/rss', category: 'اقتصاد', enabled: true },
  { id: 'aitnews', name: 'البوابة العربية للتقنية', url: 'https://aitnews.com/feed/', category: 'تقنية', enabled: true },
  { id: 'tech-wd', name: 'عالم التقنية', url: 'https://www.tech-wd.com/wd/feed/', category: 'تقنية', enabled: true },
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'تقنية', enabled: true },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'تقنية', enabled: true },
  { id: 'scientificam', name: 'Scientific American', url: 'https://rss.sciam.com/ScientificAmerican-Global', category: 'علوم', enabled: true },
  { id: 'nasa', name: 'NASA', url: 'https://www.nasa.gov/news-release/feed/', category: 'علوم', enabled: true },
  { id: 'sport360', name: 'سبورت ٣٦٠', url: 'https://arabic.sport360.com/feed', category: 'رياضة', enabled: true },
  { id: 'sports-gnews', name: 'رياضة عربية', url: googleNews('أخبار الرياضة'), category: 'رياضة', enabled: true },
  { id: 'health-gnews', name: 'صحة وطب', url: googleNews('صحة وطب'), category: 'صحة', enabled: true },
  { id: 'culture-gnews', name: 'ثقافة وفنون', url: googleNews('ثقافة وفنون وكتب'), category: 'ثقافة', enabled: true },
]

/** موضوع يتابعه المستخدم بكلماته — يتحوّل إلى بحث في أخبار جوجل. */
export function topicSource(query: string): NewsSource {
  return {
    id: `topic:${query}`,
    name: query,
    url: googleNews(query),
    category: 'مواضيعي',
    enabled: true,
    custom: true,
  }
}

// ------------------------------------------------------------ التحليل

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#039': "'",
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z#0-9]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
}

/**
 * ينظّف نصًا من الوسوم والكيانات.
 *
 * كثير من الموجزات تضع HTML **مهرَّبًا** داخل الوصف (`&lt;p&gt;`)، فلا تكفي
 * إزالة الوسوم وحدها ولا فكّ الكيانات وحده: نفكّ أولًا ليظهر الوسم، ثم نزيله،
 * ثم نفكّ مرة أخرى لأن النصّ نفسه كان مهرَّبًا مرّتين (`&amp;amp;`).
 */
function stripTags(value: string): string {
  const unwrapped = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  const revealed = decodeEntities(unwrapped)
  const withoutTags = revealed.replace(/<[^>]*>/g, ' ')
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim()
}

/** يستخرج محتوى أول وسم بالاسم المعطى داخل مقطع. */
function tagValue(chunk: string, ...names: string[]): string {
  for (const name of names) {
    const match = chunk.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'),
    )
    if (match) {
      const value = stripTags(match[1])
      if (value) return value
    }
  }
  return ''
}

/** الرابط في Atom يأتي سمةً لا محتوى وسم. */
function linkValue(chunk: string): string {
  const plain = chunk.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i)
  if (plain && stripTags(plain[1])) return stripTags(plain[1])
  const alternate = chunk.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)
  if (alternate) return decodeEntities(alternate[1])
  const href = chunk.match(/<link[^>]*href=["']([^"']+)["']/i)
  return href ? decodeEntities(href[1]) : ''
}

function imageValue(chunk: string): string | undefined {
  const patterns = [
    /<media:content[^>]*url=["']([^"']+)["']/i,
    /<media:thumbnail[^>]*url=["']([^"']+)["']/i,
    /<enclosure[^>]*type=["']image[^"']*["'][^>]*url=["']([^"']+)["']/i,
    /<enclosure[^>]*url=["']([^"']+\.(?:jpg|jpeg|png|webp))["']/i,
    /<img[^>]*src=["']([^"']+)["']/i,
  ]
  for (const pattern of patterns) {
    const match = chunk.match(pattern)
    if (match) return decodeEntities(match[1])
  }
  return undefined
}

function parseDate(value: string): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/** يحلّل موجز RSS أو Atom إلى مقالات. */
export function parseFeed(xml: string, source: NewsSource): Article[] {
  const chunks = xml.match(/<(item|entry)(?:\s[^>]*)?>[\s\S]*?<\/\1>/gi) ?? []
  const articles: Article[] = []

  for (const chunk of chunks) {
    const title = tagValue(chunk, 'title')
    const link = linkValue(chunk)
    if (!title || !link) continue

    articles.push({
      title,
      link,
      summary: tagValue(chunk, 'description', 'summary', 'content').slice(0, 400),
      sourceName: source.name,
      category: source.category,
      publishedAt: parseDate(
        chunk.match(/<(pubDate|published|updated|dc:date)>([\s\S]*?)<\/\1>/i)?.[2]?.trim() ?? '',
      ),
      image: imageValue(chunk),
    })
  }
  return articles
}

const TIMEOUT_MS = 12_000

async function fetchFeed(source: NewsSource): Promise<Article[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { 'user-agent': 'AlcodeAi/1.0 (+desktop reader)' },
    })
    if (!response.ok) return []
    return parseFeed(await response.text(), source)
  } catch {
    // مصدر واحد متعطّل لا يُسقط بقيّة الأخبار.
    return []
  } finally {
    clearTimeout(timer)
  }
}

/** يجلب كل المصادر المفعّلة بالتوازي ويدمج النتائج. */
export async function fetchNews(sources: NewsSource[]): Promise<Article[]> {
  const enabled = sources.filter((source) => source.enabled)
  const batches = await Promise.all(enabled.map(fetchFeed))

  const seen = new Set<string>()
  const merged: Article[] = []
  for (const article of batches.flat()) {
    // نفس الخبر يصل من عدة مصادر؛ الرابط هو المميّز.
    const key = article.link.split('?')[0]
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(article)
  }

  return merged.sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 300)
}

/** يتحقّق من صلاحية موجز قبل إضافته، ويعيد اسمه وعدد عناصره. */
export async function validateFeed(url: string): Promise<{ name: string; count: number }> {
  const source: NewsSource = {
    id: 'probe', name: 'مصدر جديد', url, category: 'الأهم', enabled: true,
  }
  const response = await fetch(url, { headers: { 'user-agent': 'AlcodeAi/1.0' } })
  if (!response.ok) throw new Error(`الخادم ردّ بـ ${response.status}`)
  const body = await response.text()
  const items = parseFeed(body, source)
  if (!items.length) throw new Error('ليس موجز RSS/Atom صالحًا، أو لا يحوي عناصر.')

  const name = tagValue(body.split(/<(item|entry)[\s>]/i)[0], 'title') || 'مصدر جديد'
  return { name, count: items.length }
}
