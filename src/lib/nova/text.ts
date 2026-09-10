/**
 * طبقة النص العربي.
 *
 * مستقلة عن كل شيء آخر لأن ثلاث طبقات تحتاجها معًا: المُخطِّط المحلي
 * (لفهم النيّة)، ونظام الملفات (للبحث الدلالي)، والوكلاء (لجمع السياق).
 * كانت هذه الدوال داخل المُخطِّط، فكان البحث لا يُطبّع النص — ومعناه أن
 * «والنخيل» لا تجد «النخيل». الفصل هنا ليس ترتيبًا شكليًا بل إصلاح.
 */

const FOLD_MAP: Record<string, string> = {
  "أ": "ا",
  "إ": "ا",
  "آ": "ا",
  "ى": "ي",
  "ة": "ه",
  "ؤ": "و",
  "ئ": "ي",
};

const DIACRITIC = /[ً-ْـ]/;

/** بادئات عربية شائعة تُقشَّر للمطابقة الجذرية */
const PREFIXES = ["وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل"];

/**
 * تطبيع مع خريطة مواقع: كل حرف مُطبَّع يعرف موضعه في النص الأصلي.
 * بلا هذه الخريطة، أي كود يبحث في المُطبَّع ويقطع من الأصلي يقطع خطأً —
 * لأن حذف الحركات يغيّر الطول.
 */
export function foldWithMap(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (DIACRITIC.test(ch)) continue;
    const mapped = FOLD_MAP[ch] ?? ch.toLowerCase();
    folded += mapped;
    // بعض الحروف تتحوّل إلى أكثر من حرف عند التصغير: كل ناتج يشير للأصل
    for (let k = 0; k < mapped.length; k += 1) map.push(i);
  }
  return { folded, map };
}

export function fold(text: string): string {
  return foldWithMap(text.trim()).folded;
}

/** يقشّر البادئات الشائعة إن بقي جذر معقول */
export function stem(word: string): string {
  const w = fold(word).replace(/[^\p{L}\p{N}]/gu, "");
  for (const p of PREFIXES) {
    if (w.startsWith(p) && w.length - p.length >= 3) return w.slice(p.length);
  }
  return w;
}

export function tokens(text: string): string[] {
  return fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** هل يتقاطع مصطلح البحث مع كلمة؟ يقبل التطابق في الاتجاهين لأن العربية تُلصق */
export function related(term: string, word: string): boolean {
  if (!term || !word) return false;
  if (word.includes(term) || term.includes(word)) return true;
  const a = stem(term);
  const b = stem(word);
  if (a.length < 3 || b.length < 3) return false;
  return b.includes(a) || a.includes(b);
}
