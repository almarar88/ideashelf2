import { ToolResult } from './tools/types'

/**
 * عميل Anthropic Messages عبر HTTP مباشرة.
 *
 * لماذا لا حزمة الـ SDK؟ لأن هذه العملية هي عملية Electron الرئيسية،
 * وإضافة حزمة كاملة لطلب واحد يضخّم الحزمة بلا مقابل. الطلب بسيط ومستقرّ.
 * المفتاح يبقى في هذه العملية ولا يصل إلى واجهة العرض أبدًا.
 */

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export type AgentEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_start'; call: ToolCall }
  | { type: 'tool_end'; call: ToolCall; result: ToolResult }
  | { type: 'tool_denied'; call: ToolCall }
  | { type: 'searching'; query: string }
  | { type: 'usage'; input: number; output: number; cached: number }
  | { type: 'failed'; message: string }
  | { type: 'done' }

interface Turn {
  text: string
  content: Record<string, unknown>[]
  toolCalls: ToolCall[]
  stopReason: string | null
  refusal: string | null
  usage: { input: number; output: number; cached: number }
}

/** أداة البحث تعمل على خوادم Anthropic؛ النوع الأحدث غير مدعوم على Haiku. */
export function webSearchTool(model: string): Record<string, unknown> {
  return {
    type: model.startsWith('claude-haiku') ? 'web_search_20250305' : 'web_search_20260209',
    name: 'web_search',
    max_uses: 4,
  }
}

/** كتل يعيدها الخادم ويجب إرجاعها كما هي ليكمل من حيث وقف. */
const SERVER_RESULT_BLOCKS = new Set([
  'web_search_tool_result',
  'web_fetch_tool_result',
])

export interface RunOptions {
  apiKey: string
  model: string
  effort: string
  system: string
  history: Record<string, unknown>[]
  tools: Record<string, unknown>[]
  maxTurns?: number
  signal?: AbortSignal
  confirm: (call: ToolCall) => Promise<boolean>
  execute: (call: ToolCall) => Promise<ToolResult>
  emit: (event: AgentEvent) => void
}

export async function runAgent(options: RunOptions): Promise<void> {
  const maxTurns = options.maxTurns ?? 12
  let turns = 0

  while (turns < maxTurns) {
    turns++

    let turn: Turn
    try {
      turn = await streamTurn(options)
    } catch (error) {
      options.emit({ type: 'failed', message: friendly(error) })
      return
    }

    if (turn.usage.input || turn.usage.output) {
      options.emit({ type: 'usage', ...turn.usage })
    }

    if (turn.refusal) {
      options.emit({ type: 'failed', message: turn.refusal })
      return
    }

    options.history.push({ role: 'assistant', content: turn.content })

    if (!turn.toolCalls.length) {
      // أدوات الخادم لها حدّ دورات داخلي؛ عند بلوغه يستأنف بلا رسالة جديدة منّا.
      if (turn.stopReason === 'pause_turn') continue
      options.emit({ type: 'done' })
      return
    }

    const results: { call: ToolCall; result: ToolResult }[] = []
    for (const call of turn.toolCalls) {
      const allowed = await options.confirm(call)
      if (!allowed) {
        options.emit({ type: 'tool_denied', call })
        results.push({
          call,
          result: {
            ok: false,
            display: 'أُلغي بطلب المستخدم',
            detail:
              'رفض المستخدم تنفيذ هذا الأمر. لا تحاول تنفيذه مرة أخرى بطريقة أخرى، ' +
              'واسأله عمّا يريد بدلًا منه.',
          },
        })
        continue
      }
      options.emit({ type: 'tool_start', call })
      const result = await options.execute(call)
      options.emit({ type: 'tool_end', call, result })
      results.push({ call, result })
    }

    options.history.push(toolResultsMessage(results))
  }

  options.emit({ type: 'failed', message: `توقّفت بعد ${maxTurns} خطوة دون إنهاء المهمة.` })
}

/** نتائج الأدوات تعود مجتمعة في رسالة واحدة، كما تتطلّب الواجهة. */
export function toolResultsMessage(
  results: { call: ToolCall; result: ToolResult }[],
): Record<string, unknown> {
  return {
    role: 'user',
    content: results.map(({ call, result }) => {
      const block: Record<string, unknown> = {
        type: 'tool_result',
        tool_use_id: call.id,
      }
      if (result.imageBase64) {
        block.content = [
          { type: 'text', text: result.detail },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: result.imageMedia ?? 'image/png',
              data: result.imageBase64,
            },
          },
        ]
      } else {
        block.content = result.detail
      }
      if (!result.ok) block.is_error = true
      return block
    }),
  }
}

async function streamTurn(options: RunOptions): Promise<Turn> {
  const payload: Record<string, unknown> = {
    model: options.model,
    max_tokens: 8192,
    stream: true,
    system: [
      { type: 'text', text: options.system, cache_control: { type: 'ephemeral' } },
    ],
    output_config: { effort: options.effort },
    messages: options.history,
  }
  if (options.tools.length) payload.tools = options.tools

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': options.apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  })

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '')
    throw new HttpError(response.status, extractError(body))
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const text: string[] = []
  const blocks = new Map<number, BlockBuilder>()
  const toolCalls: ToolCall[] = []
  let stopReason: string | null = null
  let refusal: string | null = null
  const usage = { input: 0, output: 0, cached: 0 }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line.startsWith('data:')) continue

      const raw = line.slice(5).trim()
      if (!raw) continue

      let event: any
      try {
        event = JSON.parse(raw)
      } catch {
        continue
      }

      switch (event.type) {
        case 'message_start': {
          const u = event.message?.usage
          if (u) {
            usage.input += u.input_tokens ?? 0
            usage.cached += u.cache_read_input_tokens ?? 0
          }
          break
        }
        case 'content_block_start': {
          blocks.set(event.index, new BlockBuilder(event.content_block))
          break
        }
        case 'content_block_delta': {
          const builder = blocks.get(event.index)
          if (event.delta?.type === 'text_delta') {
            const piece = String(event.delta.text ?? '')
            text.push(piece)
            builder?.text.push(piece)
            options.emit({ type: 'text', delta: piece })
          } else if (event.delta?.type === 'input_json_delta') {
            builder?.json.push(String(event.delta.partial_json ?? ''))
          }
          break
        }
        case 'content_block_stop': {
          const builder = blocks.get(event.index)
          if (!builder) break
          builder.done = true
          if (builder.type === 'tool_use') {
            toolCalls.push({ id: builder.id, name: builder.name, input: builder.parsedInput() })
          } else if (builder.type === 'server_tool_use' && builder.name === 'web_search') {
            const query = String((builder.parsedInput() as any).query ?? '')
            options.emit({ type: 'searching', query })
          }
          break
        }
        case 'message_delta': {
          stopReason = event.delta?.stop_reason ?? stopReason
          if (event.usage?.output_tokens) usage.output += event.usage.output_tokens
          if (stopReason === 'refusal') {
            refusal = event.delta?.stop_details?.explanation ?? 'تعذّر إكمال هذا الطلب.'
          }
          break
        }
        case 'error': {
          throw new Error(event.error?.message ?? 'خطأ من الخدمة')
        }
      }
    }
  }

  return {
    text: text.join(''),
    content: [...blocks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, builder]) => builder.build())
      .filter((block): block is Record<string, unknown> => block !== null),
    toolCalls,
    stopReason,
    refusal,
    usage,
  }
}

/**
 * يجمع كتلة محتوى من أحداث البثّ.
 * كتل التفكير تُسقَط: نصّها يصل فارغًا افتراضيًا وإرجاع كتلة فارغة يُرفض.
 */
class BlockBuilder {
  readonly text: string[] = []
  readonly json: string[] = []
  done = false

  constructor(private readonly start: any) {}

  get type(): string { return String(this.start?.type ?? '') }
  get id(): string { return String(this.start?.id ?? '') }
  get name(): string { return String(this.start?.name ?? '') }

  parsedInput(): Record<string, unknown> {
    try {
      return JSON.parse(this.json.join('') || '{}')
    } catch {
      return {}
    }
  }

  build(): Record<string, unknown> | null {
    if (!this.done) return null
    if (this.type === 'thinking' || this.type === 'redacted_thinking') return null
    if (this.type === 'text') {
      const value = this.text.join('')
      return value ? { type: 'text', text: value } : null
    }
    if (this.type === 'tool_use' || this.type === 'server_tool_use') {
      return { type: this.type, id: this.id, name: this.name, input: this.parsedInput() }
    }
    if (SERVER_RESULT_BLOCKS.has(this.type)) return this.start
    return null
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

function extractError(body: string): string {
  try {
    return JSON.parse(body)?.error?.message ?? body.slice(0, 300)
  } catch {
    return body.slice(0, 300)
  }
}

/** رسائل مفهومة بدل نصّ الخطأ الخام. */
export function friendly(error: unknown): string {
  if (error instanceof HttpError) {
    if (error.status === 401) return 'المفتاح غير صالح. تحقّق منه في الإعدادات.'
    if (error.status === 429) return 'تجاوزت حدّ الطلبات. انتظر قليلًا ثم أعد المحاولة.'
    if (error.status === 400) return `طلب غير مقبول: ${error.message}`
    if (error.status >= 500) return 'خدمة Anthropic تواجه مشكلة الآن. أعد المحاولة بعد قليل.'
    return error.message
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/abort/i.test(message)) return 'أُوقف الطلب.'
  if (/fetch|network|ENOTFOUND|ECONN/i.test(message)) return 'تعذّر الاتصال بالإنترنت.'
  return message
}

/** طلب قصير بلا أدوات — للعناوين والملخّصات. */
export async function complete(
  apiKey: string, model: string, system: string, prompt: string, maxTokens = 512,
): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!response.ok) throw new HttpError(response.status, extractError(await response.text()))
  const data: any = await response.json()
  return (data.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim()
}
