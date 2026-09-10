import { app } from 'electron'
import { log } from './startup'

/**
 * فحص التحديثات.
 *
 * **فحص وإخطار فقط، لا تنزيل ولا تثبيت تلقائي.** السبب: الملف غير موقّع رقميًا،
 * وتثبيت صامت لملف غير موقّع هو بالضبط سلوك البرمجيات الخبيثة — يستحقّ ارتياب
 * ويندوز ومكافح الفيروسات معًا. حين تُشترى شهادة توقيع يصير التحديث الصامت
 * خيارًا معقولًا؛ اليوم ليس كذلك.
 *
 * ولا مكتبة: نداء واحد إلى واجهة إصدارات GitHub يكفي، ولا يستحقّ إضافة
 * اعتمادية بحجم ميغابايتات إلى حزمة تُنزَّل بالكامل مع كل نسخة.
 */

const RELEASES_API =
  'https://api.github.com/repos/almarar88/ideashelf2/releases/latest'

export interface UpdateInfo {
  available: boolean
  current: string
  latest: string
  url: string
  notes: string
  checkedAt: number
  error: string
}

/**
 * يقارن نسختين بصيغة نقطية.
 *
 * يعيد موجبًا إن كانت `a` أحدث. يتجاهل ما بعد الرقم (مثل «1.2.0-beta») لأن
 * ترتيب الإصدارات التجريبية لا يعني شيئًا هنا: لا نُصدر منها.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) => String(value ?? '')
    .replace(/^v/i, '')
    .split(/[.\-+]/)
    .map((piece) => Number.parseInt(piece, 10))
    .map((piece) => (Number.isFinite(piece) ? piece : 0))

  const left = parts(a)
  const right = parts(b)
  const length = Math.max(left.length, right.length)

  for (let i = 0; i < length; i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference !== 0) return difference > 0 ? 1 : -1
  }
  return 0
}

let cache: UpdateInfo | null = null

/**
 * ست ساعات. حدّ GitHub للطلبات بلا مصادقة ٦٠ في الساعة لكل عنوان IP، وهو
 * سخيّ لمستخدم واحد. الذاكرة المؤقتة تحمي من الفحص مع كل فتح للنافذة، ومن
 * استنفاد الحدّ لمن يشترك عدّة مستخدمين في عنوان واحد خلف شبكة مؤسسة.
 */
const CACHE_MS = 6 * 3_600_000

/** يفحص آخر إصدار. `force` يتجاوز الذاكرة المؤقتة. */
export async function checkForUpdate(force = false): Promise<UpdateInfo> {
  const current = app.getVersion()

  if (!force && cache && Date.now() - cache.checkedAt < CACHE_MS) return cache

  const empty: UpdateInfo = {
    available: false,
    current,
    latest: '',
    url: '',
    notes: '',
    checkedAt: Date.now(),
    error: '',
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(RELEASES_API, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        // GitHub توثّق User-Agent كترويسة مطلوبة وترفض بدونها في بعض المسارات.
        'User-Agent': `AlcodeAi/${current}`,
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = (await response.json()) as {
      tag_name?: string
      name?: string
      html_url?: string
      body?: string
      assets?: { name?: string; browser_download_url?: string }[]
    }

    // اسم الحزمة يحمل النسخة (AlcodeAi-Setup-1.3.0.exe)، وهو أصدق من الوسم
    // لأن الوسم مرتبط برقم البناء لا بنسخة التطبيق.
    const installer = (data.assets ?? []).find(
      (asset) => /Setup-.*\.exe$/i.test(asset.name ?? ''),
    )
    const fromAsset = installer?.name?.match(/Setup-([\d.]+)\.exe/i)?.[1] ?? ''
    const latest = fromAsset || String(data.tag_name ?? '').replace(/^v/i, '')

    const info: UpdateInfo = {
      available: Boolean(latest) && compareVersions(latest, current) > 0,
      current,
      latest,
      url: installer?.browser_download_url || data.html_url || '',
      notes: String(data.body ?? '').slice(0, 600),
      checkedAt: Date.now(),
      error: '',
    }
    cache = info
    if (info.available) log(`يتوفّر تحديث: ${current} ← ${latest}`)
    return info
  } catch (error) {
    // فشل الفحص ليس خطأً يستحقّ إزعاج المستخدم: يبقى على نسخته.
    const message = error instanceof Error ? error.message : String(error)
    log('تعذّر فحص التحديثات', message)
    return { ...empty, error: message }
  } finally {
    clearTimeout(timer)
  }
}
