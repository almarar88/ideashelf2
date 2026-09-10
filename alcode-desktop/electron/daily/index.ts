import { Settings, stores } from '../store'
import { calculate, DayPrayers, isoDate, nextPrayer, PrayerKey, PRAYERS, distanceToKaaba, qiblaBearing } from './prayer'
import { Article, DEFAULT_SOURCES, fetchNews, NewsSource, topicSource } from './news'
import { fetchWeather, WeatherBundle, describeWeather } from './weather'
import { hijriParts, isRamadan, longGregorianAr, longHijriAr } from './dates'

/**
 * طبقة «الرفيق اليومي»: تجمع الصلاة والطقس والأخبار في مكان واحد،
 * وتخزّن ما جُلب مؤقتًا حتى لا يُعاد الطلب مع كل فتح للنافذة.
 */

let weatherCache: { bundle: WeatherBundle; at: number } | null = null
let newsCache: { articles: Article[]; at: number } | null = null

const WEATHER_TTL = 20 * 60_000

/** المصادر الفعّالة: الافتراضية بعد استبعاد المعطّل، ثم المخصّصة والمواضيع. */
export function activeSources(settings: Settings): NewsSource[] {
  const disabled = new Set(settings.disabledSources)
  return [
    ...DEFAULT_SOURCES.map((source) => ({ ...source, enabled: !disabled.has(source.id) })),
    ...settings.customSources,
    ...settings.topics.map(topicSource),
  ]
}

export async function getWeather(force = false): Promise<WeatherBundle | null> {
  const settings = await stores.settings.load()
  if (!settings.place) return null

  const fresh = weatherCache && Date.now() - weatherCache.at < WEATHER_TTL
  if (fresh && !force) return weatherCache!.bundle

  try {
    const bundle = await fetchWeather(settings.place)
    weatherCache = { bundle, at: Date.now() }
    return bundle
  } catch {
    // الشبكة تسقط أحيانًا؛ آخر نسخة أفضل من لا شيء.
    return weatherCache?.bundle ?? null
  }
}

export async function getNews(force = false): Promise<Article[]> {
  const settings = await stores.settings.load()
  const ttl = Math.max(5, settings.newsRefreshMinutes) * 60_000
  if (newsCache && Date.now() - newsCache.at < ttl && !force) return newsCache.articles

  try {
    const articles = await fetchNews(activeSources(settings))
    if (articles.length) newsCache = { articles, at: Date.now() }
    return articles.length ? articles : newsCache?.articles ?? []
  } catch {
    return newsCache?.articles ?? []
  }
}

export function prayersFor(settings: Settings, date: Date): DayPrayers | null {
  if (!settings.place) return null
  return calculate(
    date,
    settings.place.latitude,
    settings.place.longitude,
    { ...settings.prayer, elevationMeters: settings.place.elevation || 0 },
    settings.place.timezone && settings.place.timezone !== 'auto'
      ? settings.place.timezone
      : undefined,
    isRamadan(date, settings.hijriOffset),
  )
}

export interface DayBundle {
  today: string
  gregorian: string
  hijri: string
  place: string | null
  prayers: { key: PrayerKey; arabic: string; at: number }[] | null
  next: { key: PrayerKey; arabic: string; at: number } | null
  weather: WeatherBundle | null
  /** وصف عربي وأيقونة للحالة الآن — الواجهة لا تعيد ترجمة رموز WMO. */
  weatherText: string
  weatherEmoji: string
  headlines: Article[]
  tasksOpen: number
  tasksDone: number
  /** أقرب المهام المفتوحة، لتُعرض في الشاشة الرئيسية بلا طلب ثانٍ. */
  topTasks: { id: string; title: string; dueDate: string; done: boolean }[]
  habitsTotal: number
  habitsDone: number
  topHabits: { id: string; title: string; emoji: string; today: number; target: number }[]
  /** اتجاه القبلة بالدرجات والمسافة بالكيلومترات. */
  qibla: { bearing: number; distanceKm: number } | null
}

/** كل ما تحتاجه الشاشة الرئيسية في طلب واحد. */
export async function getDay(): Promise<DayBundle> {
  const settings = await stores.settings.load()
  const now = new Date()
  const day = prayersFor(settings, now)
  const tasks = await stores.tasks.load()

  const [weather, articles, habits] = await Promise.all([
    getWeather(), getNews(), stores.habits.load(),
  ])

  const key = isoDate(now)
  const info = weather
    ? describeWeather(weather.now.weatherCode, weather.now.isDay)
    : { text: '', emoji: '' }

  return {
    today: isoDate(now),
    gregorian: longGregorianAr(now),
    hijri: longHijriAr(now, settings.hijriOffset),
    place: settings.place
      ? [settings.place.name, settings.place.country].filter(Boolean).join('، ')
      : null,
    prayers: day
      ? PRAYERS.map((p) => ({ key: p.key, arabic: p.arabic, at: day.times[p.key] }))
      : null,
    next: day ? nextPrayer(day, now.getTime()) : null,
    weather,
    weatherText: info.text,
    weatherEmoji: info.emoji,
    headlines: articles.slice(0, 12),
    tasksOpen: tasks.filter((t) => !t.done).length,
    tasksDone: tasks.filter((t) => t.done).length,
    topTasks: tasks
      .filter((t) => !t.done)
      // الأقرب موعدًا أولًا، وما بلا موعد في الآخر.
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
      .slice(0, 4)
      .map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate ?? '', done: t.done })),
    habitsTotal: habits.length,
    habitsDone: habits.filter((h) => (h.log[key] ?? 0) >= h.targetPerDay).length,
    topHabits: habits.slice(0, 4).map((h) => ({
      id: h.id,
      title: h.title,
      emoji: h.emoji,
      today: h.log[key] ?? 0,
      target: h.targetPerDay,
    })),
    qibla: settings.place
      ? {
        bearing: qiblaBearing(settings.place.latitude, settings.place.longitude),
        distanceKm: distanceToKaaba(settings.place.latitude, settings.place.longitude),
      }
      : null,
  }
}

/**
 * ملخّص نصّي موجز يُحقن في سياق المساعد.
 *
 * مختصر عمدًا: كل سطر زائد هنا يُدفع ثمنه في كل رسالة.
 */
export async function contextSummary(): Promise<string> {
  const settings = await stores.settings.load()
  const now = new Date()
  const lines: string[] = []

  lines.push(`التاريخ: ${longGregorianAr(now)} — ${longHijriAr(now, settings.hijriOffset)}`)
  if (settings.place) lines.push(`الموقع: ${settings.place.name}`)

  const day = prayersFor(settings, now)
  if (day) {
    const upcoming = nextPrayer(day, now.getTime())
    if (upcoming) {
      const time = new Intl.DateTimeFormat('ar', {
        hour: '2-digit', minute: '2-digit', hour12: !settings.use24h,
      }).format(new Date(upcoming.at))
      lines.push(`الصلاة القادمة: ${upcoming.arabic} ${time}`)
    }
  }

  const weather = weatherCache?.bundle
  if (weather) {
    const info = describeWeather(weather.now.weatherCode, weather.now.isDay)
    const today = weather.daily[0]
    lines.push(
      `الطقس: ${info.text} ${Math.round(weather.now.temperature)}°` +
      (today ? `، اليوم ${Math.round(today.max)}°/${Math.round(today.min)}°` +
        `، مطر ${today.precipitationProbability}%` : ''),
    )
  }

  const tasks = (await stores.tasks.load()).filter((t) => !t.done)
  if (tasks.length) {
    lines.push(`مهام مفتوحة (${tasks.length}): ` +
      tasks.slice(0, 6).map((t) => t.title + (t.dueDate ? ` [${t.dueDate}]` : '')).join('، '))
  }

  const habits = await stores.habits.load()
  const key = isoDate(now)
  const left = habits.filter((h) => (h.log[key] ?? 0) < h.targetPerDay)
  if (left.length) {
    lines.push('عادات لم تكتمل: ' + left.slice(0, 5).map((h) => h.title).join('، '))
  }

  if (newsCache?.articles.length) {
    lines.push('عناوين: ' +
      newsCache.articles.slice(0, 5).map((a) => a.title).join(' | '))
  }

  return lines.join('\n')
}

export { hijriParts, isRamadan }
