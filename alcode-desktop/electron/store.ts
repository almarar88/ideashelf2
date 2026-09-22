import { app } from 'electron'
import { PrayerConfig, defaultPrayerConfig } from './daily/prayer'
import { NewsSource } from './daily/news'
import { Place } from './daily/weather'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'

/**
 * تخزين محلّي بسيط: ملف JSON لكل مجموعة داخل مجلد بيانات التطبيق.
 *
 * لا قاعدة بيانات ولا خادم — البيانات صغيرة وتبقى على جهاز المستخدم وحده،
 * والكتابة ذرّية (ملف مؤقت ثم إعادة تسمية) حتى لا يتلف الملف عند انقطاع.
 */
/** كائن عادي — لا مصفوفة ولا null ولا صنف. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class JsonStore<T> {
  private cache: T | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(private readonly file: string, private readonly fallback: T) {}

  private path(): string {
    return join(app.getPath('userData'), this.file)
  }

  async load(): Promise<T> {
    if (this.cache !== null) return this.cache
    try {
      const raw = await fs.readFile(this.path(), 'utf8')
      this.cache = this.reconcile(JSON.parse(raw))
    } catch {
      this.cache = this.fallback
    }
    return this.cache
  }

  /**
   * يدمج المقروء فوق الافتراضي.
   *
   * بدون هذا يبقى كل حقل أُضيف في نسخة لاحقة `undefined` عند من رقّى من نسخة
   * أقدم — لأن الملف على قرصه كُتب قبل وجود الحقل. النتيجة انهيار عند أول
   * `settings.<حقل جديد>.trim()` أو `.map()`، ولا يظهر أبدًا في اختبار على
   * جهاز نظيف. الدمج طبقتان: الجذر، وأي كائن بسيط داخله مثل إعدادات الصلاة.
   */
  private reconcile(parsed: unknown): T {
    if (!isPlainObject(this.fallback) || !isPlainObject(parsed)) {
      // مصفوفة أو قيمة مفردة: تُؤخذ كما هي، والفارغ يعود للافتراضي.
      return (parsed ?? this.fallback) as T
    }
    const base = this.fallback as Record<string, unknown>
    const merged: Record<string, unknown> = { ...base }
    for (const [name, value] of Object.entries(parsed)) {
      if (value === undefined) continue
      const fallbackValue = base[name]
      merged[name] = isPlainObject(fallbackValue) && isPlainObject(value)
        ? { ...fallbackValue, ...value }
        : value
    }
    return merged as T
  }

  async save(value: T): Promise<void> {
    this.cache = value
    const target = this.path()
    const temp = `${target}.tmp`
    // نسلسل الكتابات: كتابتان متزامنتان على الملف نفسه تتلفانه.
    this.writing = this.writing.then(async () => {
      await fs.mkdir(join(app.getPath('userData')), { recursive: true })
      await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8')
      await fs.rename(temp, target)
    }).catch(() => {})
    return this.writing
  }

  async update(fn: (current: T) => T): Promise<T> {
    const next = fn(await this.load())
    await this.save(next)
    return next
  }
}

export interface Memory {
  id: string
  text: string
  category: string
  createdAt: number
}

export interface Note {
  id: string
  title: string
  body: string
  createdAt: number
}

export interface Reminder {
  id: string
  text: string
  /** توقيت التنبيه بالمللي ثانية منذ الحقبة. */
  at: number
  done: boolean
}

export interface Task {
  id: string
  title: string
  note: string
  /** yyyy-MM-dd */
  dueDate: string | null
  /** HH:mm */
  dueTime: string | null
  priority: number
  done: boolean
  createdAt: number
  /** daily | weekly | monthly */
  repeat: string | null
}

export interface Habit {
  id: string
  title: string
  emoji: string
  targetPerDay: number
  /** yyyy-MM-dd -> عدد المرات */
  log: Record<string, number>
  createdAt: number
}

export interface Settings {
  apiKey: string
  model: string
  effort: string
  dialect: string
  webSearch: boolean
  confirmDanger: boolean
  hotkey: string
  launchAtLogin: boolean
  theme: 'light' | 'dark' | 'system'
  userName: string
  persona: string

  // ---- الرفيق اليومي
  place: Place | null
  prayer: PrayerConfig
  hijriOffset: number
  use24h: boolean
  /** معرّفات المصادر المعطّلة — نخزّن الاستثناء لا القائمة كاملة. */
  disabledSources: string[]
  /** مصادر أضافها المستخدم بنفسه. */
  customSources: NewsSource[]
  /** مواضيع يتابعها بكلماته. */
  topics: string[]
  newsRefreshMinutes: number
  /** تنبيه عند كل صلاة. */
  prayerAlerts: boolean
  /** هل أُنجزت تهيئة أول تشغيل؟ */
  onboarded: boolean

  // ---- الصوت
  /** مفتاح ElevenLabs — لا يغادر العملية الرئيسية. */
  elevenKey: string
  voiceId: string
  voiceModel: string
  /** ثبات النبرة: أقل = تعبير أكثر وتذبذب أكثر. */
  voiceStability: number
  voiceSimilarity: number
  voiceSpeed: number
  /** لغة التفريغ: رمز ISO أو «auto». */
  sttLanguage: string
  /** ينطق ردود المساعد تلقائيًا. */
  autoSpeak: boolean
  /** يرسل الأمر فور انتهاء التفريغ بدل وضعه في الحقل. */
  voiceAutoSend: boolean
  /** ملخّص الصباح كإشعار، بالساعة والدقيقة (HH:mm) أو فراغ لتعطيله. */
  morningBriefAt: string
}

export const defaultSettings: Settings = {
  apiKey: '',
  model: 'claude-sonnet-5',
  effort: 'low',
  dialect: 'emirati',
  webSearch: true,
  // على ويندوز التأكيد مفعّل افتراضيًا — أمر واحد خاطئ هنا قد يفقد عمل يوم،
  // بخلاف الهاتف حيث أسوأ الأخطاء قابل للتراجع.
  confirmDanger: true,
  hotkey: 'Control+Space',
  launchAtLogin: false,
  theme: 'system',
  userName: '',
  persona: '',

  place: null,
  prayer: defaultPrayerConfig,
  hijriOffset: 0,
  use24h: true,
  disabledSources: [],
  customSources: [],
  topics: [],
  newsRefreshMinutes: 30,
  prayerAlerts: true,
  onboarded: false,

  elevenKey: '',
  voiceId: '',
  // الافتراضي: نموذج الحوار — جودة عالية وزمن استجابة يناسب مساعدًا يُجاوب.
  voiceModel: 'eleven_v3_conversational',
  voiceStability: 0.5,
  voiceSimilarity: 0.75,
  voiceSpeed: 1,
  sttLanguage: 'ar',
  autoSpeak: false,
  voiceAutoSend: true,
  morningBriefAt: '07:00',
}

export const stores = {
  tasks: new JsonStore<Task[]>('tasks.json', []),
  habits: new JsonStore<Habit[]>('habits.json', []),
  settings: new JsonStore<Settings>('settings.json', defaultSettings),
  memories: new JsonStore<Memory[]>('memories.json', []),
  notes: new JsonStore<Note[]>('notes.json', []),
  reminders: new JsonStore<Reminder[]>('reminders.json', []),
  conversations: new JsonStore<any[]>('conversations.json', []),
  /** آخر يوم أُرسل فيه ملخّص الصباح — على القرص ليصمد بين التشغيلات. */
  brief: new JsonStore<{ on: string }>('brief.json', { on: '' }),
  /** المفتاح المفعَّل ووقت أول تشغيل (بداية عدّاد التجربة). */
  license: new JsonStore<{ key: string; firstRunAt: number }>(
    'license.json', { key: '', firstRunAt: 0 },
  ),
  usage: new JsonStore<{ input: number; output: number; cached: number; requests: number }>(
    'usage.json', { input: 0, output: 0, cached: 0, requests: 0 },
  ),
}
