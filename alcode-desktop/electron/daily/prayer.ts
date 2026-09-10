/**
 * حساب أوقات الصلاة فلكيًا — منقول حرفيًا عن نسخة الأندرويد.
 *
 * الحساب محلّي بالكامل ولا يحتاج إنترنت، ويعتمد معادلات الموقع الشمسي
 * القياسية (Meeus / PrayTimes). نقلناه بدل استدعاء واجهة خارجية لسببين:
 * يعمل بلا شبكة، ويعطي النتيجة نفسها التي يراها المستخدم على هاتفه.
 */

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const PRAYERS: { key: PrayerKey; arabic: string; obligatory: boolean }[] = [
  { key: 'fajr', arabic: 'الفجر', obligatory: true },
  { key: 'sunrise', arabic: 'الشروق', obligatory: false },
  { key: 'dhuhr', arabic: 'الظهر', obligatory: true },
  { key: 'asr', arabic: 'العصر', obligatory: true },
  { key: 'maghrib', arabic: 'المغرب', obligatory: true },
  { key: 'isha', arabic: 'العشاء', obligatory: true },
]

export interface Method {
  id: string
  arabic: string
  fajrAngle: number
  ishaAngle: number
  /** إن كان أكبر من صفر فالعشاء = المغرب + هذه الدقائق (تتجاهل الزاوية). */
  ishaMinutes?: number
  maghribAngle?: number
  /** دقيقة احتياطية فوق الزوال الفلكي، كما تعتمد المراجع القياسية. */
  dhuhrOffsetMinutes?: number
}

export const METHODS: Method[] = [
  { id: 'UMM_AL_QURA', arabic: 'أم القرى — مكة المكرمة', fajrAngle: 18.5, ishaAngle: 0, ishaMinutes: 90 },
  { id: 'MWL', arabic: 'رابطة العالم الإسلامي', fajrAngle: 18, ishaAngle: 17 },
  { id: 'EGYPT', arabic: 'الهيئة المصرية العامة للمساحة', fajrAngle: 19.5, ishaAngle: 17.5 },
  { id: 'KARACHI', arabic: 'جامعة العلوم الإسلامية — كراتشي', fajrAngle: 18, ishaAngle: 18 },
  { id: 'ISNA', arabic: 'الجمعية الإسلامية لأمريكا الشمالية', fajrAngle: 15, ishaAngle: 15 },
  { id: 'DUBAI', arabic: 'دائرة الشؤون الإسلامية — دبي', fajrAngle: 18.2, ishaAngle: 18.2 },
  { id: 'QATAR', arabic: 'قطر', fajrAngle: 18, ishaAngle: 0, ishaMinutes: 90 },
  { id: 'KUWAIT', arabic: 'الكويت', fajrAngle: 18, ishaAngle: 17.5 },
  { id: 'SINGAPORE', arabic: 'سنغافورة', fajrAngle: 20, ishaAngle: 18 },
  { id: 'TURKEY', arabic: 'رئاسة الشؤون الدينية — تركيا', fajrAngle: 18, ishaAngle: 17 },
  { id: 'TEHRAN', arabic: 'جامعة طهران', fajrAngle: 17.7, ishaAngle: 14, maghribAngle: 4.5 },
  { id: 'JAFARI', arabic: 'الجعفري', fajrAngle: 16, ishaAngle: 14, maghribAngle: 4 },
  { id: 'FRANCE', arabic: 'الاتحاد الإسلامي — فرنسا', fajrAngle: 12, ishaAngle: 12 },
  { id: 'RUSSIA', arabic: 'الإدارة الروحية — روسيا', fajrAngle: 16, ishaAngle: 15 },
]

export type HighLatitudeRule = 'MIDDLE_OF_NIGHT' | 'SEVENTH_OF_NIGHT' | 'ANGLE_BASED'

export interface PrayerConfig {
  methodId: string
  /** ١ للجمهور، ٢ للحنفي. */
  asrFactor: 1 | 2
  highLatitudeRule: HighLatitudeRule
  elevationMeters: number
  /** تعديل يدوي بالدقائق لكل صلاة. */
  offsets: Partial<Record<PrayerKey, number>>
}

export const defaultPrayerConfig: PrayerConfig = {
  methodId: 'UMM_AL_QURA',
  asrFactor: 1,
  highLatitudeRule: 'ANGLE_BASED',
  elevationMeters: 0,
  offsets: {},
}

export function methodById(id: string): Method {
  return METHODS.find((m) => m.id === id) ?? METHODS[0]
}

const KAABA_LAT = 21.4224779
const KAABA_LNG = 39.8251832

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const fixAngle = (a: number) => ((a % 360) + 360) % 360
const fixHour = (h: number) => ((h % 24) + 24) % 24

interface Sun {
  declination: number
  equationOfTime: number
}

/** موضع الشمس التقريبي — دقّة كافية لأوقات الصلاة (±دقيقة). */
function sunPosition(jd: number): Sun {
  const d = jd - 2451545.0
  const g = fixAngle(357.529 + 0.98560028 * d)
  const q = fixAngle(280.459 + 0.98564736 * d)
  const l = fixAngle(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)))
  const e = 23.439 - 0.00000036 * d
  const ra = fixHour(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(l)), Math.cos(rad(l)))) / 15)
  return {
    declination: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(l)))),
    equationOfTime: q / 15 - ra,
  }
}

function julianDate(year: number, month: number, day: number): number {
  let y = year
  let m = month
  if (m <= 2) {
    y -= 1
    m += 12
  }
  const a = Math.floor(y / 100)
  const b = 2 - a + Math.floor(a / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5
}

/**
 * إزاحة المنطقة الزمنية بالساعات لتاريخ معيّن.
 *
 * نحسبها من فارق التوقيت المحلي عن UTC في ظهيرة ذلك اليوم، فتلتقط
 * التوقيت الصيفي تلقائيًا بدل افتراض إزاحة ثابتة.
 */
export function zoneOffsetHours(date: Date, timeZone?: string): number {
  const noon = new Date(Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0,
  ))
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts: Record<string, string> = {}
  for (const part of formatter.formatToParts(noon)) {
    if (part.type !== 'literal') parts[part.type] = part.value
  }
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  )
  return (asUtc - noon.getTime()) / 3_600_000
}

export interface DayPrayers {
  /** yyyy-MM-dd */
  date: string
  /** مفاتيح الصلوات إلى وقتها كطابع زمني. */
  times: Record<PrayerKey, number>
}

export function calculate(
  date: Date,
  latitude: number,
  longitude: number,
  config: PrayerConfig = defaultPrayerConfig,
  timeZone?: string,
  isRamadan = false,
): DayPrayers {
  const method = methodById(config.methodId)
  const offsetHours = zoneOffsetHours(date, timeZone)

  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate())
    - longitude / (15 * 24)
  const sun = sunPosition(jd)

  const solarNoon = 12 + offsetHours - longitude / 15 - sun.equationOfTime
  const dhuhr = solarNoon + (method.dhuhrOffsetMinutes ?? 1) / 60

  const sunriseAngle = 0.833 + 0.0347 * Math.sqrt(Math.max(0, config.elevationMeters))

  const hourAngle = (angle: number): number | null => {
    const cosH =
      (-Math.sin(rad(angle)) - Math.sin(rad(sun.declination)) * Math.sin(rad(latitude))) /
      (Math.cos(rad(sun.declination)) * Math.cos(rad(latitude)))
    if (Number.isNaN(cosH) || cosH > 1 || cosH < -1) return null
    return deg(Math.acos(cosH)) / 15
  }

  const asrHourAngle = (factor: number): number | null => {
    const angle = -deg(
      Math.atan(1 / (factor + Math.tan(rad(Math.abs(latitude - sun.declination))))),
    )
    return hourAngle(angle)
  }

  const span = hourAngle(sunriseAngle)
  const sunrise = span === null ? null : solarNoon - span
  const sunset = span === null ? null : solarNoon + span

  const maghribAngle = method.maghribAngle ?? 0
  let maghrib: number | null
  if (maghribAngle > 0) {
    const h = hourAngle(maghribAngle)
    maghrib = h === null ? null : solarNoon + h
  } else {
    maghrib = sunset
  }

  let fajr: number | null = (() => {
    const h = hourAngle(method.fajrAngle)
    return h === null ? null : solarNoon - h
  })()

  const ishaMinutes = method.ishaMinutes ?? 0
  let isha: number | null
  if (ishaMinutes > 0) {
    // رمضان يضيف نصف ساعة في أم القرى — كما في الجداول الرسمية.
    const bonus = isRamadan ? 30 : 0
    isha = maghrib === null ? null : maghrib + (ishaMinutes + bonus) / 60
  } else {
    const h = hourAngle(method.ishaAngle)
    isha = h === null ? null : solarNoon + h
  }

  const asr = (() => {
    const h = asrHourAngle(config.asrFactor)
    return h === null ? null : solarNoon + h
  })()

  // خطوط العرض العالية: حين تتعذّر العلامة الفلكية نقسّم الليل.
  if (sunrise !== null && sunset !== null) {
    const night = 24 - (sunset - sunrise)

    // القاعدة تقارن الفترة بين العلامة والشروق/الغروب — لا المسافة من الظهر.
    const fajrLimit = nightPortion(config, method.fajrAngle, night)
    if (fajr === null || sunrise - fajr > fajrLimit) {
      fajr = sunrise - fajrLimit
    }

    // العشاء المحسوب بالدقائق (أم القرى وقطر) لا يخضع لهذا التعديل.
    if (ishaMinutes <= 0) {
      const ishaLimit = nightPortion(
        config, method.ishaAngle > 0 ? method.ishaAngle : 18, night,
      )
      if (isha === null || isha - sunset > ishaLimit) {
        isha = sunset + ishaLimit
      }
    }
  }

  const raw: Record<PrayerKey, number> = {
    fajr: fajr ?? solarNoon - 6,
    sunrise: sunrise ?? solarNoon - 5.5,
    dhuhr,
    asr: asr ?? solarNoon + 3.5,
    maghrib: maghrib ?? solarNoon + 5.5,
    isha: isha ?? solarNoon + 7,
  }

  const times = {} as Record<PrayerKey, number>
  for (const prayer of PRAYERS) {
    const adjust = config.offsets[prayer.key] ?? 0
    times[prayer.key] = hoursToTimestamp(date, raw[prayer.key] + adjust / 60, offsetHours)
  }

  return { date: isoDate(date), times }
}

function nightPortion(config: PrayerConfig, angle: number, night: number): number {
  switch (config.highLatitudeRule) {
    case 'MIDDLE_OF_NIGHT': return night / 2
    case 'SEVENTH_OF_NIGHT': return night / 7
    default: return night * (angle / 60)
  }
}

/**
 * يحوّل الساعات العشرية إلى لحظة زمنية مطلقة.
 *
 * [hours] ساعة حائط في منطقة **المكان** لا في منطقة الجهاز — والفرق ليس
 * نظريًا: من يتابع مواقيت مكة وهو في لندن كان سيرى فارق ثلاث ساعات.
 * لذلك نبني اللحظة على UTC ثم نطرح إزاحة منطقة المكان.
 */
function hoursToTimestamp(date: Date, hours: number, offsetHours: number): number {
  let h = hours
  let dayShift = 0
  while (h < 0) { h += 24; dayShift -= 1 }
  while (h >= 24) { h -= 24; dayShift += 1 }
  const minutes = Math.floor(h * 60)
  const midnightUtc = Date.UTC(
    date.getFullYear(), date.getMonth(), date.getDate() + dayShift,
  )
  return midnightUtc + minutes * 60_000 - offsetHours * 3_600_000
}

export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** اتجاه القبلة بالدرجات من الشمال الجغرافي. */
export function qiblaBearing(latitude: number, longitude: number): number {
  const dLng = rad(KAABA_LNG - longitude)
  const lat = rad(latitude)
  const y = Math.sin(dLng)
  const x = Math.cos(lat) * Math.tan(rad(KAABA_LAT)) - Math.sin(lat) * Math.cos(dLng)
  return fixAngle(deg(Math.atan2(y, x)))
}

/** المسافة بالكيلومترات إلى الكعبة (دائرة عظمى). */
export function distanceToKaaba(latitude: number, longitude: number): number {
  const r = 6371
  const dLat = rad(KAABA_LAT - latitude)
  const dLng = rad(KAABA_LNG - longitude)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(latitude)) * Math.cos(rad(KAABA_LAT)) * Math.sin(dLng / 2) ** 2
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** الصلاة القادمة بعد لحظة معيّنة. */
export function nextPrayer(
  day: DayPrayers, from: number,
): { key: PrayerKey; arabic: string; at: number } | null {
  for (const prayer of PRAYERS) {
    if (!prayer.obligatory) continue
    const at = day.times[prayer.key]
    if (at > from) return { key: prayer.key, arabic: prayer.arabic, at }
  }
  return null
}

/** الصلاة الحالية — آخر صلاة دخل وقتها. */
export function currentPrayer(
  day: DayPrayers, from: number,
): { key: PrayerKey; arabic: string; at: number } | null {
  let found: { key: PrayerKey; arabic: string; at: number } | null = null
  for (const prayer of PRAYERS) {
    if (!prayer.obligatory) continue
    const at = day.times[prayer.key]
    if (at <= from) found = { key: prayer.key, arabic: prayer.arabic, at }
  }
  return found
}
