/**
 * الطقس من Open-Meteo — مجاني ولا يحتاج مفتاحًا ولا تسجيلًا.
 *
 * لا نرسل إليه إلا الإحداثيات التي اختارها المستخدم بنفسه، ولا هوية ولا معرّفًا.
 */

export interface Place {
  name: string
  country: string
  admin: string
  latitude: number
  longitude: number
  timezone: string
  elevation: number
}

export interface WeatherNow {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windDirection: number
  pressure: number
  cloudCover: number
  precipitation: number
  weatherCode: number
  isDay: boolean
}

export interface HourForecast {
  epochSeconds: number
  temperature: number
  weatherCode: number
  precipitationProbability: number
  isDay: boolean
  /** الوصف والأيقونة يُحسبان هنا لا في الواجهة: جدول رموز WMO واحد لا اثنان. */
  text: string
  emoji: string
}

export interface DayForecast {
  epochSeconds: number
  weatherCode: number
  max: number
  min: number
  sunriseEpoch: number
  sunsetEpoch: number
  uvIndex: number
  precipitationProbability: number
  text: string
  emoji: string
}

export interface WeatherBundle {
  place: Place
  now: WeatherNow
  hourly: HourForecast[]
  daily: DayForecast[]
  fetchedAt: number
}

const TIMEOUT_MS = 15_000

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** بحث عن مدينة بالاسم — يقبل العربية والإنجليزية. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(trimmed)}&count=8&language=ar&format=json`

  const data = await getJson<{ results?: any[] }>(url)
  return (data.results ?? []).map((row) => ({
    name: String(row.name ?? ''),
    country: String(row.country ?? ''),
    admin: String(row.admin1 ?? ''),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    timezone: String(row.timezone ?? 'auto'),
    elevation: Number(row.elevation ?? 0),
  }))
}

export function placeLabel(place: Place): string {
  return [place.name, place.admin, place.country]
    .filter((part) => part && part.trim())
    .filter((part, index, all) => all.indexOf(part) === index)
    .join('، ')
}

/**
 * يحوّل طابع Open-Meteo الزمني إلى ثوانٍ منذ الحقبة.
 *
 * الخدمة مع `timezone=auto` تعيد أوقاتًا بتوقيت المكان بلا لاحقة منطقة
 * («2026-09-10T06:02»). تمرير هذه السلسلة إلى Date.parse يفسّرها بمنطقة
 * *الجهاز* لا المكان، فتنزاح كل الأوقات بفارق المنطقتين: جهاز على UTC كان
 * يعرض شروق دبي ١٠:٠٢ بدل ٠٦:٠٢. الردّ يحمل `utc_offset_seconds` لهذا الغرض
 * تحديدًا: نقرأ السلسلة كـ UTC ثم نطرح إزاحة المكان. مستقلّة عن منطقة الجهاز
 * بالكامل، وهذا ما يختبره `daily.test.mjs`.
 */
export function openMeteoEpoch(value: string, offsetSeconds: number): number {
  if (!value) return 0
  const normalized = (value.length === 16 ? `${value}:00` : value) + 'Z'
  const parsed = Date.parse(normalized)
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000) - offsetSeconds
}

export async function fetchWeather(place: Place): Promise<WeatherBundle> {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${place.latitude}&longitude=${place.longitude}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,' +
    'precipitation,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover' +
    '&hourly=temperature_2m,weather_code,precipitation_probability,is_day' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,' +
    'uv_index_max,precipitation_probability_max' +
    '&timezone=auto&forecast_days=7'

  const data = await getJson<any>(url)
  const current = data.current ?? {}
  const hourly = data.hourly ?? {}
  const daily = data.daily ?? {}

  const offsetSeconds = Number(data.utc_offset_seconds ?? 0)
  const toEpoch = (value: string) => openMeteoEpoch(value, offsetSeconds)

  const hours: HourForecast[] = (hourly.time ?? []).map((time: string, index: number) => ({
    epochSeconds: toEpoch(time),
    temperature: Number(hourly.temperature_2m?.[index] ?? 0),
    weatherCode: Number(hourly.weather_code?.[index] ?? 0),
    precipitationProbability: Number(hourly.precipitation_probability?.[index] ?? 0),
    isDay: Number(hourly.is_day?.[index] ?? 1) === 1,
    ...describeWeather(
      Number(hourly.weather_code?.[index] ?? 0),
      Number(hourly.is_day?.[index] ?? 1) === 1,
    ),
  }))

  const days: DayForecast[] = (daily.time ?? []).map((time: string, index: number) => ({
    epochSeconds: toEpoch(time),
    weatherCode: Number(daily.weather_code?.[index] ?? 0),
    max: Number(daily.temperature_2m_max?.[index] ?? 0),
    min: Number(daily.temperature_2m_min?.[index] ?? 0),
    sunriseEpoch: toEpoch(String(daily.sunrise?.[index] ?? '')),
    sunsetEpoch: toEpoch(String(daily.sunset?.[index] ?? '')),
    uvIndex: Number(daily.uv_index_max?.[index] ?? 0),
    precipitationProbability: Number(daily.precipitation_probability_max?.[index] ?? 0),
    // الأيام تُوصف دائمًا بأيقونة النهار: «ليل» بلا معنى لملخّص يوم كامل.
    ...describeWeather(Number(daily.weather_code?.[index] ?? 0), true),
  }))

  return {
    place,
    now: {
      temperature: Number(current.temperature_2m ?? 0),
      feelsLike: Number(current.apparent_temperature ?? current.temperature_2m ?? 0),
      humidity: Number(current.relative_humidity_2m ?? 0),
      windSpeed: Number(current.wind_speed_10m ?? 0),
      windDirection: Number(current.wind_direction_10m ?? 0),
      pressure: Number(current.pressure_msl ?? 0),
      cloudCover: Number(current.cloud_cover ?? 0),
      precipitation: Number(current.precipitation ?? 0),
      weatherCode: Number(current.weather_code ?? 0),
      isDay: Number(current.is_day ?? 1) === 1,
    },
    hourly: hours,
    daily: days,
    fetchedAt: Date.now(),
  }
}

/** وصف عربي ورمز لكل رمز حالة جوية في معيار WMO. */
export function describeWeather(code: number, isDay = true): { text: string; emoji: string } {
  const table: Record<number, [string, string, string]> = {
    0: ['صحو', '☀️', '🌙'],
    1: ['صحو غالبًا', '🌤️', '🌙'],
    2: ['غيوم متفرّقة', '⛅', '☁️'],
    3: ['غائم', '☁️', '☁️'],
    45: ['ضباب', '🌫️', '🌫️'],
    48: ['ضباب متجمّد', '🌫️', '🌫️'],
    51: ['رذاذ خفيف', '🌦️', '🌧️'],
    53: ['رذاذ', '🌦️', '🌧️'],
    55: ['رذاذ كثيف', '🌧️', '🌧️'],
    61: ['مطر خفيف', '🌦️', '🌧️'],
    63: ['مطر', '🌧️', '🌧️'],
    65: ['مطر غزير', '🌧️', '🌧️'],
    66: ['مطر متجمّد', '🌧️', '🌧️'],
    67: ['مطر متجمّد غزير', '🌧️', '🌧️'],
    71: ['ثلج خفيف', '🌨️', '🌨️'],
    73: ['ثلج', '❄️', '❄️'],
    75: ['ثلج كثيف', '❄️', '❄️'],
    77: ['حبيبات ثلج', '🌨️', '🌨️'],
    80: ['زخّات خفيفة', '🌦️', '🌧️'],
    81: ['زخّات', '🌧️', '🌧️'],
    82: ['زخّات عنيفة', '⛈️', '⛈️'],
    85: ['زخّات ثلجية', '🌨️', '🌨️'],
    86: ['زخّات ثلجية كثيفة', '❄️', '❄️'],
    95: ['عاصفة رعدية', '⛈️', '⛈️'],
    96: ['عاصفة مع برَد', '⛈️', '⛈️'],
    99: ['عاصفة مع برَد غزير', '⛈️', '⛈️'],
  }
  const row = table[code] ?? ['غير معروف', '🌡️', '🌡️']
  return { text: row[0], emoji: isDay ? row[1] : row[2] }
}

/** اتجاه الريح بالعربية من الدرجات. */
export function windDirectionAr(degrees: number): string {
  const names = ['شمالية', 'شمالية شرقية', 'شرقية', 'جنوبية شرقية',
    'جنوبية', 'جنوبية غربية', 'غربية', 'شمالية غربية']
  return names[Math.round(((degrees % 360) + 360) % 360 / 45) % 8]
}
