import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { log } from './startup'
import { stores } from './store'

/**
 * الصوت: نطق ElevenLabs وتفريغ Scribe.
 *
 * كل النداءات من العملية الرئيسية، ومفتاح ElevenLabs لا يغادرها — كما مفتاح
 * Anthropic تمامًا. واجهة العرض ترسل نصًّا وتستقبل صوتًا، ولا ترى مفتاحًا قطّ.
 *
 * النقاط والنماذج مأخوذة من توثيق ElevenLabs لا من الذاكرة:
 *   POST /v1/text-to-speech/{voice_id}   ترويسة xi-api-key
 *   POST /v1/speech-to-text              multipart، model_id + file
 *   GET  /v1/voices، GET /v1/models
 */

const BASE = 'https://api.elevenlabs.io/v1'

/** نماذج النطق التي تدعم العربية. eleven_flash_v2 مستبعَد: إنجليزي فقط. */
export const TTS_MODELS = [
  {
    id: 'eleven_v3_conversational',
    arabic: 'محادثة v3 — الأنسب للمساعد',
    hint: 'جودة عالية وزمن استجابة ~٢٨٠ مللي ثانية، مصمَّم للحوار',
  },
  {
    id: 'eleven_flash_v2_5',
    arabic: 'Flash v2.5 — الأسرع والأرخص',
    hint: 'زمن استجابة ~٧٥ مللي ثانية، جودة جيدة',
  },
  {
    id: 'eleven_v3',
    arabic: 'v3 — الأعلى جودة',
    hint: 'أفضل أداء تعبيري، أبطأ قليلًا',
  },
  {
    id: 'eleven_multilingual_v2',
    arabic: 'متعدّد اللغات v2',
    hint: 'النموذج الافتراضي لدى ElevenLabs، جودة عالية',
  },
]

export const STT_MODEL = 'scribe_v2'

export interface Voice {
  id: string
  name: string
  description: string
  language: string
  accent: string
  gender: string
  previewUrl: string
}

async function key(): Promise<string> {
  return (await stores.settings.load()).elevenKey.trim()
}

function headers(apiKey: string): Record<string, string> {
  return { 'xi-api-key': apiKey }
}

/** أصوات حساب المستخدم. لا نضمّن معرّفات ثابتة: لا تعمل خارج حسابه. */
export async function listVoices(): Promise<{ ok: boolean; voices: Voice[]; error: string }> {
  const apiKey = await key()
  if (!apiKey) return { ok: false, voices: [], error: 'ما في مفتاح ElevenLabs.' }

  try {
    const response = await fetch(`${BASE}/voices`, { headers: headers(apiKey) })
    if (!response.ok) throw new Error(await describe(response))
    const data = (await response.json()) as { voices?: any[] }
    const voices: Voice[] = (data.voices ?? []).map((one) => ({
      id: String(one.voice_id ?? ''),
      name: String(one.name ?? ''),
      description: String(one.description ?? ''),
      language: String(one.labels?.language ?? ''),
      accent: String(one.labels?.accent ?? ''),
      gender: String(one.labels?.gender ?? ''),
      previewUrl: String(one.preview_url ?? ''),
    })).filter((one) => one.id)

    // العربية أولًا: هذا تطبيق عربي، وترتيب ElevenLabs الافتراضي إنجليزي.
    voices.sort((a, b) => {
      const arabicA = a.language.startsWith('ar') || a.accent.startsWith('ar') ? 0 : 1
      const arabicB = b.language.startsWith('ar') || b.accent.startsWith('ar') ? 0 : 1
      return arabicA - arabicB
    })
    return { ok: true, voices, error: '' }
  } catch (error) {
    return { ok: false, voices: [], error: friendlyVoice(error) }
  }
}

async function describe(response: Response): Promise<string> {
  const text = await response.text().catch(() => '')
  try {
    const parsed = JSON.parse(text)
    const detail = parsed?.detail
    if (typeof detail === 'string') return detail
    if (detail?.message) return String(detail.message)
  } catch {
    // ليس JSON — نستعمل الحالة وحدها.
  }
  return `HTTP ${response.status}`
}

export function friendlyVoice(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/401|unauthorized|invalid_api_key/i.test(message)) return 'مفتاح ElevenLabs غير صالح.'
  if (/quota|credit|402/i.test(message)) return 'رصيد ElevenLabs انتهى.'
  if (/429/i.test(message)) return 'طلبات كثيرة على ElevenLabs — انتظر لحظة.'
  if (/voice.*not.*found|404/i.test(message)) return 'الصوت المختار غير موجود في حسابك.'
  if (/fetch failed|ENOTFOUND|ETIMEDOUT/i.test(message)) return 'ما في اتصال بالإنترنت.'
  return message
}

// -------------------------------------------------------- ذاكرة النطق

/**
 * تخزين مؤقت على القرص بمفتاح (نصّ + صوت + نموذج).
 *
 * ElevenLabs يحاسب بالحرف، والمساعد يكرّر عبارات بعينها كثيرًا («تمّ»، «ما
 * لقيت شيئًا»). نطق العبارة نفسها مرّتين دفعٌ مرّتين بلا فائدة.
 */
function cacheDir(): string {
  return join(app.getPath('userData'), 'voice-cache')
}

export function cacheKey(text: string, voiceId: string, modelId: string): string {
  return createHash('sha256').update(`${voiceId}|${modelId}|${text}`).digest('hex').slice(0, 32)
}

async function readCache(hash: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(join(cacheDir(), `${hash}.mp3`))
  } catch {
    return null
  }
}

async function writeCache(hash: string, audio: Buffer): Promise<void> {
  try {
    await fs.mkdir(cacheDir(), { recursive: true })
    await fs.writeFile(join(cacheDir(), `${hash}.mp3`), audio)
  } catch {
    // الذاكرة المؤقتة تحسين لا شرط.
  }
}

/** يمسح ذاكرة النطق ويعيد ما حُرّر بالبايت. */
export async function clearVoiceCache(): Promise<number> {
  let freed = 0
  try {
    const dir = cacheDir()
    for (const name of await fs.readdir(dir)) {
      const path = join(dir, name)
      freed += (await fs.stat(path)).size
      await fs.unlink(path)
    }
  } catch {
    // لا مجلد بعد.
  }
  return freed
}

export async function voiceCacheSize(): Promise<number> {
  let total = 0
  try {
    const dir = cacheDir()
    for (const name of await fs.readdir(dir)) {
      total += (await fs.stat(join(dir, name))).size
    }
  } catch {
    // لا مجلد بعد.
  }
  return total
}

// ---------------------------------------------------------------- نطق

export interface SpeakResult {
  ok: boolean
  /** mp3 بترميز base64 لتشغّله الواجهة. */
  audio: string
  cached: boolean
  error: string
}

export async function speak(text: string): Promise<SpeakResult> {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, audio: '', cached: false, error: '' }

  const settings = await stores.settings.load()
  const apiKey = settings.elevenKey.trim()
  if (!apiKey) return { ok: false, audio: '', cached: false, error: 'ما في مفتاح ElevenLabs.' }
  if (!settings.voiceId) {
    return { ok: false, audio: '', cached: false, error: 'اختر صوتًا من الإعدادات أولًا.' }
  }

  const hash = cacheKey(trimmed, settings.voiceId, settings.voiceModel)
  const cached = await readCache(hash)
  if (cached) {
    return { ok: true, audio: cached.toString('base64'), cached: true, error: '' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${BASE}/text-to-speech/${settings.voiceId}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { ...headers(apiKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: trimmed,
        model_id: settings.voiceModel,
        // mp3 بـ٤٤.١ كيلوهرتز و١٢٨ كيلوبت: الافتراضي الموثّق، ويكفي للكلام.
        output_format: 'mp3_44100_128',
        voice_settings: {
          stability: settings.voiceStability,
          similarity_boost: settings.voiceSimilarity,
          speed: settings.voiceSpeed,
          use_speaker_boost: true,
        },
      }),
    })
    if (!response.ok) throw new Error(await describe(response))

    const audio = Buffer.from(await response.arrayBuffer())
    await writeCache(hash, audio)
    return { ok: true, audio: audio.toString('base64'), cached: false, error: '' }
  } catch (error) {
    const message = friendlyVoice(error)
    log('تعذّر النطق', message)
    return { ok: false, audio: '', cached: false, error: message }
  } finally {
    clearTimeout(timer)
  }
}

// ------------------------------------------------------------- تفريغ

export interface TranscribeResult {
  ok: boolean
  text: string
  language: string
  error: string
}

/** يفرّغ تسجيلًا صوتيًا إلى نصّ. [audio] بايتات webm/ogg من الواجهة. */
export async function transcribe(audio: ArrayBuffer): Promise<TranscribeResult> {
  const settings = await stores.settings.load()
  const apiKey = settings.elevenKey.trim()
  if (!apiKey) return { ok: false, text: '', language: '', error: 'ما في مفتاح ElevenLabs.' }
  if (!audio || audio.byteLength < 1024) {
    return { ok: false, text: '', language: '', error: 'التسجيل قصير جدًا.' }
  }

  const form = new FormData()
  form.append('model_id', STT_MODEL)
  form.append('file', new Blob([audio], { type: 'audio/webm' }), 'speech.webm')
  // تحديد اللغة يرفع الدقة حسب التوثيق. «auto» يترك الكشف للنموذج لمن يخلط.
  if (settings.sttLanguage && settings.sttLanguage !== 'auto') {
    form.append('language_code', settings.sttLanguage)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const response = await fetch(`${BASE}/speech-to-text`, {
      method: 'POST',
      signal: controller.signal,
      headers: headers(apiKey),
      body: form,
    })
    if (!response.ok) throw new Error(await describe(response))

    const data = (await response.json()) as { text?: string; language_code?: string }
    return {
      ok: true,
      text: String(data.text ?? '').trim(),
      language: String(data.language_code ?? ''),
      error: '',
    }
  } catch (error) {
    const message = friendlyVoice(error)
    log('تعذّر التفريغ', message)
    return { ok: false, text: '', language: '', error: message }
  } finally {
    clearTimeout(timer)
  }
}

/** يتحقّق من المفتاح بنداء خفيف. */
export async function testKey(candidate: string): Promise<{ ok: boolean; error: string }> {
  const apiKey = candidate.trim()
  if (!apiKey) return { ok: false, error: 'ما في مفتاح.' }
  try {
    const response = await fetch(`${BASE}/user/subscription`, { headers: headers(apiKey) })
    if (!response.ok) throw new Error(await describe(response))
    return { ok: true, error: '' }
  } catch (error) {
    return { ok: false, error: friendlyVoice(error) }
  }
}
