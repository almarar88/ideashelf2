/** أدوات نصية عربية: تطبيع للبحث، وتنسيق الأوقات والتواريخ. */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** يوحّد شكل النص العربي (همزات، ألف مقصورة، تاء مربوطة، تشكيل) لتسهيل البحث. */
export function normalizeArabic(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .replace(TASHKEEL, "")
    .replace(/[إأآٱا]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ؤئ]/g, "ء")
    .replace(/[‌-‏‪-‮]/g, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** يبني حقل بحث موحّد من عدة أعمدة. */
export function buildSearchIndex(...parts: (string | null | undefined)[]): string {
  return normalizeArabic(parts.filter(Boolean).join(" | "));
}

export const WEEKDAY_NAMES = [
  "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

/** يحوّل دقائق منذ منتصف الليل إلى «02:30 م». */
export function minutesToLabel(min: number): string {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const period = h24 < 12 ? "ص" : "م";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** يحوّل دقائق إلى «14:30» لاستخدامها في حقول input[type=time]. */
export function minutesToTimeInput(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function timeInputToMinutes(value: string): number {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/** هل تتقاطع فترتان زمنيتان (نهاية الفترة غير شاملة). */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** هل يتقاطع مجالا تاريخين (بصيغة YYYY-MM-DD، شاملَين). */
export function dateRangesOverlap(a1: string, a2: string, b1: string, b2: string): boolean {
  return a1 <= b2 && b1 <= a2;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return `${formatDate(iso)} — ${minutesToLabel(d.getHours() * 60 + d.getMinutes())}`;
}

/** يعيد كل التواريخ (YYYY-MM-DD) بين تاريخين تقع في يوم أسبوعي محدد. */
export function datesForWeekday(from: string, to: string, weekday: number): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return out;
  for (const d = start; d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === weekday) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
  }
  return out;
}
