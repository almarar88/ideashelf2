import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'

/**
 * محوّل الواجهة المتوافقة مع OpenAI، مُختبَرًا على خادم حقيقي محلّي يتكلّم
 * بروتوكول البثّ نفسه.
 *
 * السبب: الجزء الهشّ ليس بناء الطلب بل تجميع استدعاءات الأدوات من أجزاء
 * متفرّقة — تصل مجزّأة بلا ترتيب مضمون، ويُجمَّع كل جزء بحسب فهرسه. قراءة
 * الكود لا تُثبت هذا؛ خادم يرسل الأجزاء مقطّعة عمدًا يُثبته.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')

const dir = mkdtempSync(join(tmpdir(), 'alc-prov-'))
// الأنواع المستوردة تُستبدل بتعريفات موضعية: الاختبار يفحص السلوك لا الأنواع،
// وسحب claude.ts كاملًا يجرّ معه Electron.
const stubs = `
type ToolCall = { id: string; name: string; input: Record<string, unknown> }
type ToolResult = {
  ok: boolean; display: string; detail: string
  imageBase64?: string; imageMedia?: string
}
type AgentEvent = Record<string, any>
interface RunOptions {
  apiKey: string; model: string; effort: string; system: string
  history: Record<string, unknown>[]; tools: Record<string, unknown>[]
  maxTurns?: number; signal?: AbortSignal
  confirm: (call: ToolCall) => Promise<boolean>
  execute: (call: ToolCall) => Promise<ToolResult>
  emit: (event: AgentEvent) => void
}
`
const source = stubs + readFileSync('electron/providers.ts', 'utf8')
  .replace("import { AgentEvent, RunOptions, ToolCall } from './claude'", '')
  .replace("import { ToolResult } from './tools/types'", '')
  .replace('export type { AgentEvent }', '')
writeFileSync(join(dir, 'providers.ts'), source)
execFileSync(process.execPath, [tsc, join(dir, 'providers.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const providers = requireHere(join(dir, 'providers.js'))

/** يشغّل خادمًا يردّ بأحداث SSE معطاة، ويسجّل ما وصله. */
function fakeServer(chunksFor) {
  const seen = []
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (d) => { body += d })
    req.on('end', () => {
      seen.push({ url: req.url, body: JSON.parse(body) })
      res.writeHead(200, { 'Content-Type': 'text/event-stream' })
      for (const chunk of chunksFor(seen.length)) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    })
  })
  return { server, seen }
}

const listen = (server) => new Promise((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve(server.address().port))
})

test('ترجمة الأدوات إلى شكل OpenAI', () => {
  const out = providers.toolsToOpenAi([
    { name: 'open_app', description: 'يفتح برنامجًا', input_schema: { type: 'object', properties: {} } },
    // أداة خادم بلا مخطّط (مثل البحث): تُسقَط بدل أن تُرسَل فتُرفض.
    { type: 'web_search_20260209', name: 'web_search', max_uses: 4 },
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].type, 'function')
  assert.equal(out[0].function.name, 'open_app')
  assert.ok(out[0].function.parameters)
})

test('نتائج الأدوات رسالة مستقلّة لكل نتيجة', () => {
  const out = providers.toolResultsOpenAi([
    { call: { id: 'c1', name: 'a', input: {} }, result: { ok: true, display: '', detail: 'تمّ' } },
    {
      call: { id: 'c2', name: 'b', input: {} },
      result: { ok: true, display: '', detail: 'لقطة', imageBase64: 'AAAA' },
    },
  ])
  assert.equal(out.length, 2)
  assert.equal(out[0].role, 'tool')
  assert.equal(out[0].tool_call_id, 'c1')
  assert.equal(out[0].content, 'تمّ')
  // الصور غير مدعومة هنا: نقولها بدل إرسال ما يُرفض.
  assert.ok(!out[1].content.includes('AAAA'))
  assert.ok(out[1].content.includes('غير مدعومة'))
})

test('البثّ يجمّع نصًّا واستدعاء أداة مقطّعًا ثم ينفّذه', async () => {
  const { server, seen } = fakeServer((call) => call === 1
    ? [
      { choices: [{ delta: { content: 'أفتح ' } }] },
      { choices: [{ delta: { content: 'المتصفّح.' } }] },
      // الاستدعاء مقطّع على أربعة أجزاء، والاسم والوسائط موزّعان.
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_9', function: { name: 'open_' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { name: 'app' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"na' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'me":"chrome"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 11, completion_tokens: 4 } },
    ]
    : [
      { choices: [{ delta: { content: 'فتحته.' } }] },
      { choices: [{ delta: {}, finish_reason: 'stop' }] },
    ])

  const port = await listen(server)
  const events = []
  const executed = []
  const history = [{ role: 'user', content: 'افتح المتصفّح' }]

  await providers.runOpenAiAgent(
    {
      apiKey: 'k', model: 'grok-4.7', effort: 'low', system: 'كن مختصرًا',
      history,
      tools: [{ name: 'open_app', description: 'يفتح', input_schema: { type: 'object', properties: {} } }],
      confirm: async () => true,
      execute: async (call) => {
        executed.push(call)
        return { ok: true, display: 'فُتح', detail: 'تمّ فتح chrome' }
      },
      emit: (e) => events.push(e),
    },
    { id: 'xai', label: 'xAI', kind: 'openai' },
    `http://127.0.0.1:${port}`,
  )
  server.close()

  // الاستدعاء جُمّع صحيحًا من أجزائه.
  assert.equal(executed.length, 1)
  assert.equal(executed[0].name, 'open_app')
  assert.deepEqual(executed[0].input, { name: 'chrome' })
  assert.equal(executed[0].id, 'call_9')

  const text = events.filter((e) => e.type === 'text').map((e) => e.delta).join('')
  assert.equal(text, 'أفتح المتصفّح.فتحته.')
  assert.ok(events.some((e) => e.type === 'tool_end'))
  assert.equal(events.at(-1).type, 'done')
  assert.ok(events.some((e) => e.type === 'usage' && e.input === 11))

  // تعليمات النظام رسالة أولى، لا حقل مستقلّ.
  assert.equal(seen[0].body.messages[0].role, 'system')
  assert.equal(seen[0].body.messages[0].content, 'كن مختصرًا')
  assert.equal(seen[0].body.stream, true)

  // الدور الثاني يحمل ردّ المساعد ثم نتيجة الأداة بالترتيب الصحيح.
  const second = seen[1].body.messages
  assert.equal(second.at(-2).role, 'assistant')
  assert.ok(Array.isArray(second.at(-2).tool_calls))
  assert.equal(second.at(-1).role, 'tool')
  assert.equal(second.at(-1).tool_call_id, 'call_9')

  // والسجلّ المُعاد صالح لإكمال المحادثة لاحقًا.
  assert.ok(history.some((m) => m.role === 'tool'))
})

test('رفض المستخدم يُعاد كنتيجة لا كتجاهل', async () => {
  const { server } = fakeServer((call) => call === 1
    ? [
      { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'wipe', arguments: '{}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    ]
    : [{ choices: [{ delta: { content: 'تمام، ما سويت شي.' } , finish_reason: 'stop' }] }])

  const port = await listen(server)
  const events = []
  let ran = false
  await providers.runOpenAiAgent(
    {
      apiKey: 'k', model: 'm', effort: 'low', system: 's',
      history: [{ role: 'user', content: 'امسح' }],
      tools: [{ name: 'wipe', description: 'x', input_schema: { type: 'object', properties: {} } }],
      confirm: async () => false,
      execute: async () => { ran = true; return { ok: true, display: '', detail: '' } },
      emit: (e) => events.push(e),
    },
    { id: 'xai', label: 'xAI', kind: 'openai' },
    `http://127.0.0.1:${port}`,
  )
  server.close()

  assert.equal(ran, false, 'الأداة المرفوضة يجب ألّا تُنفَّذ')
  assert.ok(events.some((e) => e.type === 'tool_denied'))
  assert.equal(events.at(-1).type, 'done')
})

test('خطأ المزوّد يصل مترجمًا لا خامًا', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: { message: 'Incorrect API key provided' } }))
  })
  const port = await listen(server)
  const events = []
  await providers.runOpenAiAgent(
    {
      apiKey: 'bad', model: 'm', effort: 'low', system: 's',
      history: [{ role: 'user', content: 'مرحبا' }], tools: [],
      confirm: async () => true,
      execute: async () => ({ ok: true, display: '', detail: '' }),
      emit: (e) => events.push(e),
    },
    { id: 'xai', label: 'xAI — Grok', kind: 'openai' },
    `http://127.0.0.1:${port}`,
  )
  server.close()

  const failed = events.find((e) => e.type === 'failed')
  assert.ok(failed)
  assert.ok(failed.message.includes('xAI'), 'يجب أن يُسمّى المزوّد في الرسالة')
  assert.ok(!failed.message.includes('Incorrect'), 'لا نصّ إنجليزي خام للمستخدم')
})

test('كل مزوّد يحمل عنوانًا ونماذج، والمتوافقون يتشاركون المحوّل', () => {
  const ids = providers.PROVIDERS.map((one) => one.id)
  for (const needed of ['anthropic', 'xai', 'google', 'openai', 'local']) {
    assert.ok(ids.includes(needed), `ناقص: ${needed}`)
  }
  for (const one of providers.PROVIDERS) {
    assert.ok(one.label && one.note)
    assert.ok(one.kind === 'anthropic' || one.kind === 'openai')
    // العنوان الفارغ مسموح للمخصّص وحده، وهو قابل للتحرير.
    if (!one.baseUrl) assert.ok(one.editableUrl, `${one.id} بلا عنوان وغير قابل للتحرير`)
  }
  assert.equal(providers.providerById('xai').kind, 'openai')
  assert.equal(providers.providerById('لا يوجد').id, 'anthropic', 'المجهول يعود للافتراضي')
})

/*
 * ردود المزوّدين على مفتاح باطل — منسوخة حرفيًا من طلبات حقيقية.
 *
 * الصياغات تختلف فعلًا: xAI وGoogle يردّان 400 لا 401، وOpenRouter يقول
 * «Missing Authentication header» بلا ذكر كلمة key أصلًا. تُفحص الصياغة
 * وحدها، بلا بادئة رمز الحالة: البادئة تُطابق `401` فتُخفي ما إذا كان
 * النصّ نفسه مفهومًا — وهي تغيب متى وصل الخطأ من مسار آخر.
 */
test('صياغة كل مزوّد لمفتاح مرفوض تُقرأ بلا الاعتماد على رمز الحالة', () => {
  const { friendlyProvider, PROVIDERS } = providers
  const cases = {
    xai: 'Incorrect API key provided. You can obtain an API key from https://console.x.ai.',
    google: 'Please pass a valid API key',
    openai: 'Incorrect API key provided: sk-inval****robe.',
    groq: 'Invalid API Key',
    openrouter: 'Missing Authentication header',
  }
  for (const [id, body] of Object.entries(cases)) {
    const provider = PROVIDERS.find((one) => one.id === id)
    assert.equal(
      friendlyProvider(new Error(body), provider),
      `مفتاح ${provider.label} غير صالح.`,
      `صياغة ${id} يجب أن تُقرأ كمفتاح غير صالح`,
    )
  }
})

test('الخطأ بلا نصّ لا يُقدَّم كعطل اتصال', () => {
  const { friendlyProvider, PROVIDERS } = providers
  const message = friendlyProvider(new Error(''), PROVIDERS[1])
  assert.ok(!message.includes('اتصال'), 'ما يصح يُلام الاتصال')
  assert.ok(message.includes('خطأ داخلي'))
})

/*
 * `gemini-3.8-flash` و`gpt-5.2` كانا مكتوبَين في السجلّ ولا وجود لهما لدى
 * المزوّدَين، فكان كلاهما يفشل مهما كان المفتاح صحيحًا.
 */
test('لا معرّفات نماذج ملغاة في السجلّ', () => {
  const { PROVIDERS } = providers
  const retired = new Set(['gemini-3.8-flash', 'gpt-5.2', 'gemini-2.0-flash'])
  for (const provider of PROVIDERS) {
    for (const model of provider.models) {
      assert.ok(!retired.has(model.id), `معرّف ملغى في ${provider.id}: ${model.id}`)
    }
  }
})

test('جلب النماذج يقرأ data[].id ويفرزها، ويترجم الفشل', async () => {
  const { listProviderModels, friendlyProvider, PROVIDERS } = providers
  let seenAuth = ''
  const server = createServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    if (req.url === '/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }] }))
    } else {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'Invalid API Key' } }))
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    assert.deepEqual(await listProviderModels(base, 'k-123'), ['a-model', 'z-model'])
    assert.equal(seenAuth, 'Bearer k-123')
    // الشرطة المائلة الزائدة لا تُنتج //models
    assert.deepEqual(await listProviderModels(`${base}/`, 'k-123'), ['a-model', 'z-model'])

    await assert.rejects(() => listProviderModels(`${base}/nope`, 'k-123'), (error) => {
      assert.equal(
        friendlyProvider(error, PROVIDERS.find((one) => one.id === 'groq')),
        'مفتاح Groq — سريع جدًا غير صالح.',
      )
      return true
    })
  } finally {
    server.close()
  }
})
