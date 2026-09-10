import { isWindows, runPs } from '../ps'
import { Place } from './weather'

/**
 * تحديد الموقع تلقائيًا.
 *
 * الطريق الأول والمفضّل: خدمة الموقع في ويندوز نفسها عبر
 * `System.Device.Location.GeoCoordinateWatcher`. هذه هي الواجهة التي تحترم
 * إعداد الخصوصية في ويندوز: إن كان الوصول ممنوعًا يعيد النظام «مرفوض» ولا
 * يسرّب شيئًا، وإن كان مسموحًا يأتي الموقع من الجهاز بلا وسيط.
 *
 * الطريق الثاني (اختياري وبطلب صريح): تقدير من عنوان IP. مقايضة صريحة —
 * يعرف مزوّد الخدمة عنوانك، لذا لا يُستدعى إلا إذا فشل الأول وطلب المستخدم ذلك.
 */

export type LocateStatus = 'ok' | 'denied' | 'unavailable' | 'timeout' | 'not-windows'

export interface LocateResult {
  status: LocateStatus
  latitude: number
  longitude: number
  accuracyMeters: number
  /** من أين جاء الموقع، ليُعرض للمستخدم بصدق. */
  source: 'windows' | 'ip' | 'none'
  message: string
}

const NOWHERE: LocateResult = {
  status: 'unavailable',
  latitude: 0,
  longitude: 0,
  accuracyMeters: 0,
  source: 'none',
  message: '',
}

/** يقرأ الموقع من خدمة ويندوز. يعيد «مرفوض» إن أطفأ المستخدم الصلاحية. */
export async function locateViaWindows(): Promise<LocateResult> {
  if (!isWindows) {
    return { ...NOWHERE, status: 'not-windows', message: 'خدمة موقع ويندوز غير متاحة على هذا النظام.' }
  }

  // ننتظر حتى ٢٠ ثانية: أول قراءة قد تحتاج تشغيل الخدمة وتثبيت الإشارة.
  // كل شيء داخل try: بلا هذا يتسرّب أثر خطأ .NET خامًا إلى واجهة عربية
  // حين لا تتوفّر System.Device (مثلًا لو نُفّذ تحت PowerShell 7 لا 5.1).
  const script = `
$ErrorActionPreference = 'Stop'
try {
Add-Type -AssemblyName System.Device
$watcher = New-Object System.Device.Location.GeoCoordinateWatcher
$watcher.Start()
$deadline = (Get-Date).AddSeconds(20)
while ($watcher.Status -ne 'Ready' -and $watcher.Permission -ne 'Denied' -and (Get-Date) -lt $deadline) {
  Start-Sleep -Milliseconds 200
}
if ($watcher.Permission -eq 'Denied') {
  $watcher.Stop()
  Write-Output (ConvertTo-Json @{ status = 'denied' })
  exit 0
}
if ($watcher.Status -ne 'Ready') {
  $watcher.Stop()
  Write-Output (ConvertTo-Json @{ status = 'timeout' })
  exit 0
}
$location = $watcher.Position.Location
$watcher.Stop()
if ($location.IsUnknown) {
  Write-Output (ConvertTo-Json @{ status = 'unavailable' })
  exit 0
}
Write-Output (ConvertTo-Json @{
  status = 'ok'
  latitude = $location.Latitude
  longitude = $location.Longitude
  accuracy = $location.HorizontalAccuracy
})
} catch {
  Write-Output (ConvertTo-Json @{ status = 'unavailable' })
  exit 0
}
`

  const result = await runPs(script, {}, 30_000)
  if (!result.ok) {
    return { ...NOWHERE, message: result.stderr.trim() || 'تعذّر تشغيل خدمة الموقع.' }
  }

  let parsed: { status?: string; latitude?: number; longitude?: number; accuracy?: number }
  try {
    parsed = JSON.parse(result.stdout.trim())
  } catch {
    return { ...NOWHERE, message: 'ردّ غير مفهوم من خدمة الموقع.' }
  }

  if (parsed.status === 'denied') {
    return {
      ...NOWHERE,
      status: 'denied',
      message: 'صلاحية الموقع مرفوضة في ويندوز. افتح إعدادات الخصوصية ← الموقع وفعّلها.',
    }
  }
  if (parsed.status === 'timeout') {
    return { ...NOWHERE, status: 'timeout', message: 'خدمة الموقع لم تردّ خلال ٢٠ ثانية.' }
  }
  if (parsed.status !== 'ok' || typeof parsed.latitude !== 'number') {
    return { ...NOWHERE, message: 'خدمة الموقع مشغّلة لكنها لا تعرف موقعك بعد.' }
  }

  return {
    status: 'ok',
    latitude: parsed.latitude,
    longitude: parsed.longitude as number,
    accuracyMeters: Number(parsed.accuracy ?? 0),
    source: 'windows',
    message: '',
  }
}

/** تقدير من عنوان IP — بطلب صريح فقط. */
export async function locateViaIp(): Promise<LocateResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch('https://ipwho.is/', { signal: controller.signal })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = (await response.json()) as {
      success?: boolean
      latitude?: number
      longitude?: number
      city?: string
      country?: string
      region?: string
      timezone?: { id?: string }
    }
    if (data.success === false || typeof data.latitude !== 'number') {
      return { ...NOWHERE, message: 'خدمة تقدير IP لم تعرف موقعك.' }
    }
    return {
      status: 'ok',
      latitude: data.latitude,
      longitude: data.longitude as number,
      // تقدير IP يخطئ بعشرات الكيلومترات عادة؛ نصرّح بذلك ولا نتظاهر بالدقة.
      accuracyMeters: 25_000,
      source: 'ip',
      message: '',
    }
  } catch (error) {
    return {
      ...NOWHERE,
      message: error instanceof Error ? error.message : 'تعذّر الوصول إلى خدمة تقدير IP.',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * يحوّل إحداثيات إلى مكان كامل (اسم، منطقة زمنية، ارتفاع).
 *
 * المنطقة الزمنية والارتفاع من Open-Meteo — الخدمة المستعملة أصلًا للطقس،
 * فلا نضيف طرفًا ثالثًا جديدًا. الاسم من خدمة عكسية إن توفّرت، وإلا
 * فالإحداثيات نفسها: مكان بلا اسم أصدق من اسم مختلق.
 */
export async function placeFromCoordinates(
  latitude: number,
  longitude: number,
): Promise<Place> {
  let timezone = 'auto'
  let elevation = 0
  try {
    const url = 'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${latitude}&longitude=${longitude}&timezone=auto&current=temperature_2m`
    const response = await fetch(url)
    if (response.ok) {
      const data = (await response.json()) as { timezone?: string; elevation?: number }
      if (data.timezone) timezone = data.timezone
      if (typeof data.elevation === 'number') elevation = data.elevation
    }
  } catch {
    // بلا منطقة زمنية يعود المحرّك إلى منطقة الجهاز، وهي الصحيحة غالبًا.
  }

  let name = ''
  let admin = ''
  let country = ''
  try {
    const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client' +
      `?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`
    const response = await fetch(url)
    if (response.ok) {
      const data = (await response.json()) as {
        city?: string
        locality?: string
        principalSubdivision?: string
        countryName?: string
      }
      name = data.city || data.locality || ''
      admin = data.principalSubdivision || ''
      country = data.countryName || ''
    }
  } catch {
    // الاسم زينة؛ الحساب كله على الإحداثيات.
  }

  return {
    name: name || `موقعي (${latitude.toFixed(3)}، ${longitude.toFixed(3)})`,
    country,
    admin,
    latitude,
    longitude,
    timezone,
    elevation,
  }
}
