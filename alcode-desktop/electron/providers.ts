import { AgentEvent, RunOptions, ToolCall } from './claude'
import { ToolResult } from './tools/types'

/**
 * مزوّدو النماذج.
 *
 * مسلكان لا أكثر:
 *   • Anthropic بواجهتها الأصلية — تحتفظ بالتخزين المؤقت للبادئة وبالبحث
 *     الذي يجري على خوادمها، وكلاهما يضيع في أي طبقة توافق.
 *   • واجهة متوافقة مع OpenAI — وهي ما تعرضه اليوم xAI وGoogle وGroq
 *     وDeepSeek وOpenRouter والنماذج المحلّية. محوّل واحد مُختبَر يغطّيها
 *     كلها، وهو أمتن من ثلاثة محوّلات لكل منها شكلها الخاصّ.
 *
 * العناوين أدناه مأخوذة من توثيق كل مزوّد، تُحقّق منها في هذه الجلسة لا من
 * الذاكرة: واجهتا xAI وGoogle تغيّرتا فعلًا عمّا كان شائعًا.
 */

export interface Provider {
  id: string
  label: string
  /** الواجهة: أصلية لـ Anthropic أو متوافقة مع OpenAI. */
  kind: 'anthropic' | 'openai'
  baseUrl: string
  /** من أين يحصل المستخدم على مفتاح. */
  keyUrl: string
  /** نماذج مقترحة — يستطيع المستخدم كتابة أي معرّف آخر. */
  models: { id: string; label: string }[]
  /** ما يفقده هذا المزوّد مقارنةً بـ Anthropic، يُعرض للمستخدم صراحةً. */
  note: string
  /** هل يقبل عنوانًا يحرّره المستخدم؟ */
  editableUrl?: boolean
}

export const PROVIDERS: Provider[] = [
  {
    id: 'anthropic',
    label: 'Anthropic — Claude',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5 — الأذكى' },
      { id: 'claude-sonnet-5', label: 'Sonnet 5 — متوازن' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — الأسرع' },
    ],
    note: 'الوحيد الذي يبحث في الإنترنت من خوادمه، ويخزّن البادئة مؤقتًا فيقلّ ثمن المحادثات الطويلة.',
  },
  {
    id: 'xai',
    label: 'xAI — Grok',
    kind: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    keyUrl: 'https://console.x.ai',
    models: [
      { id: 'grok-4.7', label: 'Grok 4.7' },
      { id: 'grok-4.6', label: 'Grok 4.6' },
      { id: 'grok-4.5', label: 'Grok 4.5' },
    ],
    note: 'الأدوات تعمل. البحث في الإنترنت من داخل التطبيق لا يعمل — هو ميزة خوادم Anthropic.',
  },
  {
    id: 'google',
    label: 'Google — Gemini',
    kind: 'openai',
    // طبقة التوافق الرسمية من Google، لا الواجهة الأصلية.
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyUrl: 'https://aistudio.google.com/apikey',
    models: [
      { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    note: 'عبر طبقة التوافق الرسمية من Google، وهي ما تزال تجريبية لديهم.',
  },
  {
    id: 'openai',
    label: 'OpenAI — GPT',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyUrl: 'https://platform.openai.com/api-keys',
    models: [
      { id: 'gpt-5.2', label: 'GPT-5.2' },
      { id: 'gpt-5-mini', label: 'GPT-5 mini' },
    ],
    note: 'الأدوات تعمل. اكتب معرّف أي نموذج متاح في حسابك.',
  },
  {
    id: 'groq',
    label: 'Groq — سريع جدًا',
    kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyUrl: 'https://console.groq.com/keys',
    models: [{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' }],
    note: 'استجابة شديدة السرعة. جودة الأدوات أقلّ من النماذج الكبيرة.',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter — كل النماذج',
    kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyUrl: 'https://openrouter.ai/keys',
    models: [{ id: 'anthropic/claude-sonnet-4.5', label: 'اكتب أي معرّف من OpenRouter' }],
    note: 'بوّابة واحدة إلى عشرات النماذج بمفتاح واحد.',
  },
  {
    id: 'local',
    label: 'نموذج محلّي (Ollama / LM Studio)',
    kind: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    keyUrl: 'https://ollama.com/download',
    models: [{ id: 'qwen2.5:14b', label: 'اكتب اسم النموذج المحمَّل' }],
    note: 'يعمل بلا إنترنت وبلا تكلفة. السرعة والجودة تتبعان جهازك.',
    editableUrl: true,
  },
  {
    id: 'custom',
    label: 'عنوان مخصّص',
    kind: 'openai',
    baseUrl: '',
    keyUrl: '',
    models: [{ id: '', label: 'اكتب معرّف النموذج' }],
    note: 'أي خدمة تتحدّث لغة OpenAI.',
    editableUrl: true,
  },
]

export function providerById(id: string): Provider {
  return PROVIDERS.find((one) => one.id === id) ?? PROVIDERS[0]
}

// ------------------------------------------- محوّل الواجهة المتوافقة

/** أدواتنا موصوفة بشكل Anthropic؛ هذه تترجمها إلى شكل OpenAI. */
export function toolsToOpenAi(
  tools: Record<string, unknown>[],
): Record<string, unknown>[] {
  return tools
    // أدوات الخادم (مثل البحث) لا مقابل لها هنا: تُسقَط بدل أن تُرسَل فتُرفض.
    .filter((tool) => typeof tool.name === 'string' && tool.input_schema)
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    }))
}

/** رسالة نتائج الأدوات بشكل OpenAI: رسالة مستقلّة لكل نتيجة. */
export function toolResultsOpenAi(
  results: { call: ToolCall; result: ToolResult }[],
): Record<string, unknown>[] {
  return results.map(({ call, result }) => ({
    role: 'tool',
    tool_call_id: call.id,
    // لا كتل صور هنا: الواجهة المتوافقة تقبل نصًّا في نتيجة الأداة فقط،
    // فنقول إن ثمّة صورة بدل أن نرسل ما يُرفض.
    content: result.imageBase64
      ? `${result.detail}\n(أُلتقطت صورة — غير مدعومة مع هذا المزوّد)`
      : result.detail,
  }))
}

interface OpenAiTurn {
  text: string
  toolCalls: ToolCall[]
  message: Record<string, unknown> | null
  finish: string | null
  usage: { input: number; output: number; cached: number }
}

function errorText(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body)
    const message = parsed?.error?.message ?? parsed?.message
    if (typeof message === 'string') return message
  } catch {
    // ليس JSON — نُظهر مقتطفًا من النصّ الخام.
  }
  return `HTTP ${status}: ${body.slice(0, 200)}`
}

/** يترجم أخطاء المزوّدين إلى عربية مفهومة. */
export function friendlyProvider(error: unknown, provider: Provider): string {
  const text = error instanceof Error ? error.message : String(error)
  if (/401|unauthorized|invalid.*key|API key/i.test(text)) {
    return `مفتاح ${provider.label} غير صالح.`
  }
  if (/429|rate.?limit/i.test(text)) return 'طلبات كثيرة — انتظر لحظة.'
  if (/quota|insufficient|billing|402/i.test(text)) return 'الرصيد انتهى لدى المزوّد.'
  if (/404|model.*not.*found|does not exist/i.test(text)) {
    return 'معرّف النموذج غير موجود لدى هذا المزوّد — راجعه في الإعدادات.'
  }
  if (/ECONNREFUSED/i.test(text)) {
    return 'ما في خدمة على هذا العنوان. تأكّد أن النموذج المحلّي يعمل.'
  }
  if (/fetch failed|ENOTFOUND|ETIMEDOUT|network/i.test(text)) return 'ما في اتصال.'
  return text.slice(0, 200)
}

/**
 * دور واحد عبر واجهة متوافقة مع OpenAI، ببثّ متدفّق.
 *
 * البثّ هنا أصعب منه عند Anthropic: استدعاءات الأدوات تصل مجزّأة على عدّة
 * أجزاء، ويُجمَّع كل جزء بحسب فهرسه لا بحسب ترتيب وصوله — وهذا ما يكسر أكثر
 * التنفيذات السريعة.
 */
async function streamOpenAiTurn(
  options: RunOptions,
  provider: Provider,
  baseUrl: string,
  messages: Record<string, unknown>[],
): Promise<OpenAiTurn> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify({
      model: options.model,
      messages,
      tools: options.tools.length ? toolsToOpenAi(options.tools) : undefined,
      tool_choice: options.tools.length ? 'auto' : undefined,
      stream: true,
      stream_options: { include_usage: true },
    }),
  })

  if (!response.ok || !response.body) {
    throw new Error(errorText(response.status, await response.text().catch(() => '')))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''
  let finish: string | null = null
  const usage = { input: 0, output: 0, cached: 0 }
  /** الأجزاء مجمّعة بالفهرس: هكذا يرسلها المزوّد. */
  const partial = new Map<number, { id: string; name: string; args: string }>()

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      let event: any
      try {
        event = JSON.parse(payload)
      } catch {
        // جزء غير مكتمل أو سطر تعليق — يُتجاهَل.
        continue
      }

      if (event.usage) {
        usage.input = Number(event.usage.prompt_tokens ?? 0)
        usage.output = Number(event.usage.completion_tokens ?? 0)
        usage.cached = Number(event.usage.prompt_tokens_details?.cached_tokens ?? 0)
      }

      const choice = event.choices?.[0]
      if (!choice) continue
      if (choice.finish_reason) finish = String(choice.finish_reason)

      const delta = choice.delta
      if (!delta) continue

      if (typeof delta.content === 'string' && delta.content) {
        text += delta.content
        options.emit({ type: 'text', delta: delta.content })
      }

      for (const piece of delta.tool_calls ?? []) {
        const index = Number(piece.index ?? 0)
        const current = partial.get(index) ?? { id: '', name: '', args: '' }
        if (piece.id) current.id = String(piece.id)
        if (piece.function?.name) current.name += String(piece.function.name)
        if (piece.function?.arguments) current.args += String(piece.function.arguments)
        partial.set(index, current)
      }
    }
  }

  const toolCalls: ToolCall[] = []
  const wireCalls: Record<string, unknown>[] = []
  for (const [index, piece] of [...partial.entries()].sort((a, b) => a[0] - b[0])) {
    if (!piece.name) continue
    const id = piece.id || `call_${index}`
    let input: Record<string, unknown> = {}
    try {
      input = piece.args ? JSON.parse(piece.args) : {}
    } catch {
      // وسائط مشوّهة: ننفّذ بما لدينا بدل إسقاط الاستدعاء كلّه.
      input = {}
    }
    toolCalls.push({ id, name: piece.name, input })
    wireCalls.push({
      id,
      type: 'function',
      function: { name: piece.name, arguments: piece.args || '{}' },
    })
  }

  const message: Record<string, unknown> | null = (text || wireCalls.length)
    ? {
      role: 'assistant',
      content: text || null,
      ...(wireCalls.length ? { tool_calls: wireCalls } : {}),
    }
    : null

  return { text, toolCalls, message, finish, usage }
}

/**
 * حلقة الأدوات للمزوّدين المتوافقين.
 *
 * تعكس سلوك `runAgent` الخاصّ بـ Anthropic: تنفيذ، موافقة، ثم دور جديد —
 * حتى لا يختلف ما يشعر به المستخدم باختلاف المزوّد.
 */
export async function runOpenAiAgent(
  options: RunOptions,
  provider: Provider,
  baseUrl: string,
): Promise<void> {
  const maxTurns = options.maxTurns ?? 12
  const messages = options.history as Record<string, unknown>[]

  // تعليمات النظام رسالة أولى هنا، لا حقلًا مستقلًّا كما عند Anthropic.
  const wire: Record<string, unknown>[] = [
    { role: 'system', content: options.system },
    ...messages,
  ]

  try {
    for (let turn = 0; turn < maxTurns; turn++) {
      const result = await streamOpenAiTurn(options, provider, baseUrl, wire)

      if (result.usage.input || result.usage.output) {
        options.emit({ type: 'usage', ...result.usage })
      }
      if (result.message) {
        wire.push(result.message)
        messages.push(result.message)
      }

      if (!result.toolCalls.length) {
        options.emit({ type: 'done' })
        return
      }

      const done: { call: ToolCall; result: ToolResult }[] = []
      for (const call of result.toolCalls) {
        const allowed = await options.confirm(call)
        if (!allowed) {
          options.emit({ type: 'tool_denied', call })
          done.push({
            call,
            result: { ok: false, display: 'أُلغي بطلبك', detail: 'رفض المستخدم التنفيذ.' },
          })
          continue
        }
        options.emit({ type: 'tool_start', call })
        const outcome = await options.execute(call)
        options.emit({ type: 'tool_end', call, result: outcome })
        done.push({ call, result: outcome })
      }

      const replies = toolResultsOpenAi(done)
      wire.push(...replies)
      messages.push(...replies)
    }

    options.emit({
      type: 'failed',
      message: 'طالت سلسلة الأدوات أكثر من اللازم — أوقفتها.',
    })
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      options.emit({ type: 'done' })
      return
    }
    options.emit({ type: 'failed', message: friendlyProvider(error, provider) })
  }
}

export type { AgentEvent }
