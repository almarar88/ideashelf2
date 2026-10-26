/**
 * استخراج نصّ صفحة الويب القابل للقراءة من HTML.
 *
 * نسخة مطابقة لـ `core/Readable.kt` في تطبيق الأندرويد، واختباراتها تتقابل
 * معها حالةً بحالة.
 *
 * مستخرِجٌ متعمَّد البساطة: لا محلّل DOM ولا مكتبة قراءة. نصّ صفحة الخبر في
 * فقراتها وعناوينها، وإسقاط `script` و`style` والقوائم الجانبية يكفي
 * للتلخيص — بلا اعتماد جديد وبلا سلوكٍ يتغيّر مع تغيّر مكتبة خارجية.
 */

const DROPPED = /<(script|style|noscript|svg|template|iframe|nav|footer|form)\b[^>]*>[\s\S]*?<\/\1>/gi
const COMMENTS = /<!--[\s\S]*?-->/g
const TITLE = /<title[^>]*>([\s\S]*?)<\/title>/i
/** الوسوم الكتلية تصير أسطرًا، وإلا التصقت الفقرات ببعضها كلمةً واحدة. */
const BLOCKS = /<\/?(p|div|br|li|tr|h[1-6]|section|article|blockquote|header)\b[^>]*>/gi
const TAGS = /<[^>]+>/g

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&laquo;': '«', '&raquo;': '»',
  '&hellip;': '…', '&mdash;': '—', '&ndash;': '–',
}

export interface Page { title: string; text: string }

function clean(input: string): string {
  let out = input
  for (const [entity, value] of Object.entries(ENTITIES)) {
    out = out.replace(new RegExp(entity, 'gi'), value)
  }
  out = out.replace(/&#(\d{1,6});/g, (match, digits: string) => {
    const code = Number(digits)
    return code >= 1 && code <= 0x10FFFF ? String.fromCodePoint(code) : match
  })
  out = out.replace(/&#x([0-9a-f]{1,6});/gi, (match, hex: string) => {
    const code = parseInt(hex, 16)
    return code >= 1 && code <= 0x10FFFF ? String.fromCodePoint(code) : match
  })
  // مسافات أفقية فقط: الأسطر تُبقى ليفصل بينها لاحقًا.
  return out.replace(/[ \t ]+/g, ' ')
}

/** عنوان الصفحة ونصّها، مقتطعًا عند `limit` حرفًا. */
export function extractReadable(html: string, limit = 6000): Page {
  const title = clean(TITLE.exec(html)?.[1] ?? '').trim()
  let body = html.replace(COMMENTS, ' ')
  body = body.replace(DROPPED, ' ')
  body = body.replace(BLOCKS, '\n')
  body = body.replace(TAGS, ' ')
  const text = clean(body)
    .split('\n')
    .map((line) => line.trim())
    // الأسطر القصيرة جدًا في صفحات الأخبار أزرارٌ وروابط تنقّل لا نصّ.
    .filter((line) => line.length > 2)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return { title, text: text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…` }
}
