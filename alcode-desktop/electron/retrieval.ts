/**
 * انتقاء ما يُحقن في سياق المساعد، وتطبيع النصّ العربي للمطابقة.
 *
 * نسخة مطابقة لما في تطبيق الأندرويد (`core/ArabicText.kt` و
 * `data/ai/Retrieval.kt`) عمدًا: نفس الترتيب على الجهازين يعني نفس الإجابة
 * لنفس السؤال، واختبارات الطرفين تتقابل حالةً بحالة فتكشف أيّ انحراف.
 *
 * السبب: كان السياق يأخذ أوّل اثنتي عشرة ذكرى مهما كان السؤال. فمن يحفظ
 * خمسين معلومة عن نفسه يرى المساعد اثنتي عشرة منها فقط، مختارةً بترتيب
 * الإضافة لا بصلتها — ثمّ يبدو كأنه «نسي» ما قاله له.
 */

const DIACRITICS = /[ً-ٰٟـ]/g

const STOPWORDS = new Set([
  'من', 'في', 'على', 'الى', 'عن', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك',
  'التي', 'الذي', 'ما', 'لا', 'ان', 'كان', 'يكون', 'هل', 'كيف', 'متى',
  'اين', 'لماذا', 'لي', 'لك', 'له', 'لها', 'او', 'ثم', 'قد', 'كل',
  'بعض', 'عند', 'بين', 'بعد', 'قبل', 'حتى', 'اذا', 'كما', 'هو', 'هي',
  'انا', 'انت', 'نحن', 'هم', 'يا', 'ايضا', 'فقط', 'جدا', 'شي', 'شيء',
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'is',
  'it', 'this', 'that', 'with', 'my', 'me', 'you', 'i',
])

/** يوحّد الهمزات والتاء المربوطة والألف المقصورة والأرقام ويزيل التشكيل. */
export function normalizeArabic(input: string): string {
  let out = ''
  for (const ch of input.replace(DIACRITICS, '')) {
    const code = ch.codePointAt(0) ?? 0
    if ('أإآٱٲٳ'.includes(ch)) out += 'ا'
    else if (ch === 'ة') out += 'ه'
    else if (ch === 'ى') out += 'ي'
    else if (ch === 'ؤ') out += 'و'
    else if (ch === 'ئ') out += 'ي'
    else if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660)
    else if (code >= 0x06F0 && code <= 0x06F9) out += String(code - 0x06F0)
    else out += ch.toLowerCase()
  }
  return out
}

/** تجذير خفيف؛ لا يُقصَّر إلى أقلّ من ثلاثة أحرف فيصير جذرًا يطابق كل شيء. */
export function stemArabic(word: string): string {
  let w = word
  for (const prefix of ['وال', 'بال', 'كال', 'فال', 'لل', 'ال']) {
    if (w.length > prefix.length + 2 && w.startsWith(prefix)) {
      w = w.slice(prefix.length)
      break
    }
  }
  for (const suffix of ['ات', 'ون', 'ين', 'ان', 'ها', 'هم', 'هن', 'كم', 'نا', 'ية', 'ه', 'ي']) {
    if (w.length > suffix.length + 2 && w.endsWith(suffix)) {
      w = w.slice(0, -suffix.length)
      break
    }
  }
  return w
}

/** كلمات دلالية مطبَّعة ومجذَّرة، بلا أدوات الربط ولا الرموز. */
export function tokens(text: string): string[] {
  return normalizeArabic(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map(stemArabic)
    .filter(Boolean)
}

/**
 * يرتّب `items` بحسب صلتها بـ `query`، والكلمة النادرة تزن أكثر (idf).
 *
 * بلا سؤال ذي معنى يُعاد الأحدث — أصدق من ترتيب عشوائي. وما لا يطابق
 * يُستبعد لا يُصفَّر: إدراجه بصفر يزاحم ما له معنى.
 */
export function rank<T>(
  query: string,
  items: T[],
  limit: number,
  textOf: (item: T) => string,
  recencyOf: (item: T) => number = () => 0,
): T[] {
  if (!items.length || limit <= 0) return []

  const queryTokens = new Set(tokens(query))
  const docs = items.map((item) => ({ item, words: tokens(textOf(item)) }))

  if (!queryTokens.size) {
    return [...items].sort((a, b) => recencyOf(b) - recencyOf(a)).slice(0, limit)
  }

  const seenIn = new Map<string, number>()
  for (const { words } of docs) {
    for (const word of new Set(words)) seenIn.set(word, (seenIn.get(word) ?? 0) + 1)
  }

  const total = docs.length
  const scored: { item: T; score: number }[] = []
  for (const { item, words } of docs) {
    if (!words.length) continue
    const counts = new Map<string, number>()
    for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1)

    let score = 0
    for (const token of queryTokens) {
      const times = counts.get(token)
      if (!times) continue
      const idf = Math.log(1 + total / (1 + (seenIn.get(token) ?? 0)))
      score += idf * (1 + Math.log(times))
    }
    // القسمة على جذر الطول تمنع النصّ الطويل من الفوز بطوله وحده.
    if (score > 0) scored.push({ item, score: score / Math.sqrt(words.length) })
  }

  return scored
    .sort((a, b) => b.score - a.score || recencyOf(b.item) - recencyOf(a.item))
    .slice(0, limit)
    .map((entry) => entry.item)
}
