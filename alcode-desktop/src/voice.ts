/**
 * محرّك الصوت في واجهة العرض.
 *
 * مسؤوليتان: التقاط الميكروفون، وتشغيل ما يُنطَق. المفاتيح والنداءات الشبكية
 * كلها في العملية الرئيسية — هنا صوت خام ونصّ فقط.
 */

/**
 * يقسّم نصًّا متدفّقًا إلى جُمل جاهزة للنطق.
 *
 * السبب: النموذج يبثّ الرد رمزًا رمزًا. انتظار اكتماله كلّه قبل النطق يجعل
 * المساعد يصمت ثوانٍ ثم يتكلّم — وهو ما يجعل المساعدات تبدو بطيئة. نُخرج كل
 * جملة فور اكتمالها فيبدأ الكلام بعد أول جملة.
 *
 * دالة خالصة ليختبرها الاختبار بلا صوت ولا شبكة.
 */
export function takeSentences(buffer: string): { ready: string[]; rest: string } {
  const ready: string[] = []
  let rest = buffer
  // الترقيم العربي والإنجليزي معًا: ؟ ! . ؛ : وسطر جديد.
  const boundary = /[.!?؟!؛\n]+\s*/

  for (;;) {
    const match = boundary.exec(rest)
    if (!match) break
    const end = match.index + match[0].length
    const piece = rest.slice(0, end).trim()
    rest = rest.slice(end)
    // الشرط: حرف أو رقم واحد على الأقل. الترقيم وحده لا يستحقّ نداء شبكة
    // مدفوعًا، لكن حدًّا أعلى من ذلك يُسقط ردودًا عربية قصيرة صحيحة مثل «تمّ»
    // — والتشكيل لا يُحتسب حرفًا في \p{L}، فيقصر ما ليس بقصير.
    if (/[\p{L}\p{N}]/u.test(piece)) ready.push(piece)
  }
  return { ready, rest }
}

/**
 * ينظّف النصّ قبل النطق.
 *
 * ما يُقرأ على الشاشة ليس ما يُقال: علامات Markdown تُنطق حرفيًا («نجمة نجمة»)،
 * وكتل الشيفرة والروابط تُفسد الجملة وتُحاسَب بالحرف بلا فائدة.
 */
export function speakable(text: string): string {
  return text
    // كتل الشيفرة تُختصر بدل أن تُتلى سطرًا سطرًا.
    .replace(/```[\s\S]*?```/g, ' (شيفرة) ')
    .replace(/`([^`]+)`/g, '$1')
    // الروابط: نُبقي نصّها ونُسقط عنوانها.
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' رابط ')
    .replace(/[*_#>|]/g, ' ')
    .replace(/^\s*[-•]\s*/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ------------------------------------------------------- تشغيل الصوت

let current: HTMLAudioElement | null = null
let queue: string[] = []
let playing = false
let onStateChange: ((speaking: boolean) => void) | null = null

export function onSpeakingChange(handler: (speaking: boolean) => void) {
  onStateChange = handler
}

function setSpeaking(value: boolean) {
  onStateChange?.(value)
}

async function playBase64(mp3: string): Promise<void> {
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${mp3}`)
    current = audio
    audio.onended = () => resolve()
    // خطأ التشغيل لا يوقف الطابور: الجملة التالية قد تعمل.
    audio.onerror = () => resolve()
    void audio.play().catch(() => resolve())
  })
}

/** نطق احتياطي بأصوات ويندوز نفسه — بلا مفتاح وبلا إنترنت، وبلا واقعية. */
function speakWithSystem(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) { resolve(); return }
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'ar-SA'
    const arabic = window.speechSynthesis.getVoices()
      .find((voice) => voice.lang.startsWith('ar'))
    if (arabic) utterance.voice = arabic
    utterance.onend = () => resolve()
    utterance.onerror = () => resolve()
    window.speechSynthesis.speak(utterance)
  })
}

async function drain(useSystem: boolean) {
  if (playing) return
  playing = true
  setSpeaking(true)
  while (queue.length) {
    const next = queue.shift()!
    if (useSystem) {
      await speakWithSystem(next)
    } else {
      const result = await window.alcode.voice.speak(next)
      if (result.ok && result.audio) await playBase64(result.audio)
      else if (result.error) await speakWithSystem(next)
    }
  }
  playing = false
  current = null
  setSpeaking(false)
}

/** يضيف جملة إلى طابور النطق ويبدأ التشغيل إن لم يكن جاريًا. */
export function enqueue(text: string, useSystem = false) {
  const clean = speakable(text)
  if (!clean) return
  queue.push(clean)
  void drain(useSystem)
}

/** يوقف النطق فورًا ويُفرغ الطابور. */
export function stopSpeaking() {
  queue = []
  if (current) {
    current.pause()
    current = null
  }
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  playing = false
  setSpeaking(false)
}

export function isSpeaking(): boolean {
  return playing
}

// --------------------------------------------------- التقاط الميكروفون

export interface Recorder {
  stop: () => Promise<ArrayBuffer>
  cancel: () => void
  /** مستوى الصوت الحالي ٠..١ — لمؤشّر بصري يطمئن المستخدم أنه يسمعه. */
  level: () => number
}

/**
 * يبدأ التسجيل ويعيد مقبضًا لإيقافه.
 *
 * ضغط للتحدّث لا كشف تلقائي للصمت: الكشف التلقائي يقطع المتحدّث في منتصف
 * جملته، والمستخدم يعرف متى انتهى أفضل من أي عتبة.
 */
export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  const recorder = new MediaRecorder(stream)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data)
  }
  recorder.start()

  // قياس المستوى للمؤشّر البصري.
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  const analyser = context.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const samples = new Uint8Array(analyser.frequencyBinCount)

  const release = () => {
    stream.getTracks().forEach((track) => track.stop())
    void context.close().catch(() => undefined)
  }

  return {
    level: () => {
      analyser.getByteTimeDomainData(samples)
      let peak = 0
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128))
      return Math.min(1, peak / 64)
    },
    stop: () => new Promise<ArrayBuffer>((resolve) => {
      recorder.onstop = async () => {
        release()
        resolve(await new Blob(chunks, { type: 'audio/webm' }).arrayBuffer())
      }
      recorder.stop()
    }),
    cancel: () => {
      try { recorder.stop() } catch { /* متوقّف أصلًا */ }
      release()
    },
  }
}
