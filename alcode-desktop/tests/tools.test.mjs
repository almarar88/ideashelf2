import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const toolsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'electron', 'tools')
const sources = readdirSync(toolsDir)
  .filter((f) => f.endsWith('.ts') && !['types.ts', 'index.ts'].includes(f))
  .map((f) => ({ file: f, text: readFileSync(join(toolsDir, f), 'utf8') }))

const names = sources.flatMap(({ text }) =>
  [...text.matchAll(/name: '([a-z_]+)',/g)].map((m) => m[1]),
)

test('عدد الأدوات معقول ولا تكرار في الأسماء', () => {
  assert.ok(names.length >= 40, `أدوات قليلة: ${names.length}`)
  assert.equal(new Set(names).size, names.length, 'اسم أداة مكرّر يربك النموذج')
})

test('كل أداة موصوفة وصفًا يكفي النموذج لاختيارها', () => {
  for (const { file, text } of sources) {
    const blocks = text.split(/\n  \{\n/).slice(1)
    for (const block of blocks) {
      const name = block.match(/name: '([a-z_]+)'/)?.[1]
      if (!name) continue
      const description = block.match(/description:\s*\n?\s*'([\s\S]*?)',\n\s*input:/)
      assert.ok(description, `${file}: ${name} بلا وصف`)
      assert.ok(
        description[1].replace(/'\s*\+\s*\n\s*'/g, '').length >= 40,
        `${file}: وصف ${name} قصير جدًا`,
      )
    }
  }
})

test('كل أداة مصنّفة بمستوى خطر ومجموعة', () => {
  for (const { file, text } of sources) {
    const toolCount = (text.match(/name: '[a-z_]+',/g) || []).length
    const dangerCount = (text.match(/danger: '(safe|confirm|high)'/g) || []).length
    const groupCount = (text.match(/group: '/g) || []).length
    assert.equal(dangerCount, toolCount, `${file}: أداة بلا مستوى خطر`)
    assert.equal(groupCount, toolCount, `${file}: أداة بلا مجموعة`)
  }
})

test('العمليات المدمّرة مصنّفة خطرة لا آمنة', () => {
  const mustBeHigh = [
    'delete_file', 'empty_recycle_bin', 'power_action',
    'kill_process', 'uninstall_app', 'install_app', 'run_powershell',
  ]
  for (const { text } of sources) {
    for (const name of mustBeHigh) {
      const index = text.indexOf(`name: '${name}'`)
      if (index < 0) continue
      const block = text.slice(index, index + 400)
      assert.match(block, /danger: 'high'/, `${name} يجب أن يكون high`)
    }
  }
})

test('الأدوات الحسّاسة موجودة كلها', () => {
  const expected = [
    'system_info', 'screenshot', 'list_windows', 'focus_window',
    'type_text', 'press_keys', 'find_files', 'read_file',
    'remember_fact', 'add_reminder', 'run_powershell', 'open_app',
  ]
  for (const name of expected) {
    assert.ok(names.includes(name), `أداة مفقودة: ${name}`)
  }
})
