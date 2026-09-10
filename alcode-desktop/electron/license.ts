import { createPublicKey, verify } from 'node:crypto'
import { PUBLIC_KEY_PEM } from './licenseKey'
import { stores } from './store'

/**
 * الترخيص.
 *
 * التحقّق **دون خادم**: المفتاح موقّع بـ Ed25519 بمفتاح خاصّ لدى البائع،
 * والتطبيق يحمل المفتاح العامّ فقط فيتحقّق محليًّا. لا خادم يُدفع ثمنه، ولا
 * عطل حين ينقطع الإنترنت، ولا بيانات مشتري تمرّ بطرف ثالث.
 *
 * الثمن المقبول لهذا الاختيار: لا يمكن إبطال مفتاح مسرَّب. البديل — تحقّق عبر
 * خادم — يشتري الإبطال بثمن بنية تحتية دائمة وتعطّل عند انقطاع الشبكة، وهو
 * ثمن باهظ لمنتج فردي في بدايته. يمكن الانتقال إليه لاحقًا بلا تغيير الواجهة.
 */

export type Tier = 'free' | 'pro'

export interface LicensePayload {
  /** بريد المشتري — يُعرض له، ويجعل مشاركة المفتاح مشاركة لهويته. */
  email: string
  tier: Tier
  /** ثوانٍ منذ الحقبة، أو صفر لترخيص دائم. */
  expiresAt: number
  issuedAt: number
}

export interface LicenseState {
  tier: Tier
  /** المصدر: مفتاح مفعّل، أو فترة تجربة، أو نسخة بلا ترخيص أصلًا. */
  source: 'licensed' | 'trial' | 'unlicensed-build' | 'none'
  email: string
  expiresAt: number
  /** أيام متبقّية في التجربة (صفر إن لم تكن تجربة). */
  trialDaysLeft: number
  valid: boolean
  message: string
}

export const TRIAL_DAYS = 14

/**
 * هل هذا البناء مرخَّص أصلًا؟
 *
 * بلا مفتاح عامّ لا يمكن التحقّق من شيء، فيعمل كل شيء بلا قيد — وهذا سلوك
 * مقصود: من يبني من المصدر لنفسه لا يُحجب عنه ما كتبه، والقيد يبدأ فقط حين
 * يضع البائع مفتاحه العامّ قبل البناء للتوزيع.
 */
export function licensingEnabled(): boolean {
  return PUBLIC_KEY_PEM.trim().length > 0
}

function decode(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/**
 * يتحقّق من مفتاح ويعيد حمولته.
 *
 * الشكل: ‎ALC1.<الحمولة>.<التوقيع>‎ — الجزآن بترميز base64url.
 * أي خلل في الشكل أو التوقيع يعيد null بلا استثناء: مفتاح تالف حالة متوقّعة
 * لا خطأ برمجي، والمستخدم يلصق ما يلصق.
 */
export function verifyKey(key: string): LicensePayload | null {
  if (!licensingEnabled()) return null

  const parts = String(key ?? '').trim().split('.')
  if (parts.length !== 3 || parts[0] !== 'ALC1') return null

  let publicKey
  try {
    publicKey = createPublicKey(PUBLIC_KEY_PEM)
  } catch {
    return null
  }

  const payloadRaw = decode(parts[1])
  const signature = decode(parts[2])
  if (!payloadRaw.length || !signature.length) return null

  let good = false
  try {
    // Ed25519 لا يأخذ خوارزمية تلخيص، ولهذا الوسيط الأول null.
    good = verify(null, payloadRaw, publicKey, signature)
  } catch {
    return null
  }
  if (!good) return null

  try {
    const parsed = JSON.parse(payloadRaw.toString('utf8')) as Record<string, unknown>
    const tier = parsed.tier === 'pro' ? 'pro' : 'free'
    return {
      email: String(parsed.email ?? ''),
      tier,
      expiresAt: Number(parsed.expiresAt ?? 0),
      issuedAt: Number(parsed.issuedAt ?? 0),
    }
  } catch {
    return null
  }
}

/** هل انتهت صلاحية الحمولة؟ الصفر يعني دائمًا. */
export function isExpired(payload: LicensePayload, now = Date.now()): boolean {
  return payload.expiresAt > 0 && payload.expiresAt * 1000 < now
}

/** الأيام المتبقّية من التجربة اعتمادًا على أول تشغيل. */
export function trialDaysLeft(firstRunAt: number, now = Date.now()): number {
  if (!firstRunAt) return TRIAL_DAYS
  const used = Math.floor((now - firstRunAt) / 86_400_000)
  return Math.max(0, TRIAL_DAYS - used)
}

/**
 * الحالة الحالية: مفتاح مفعّل أولًا، ثم التجربة، ثم المجّاني.
 * دالة خالصة عمدًا ليختبرها الاختبار بلا قرص ولا ساعة نظام.
 */
export function resolveState(
  storedKey: string,
  firstRunAt: number,
  now = Date.now(),
): LicenseState {
  if (!licensingEnabled()) {
    return {
      tier: 'pro',
      source: 'unlicensed-build',
      email: '',
      expiresAt: 0,
      trialDaysLeft: 0,
      valid: true,
      message: '',
    }
  }

  const payload = storedKey ? verifyKey(storedKey) : null

  if (payload && !isExpired(payload, now)) {
    return {
      tier: payload.tier,
      source: 'licensed',
      email: payload.email,
      expiresAt: payload.expiresAt,
      trialDaysLeft: 0,
      valid: true,
      message: '',
    }
  }

  const left = trialDaysLeft(firstRunAt, now)
  if (left > 0) {
    return {
      tier: 'pro',
      source: 'trial',
      email: '',
      expiresAt: 0,
      trialDaysLeft: left,
      valid: true,
      // المفتاح المنتهي يُقال صراحةً: أسوأ من انتهاء الاشتراك ألّا يُعرف سببه.
      message: payload ? 'انتهت صلاحية مفتاحك — أنت الآن في الفترة التجريبية.' : '',
    }
  }

  return {
    tier: 'free',
    source: payload ? 'licensed' : 'none',
    email: payload?.email ?? '',
    expiresAt: payload?.expiresAt ?? 0,
    trialDaysLeft: 0,
    valid: false,
    message: payload
      ? 'انتهت صلاحية مفتاحك. جدّده لتعود ميزات المساعد.'
      : 'انتهت الفترة التجريبية. الرفيق اليومي يبقى مجّانًا بالكامل.',
  }
}

/** الحالة كما هي على القرص الآن. */
export async function currentState(now = Date.now()): Promise<LicenseState> {
  const license = await stores.license.load()
  return resolveState(license.key, license.firstRunAt, now)
}

/** يسجّل أول تشغيل مرّة واحدة — بداية عدّاد التجربة. */
export async function ensureFirstRun(): Promise<void> {
  await stores.license.update((current) => (
    current.firstRunAt ? current : { ...current, firstRunAt: Date.now() }
  ))
}
