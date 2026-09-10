/**
 * التواريخ العربية والهجرية.
 *
 * التقويم الهجري يأتي من ICU المدمج في Node عبر تقويم أم القرى — وهو
 * التقويم الرسمي في السعودية، ونفس ما يعرضه هاتف المستخدم.
 */

const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
]

const AR_WEEKDAYS = [
  'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
]

export function weekdayAr(date: Date): string {
  return AR_WEEKDAYS[date.getDay()]
}

export function longGregorianAr(date: Date): string {
  return `${weekdayAr(date)} ${date.getDate()} ${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function monthLabelAr(date: Date): string {
  return `${AR_MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

/** أجزاء التاريخ الهجري بتقويم أم القرى. */
export function hijriParts(date: Date, offsetDays = 0): {
  day: number; month: number; year: number; monthName: string
} {
  const shifted = new Date(date.getTime() + offsetDays * 86_400_000)
  const formatter = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    day: 'numeric', month: 'numeric', year: 'numeric',
  })
  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(shifted)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }

  // الأرقام تعود بأرقام هندية في هذه اللغة؛ نحوّلها إلى لاتينية.
  const toNumber = (value: string) =>
    Number(value.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))))

  const month = toNumber(parts.month ?? '1')
  return {
    day: toNumber(parts.day ?? '1'),
    month,
    year: toNumber(parts.year ?? '1400'),
    monthName: HIJRI_MONTHS[Math.min(11, Math.max(0, month - 1))],
  }
}

const HIJRI_MONTHS = [
  'محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجة',
]

export function longHijriAr(date: Date, offsetDays = 0): string {
  const hijri = hijriParts(date, offsetDays)
  return `${hijri.day} ${hijri.monthName} ${hijri.year} هـ`
}

export function isRamadan(date: Date, offsetDays = 0): boolean {
  return hijriParts(date, offsetDays).month === 9
}

/** تحية بحسب ساعة اليوم. */
export function greeting(hour: number): string {
  if (hour >= 4 && hour < 12) return 'صباح الخير'
  if (hour >= 12 && hour < 16) return 'نهارك سعيد'
  if (hour >= 16 && hour < 19) return 'مساء الخير'
  return 'مساء الخير'
}

export function formatTime(timestamp: number, use24h = true, timeZone?: string): string {
  return new Intl.DateTimeFormat('ar', {
    hour: '2-digit', minute: '2-digit', hour12: !use24h, timeZone,
  }).format(new Date(timestamp))
}

/** مدّة بصيغة عربية مختصرة: «٣ س ١٢ د». */
export function humanDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} د`
  if (minutes === 0) return `${hours} س`
  return `${hours} س ${minutes} د`
}

/** «قبل ٣ ساعات» — للأخبار والملاحظات. */
export function relativePast(timestamp: number): string {
  if (!timestamp) return ''
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'الآن'
  if (seconds < 3600) return `قبل ${Math.floor(seconds / 60)} د`
  if (seconds < 86_400) return `قبل ${Math.floor(seconds / 3600)} س`
  const days = Math.floor(seconds / 86_400)
  if (days === 1) return 'أمس'
  if (days < 30) return `قبل ${days} يومًا`
  return new Intl.DateTimeFormat('ar', { day: 'numeric', month: 'short' })
    .format(new Date(timestamp))
}
