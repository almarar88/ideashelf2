import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * نقل بيانات المستخدم بعد تغيير اسم التطبيق.
 *
 * Electron يشتقّ مسار البيانات من اسم المنتج، فتغيير الاسم وحده كافٍ ليفتح
 * المستخدم نسخةً فارغة بلا مهامّه ولا مدينته. وهذا عطل لا يظهر للمطوِّر
 * أبدًا: مجلّده الجديد فارغ أصلًا في كل الحالات.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')

const source = readFileSync('electron/startup.ts', 'utf8')
const start = source.indexOf('const LEGACY_PRODUCT_NAME')
const end = source.indexOf('// ------------------------------------------------- الإقلاع الآمن')
assert.ok(start > 0 && end > start, 'لم يُعثر على دالّة الترحيل في startup.ts')

const root = mkdtempSync(join(tmpdir(), 'awn-migrate-'))
const preamble = [
  "import { cpSync, existsSync, mkdirSync } from 'node:fs'",
  "import { dirname, join } from 'node:path'",
  'export let userData = ""',
  'export function setUserData(value: string) { userData = value }',
  'const app = { getPath: (_name: string) => userData }',
  'export const logged: string[] = []',
  'function log(...parts: string[]) { logged.push(parts.join(" ")) }',
  '',
].join('\n')
writeFileSync(join(root, 'migrate.ts'), preamble + source.slice(start, end))
execFileSync(process.execPath, [tsc, join(root, 'migrate.ts'), '--outDir', root,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const mod = requireHere(join(root, 'migrate.js'))

/** يبني مجلّد تطبيق باسمٍ معيّن داخل جذر جديد، ويعيد المسارات. */
function profile(files = {}) {
  const base = mkdtempSync(join(tmpdir(), 'awn-appdata-'))
  const legacy = join(base, 'Alcode Ai')
  const current = join(base, 'Awn')
  for (const [name, body] of Object.entries(files)) {
    const target = join(legacy, name)
    mkdirSync(dirnameOf(target), { recursive: true })
    writeFileSync(target, body)
  }
  mod.setUserData(current)
  return { legacy, current }
}
const dirnameOf = (p) => p.slice(0, p.lastIndexOf('/'))

test('بيانات الاسم السابق تُنقل إلى المجلّد الجديد', () => {
  const { current } = profile({
    'settings.json': '{"place":{"name":"دبي"}}',
    'tasks.json': '[{"id":"1"}]',
    'voice-cache/a.mp3': 'audio',
  })
  mod.migrateLegacyProfile()
  assert.equal(readFileSync(join(current, 'settings.json'), 'utf8'), '{"place":{"name":"دبي"}}')
  assert.equal(readFileSync(join(current, 'tasks.json'), 'utf8'), '[{"id":"1"}]')
  // المجلّدات المتداخلة أيضًا — ذاكرة الصوت المنطوق تُكلّف مالًا لإعادة توليدها.
  assert.equal(readFileSync(join(current, 'voice-cache', 'a.mp3'), 'utf8'), 'audio')
})

test('الأصل يبقى مكانه: نسخٌ لا نقل', () => {
  const { legacy } = profile({ 'settings.json': '{"a":1}' })
  mod.migrateLegacyProfile()
  assert.ok(existsSync(join(legacy, 'settings.json')))
})

test('لا يُكتب فوق إعدادات موجودة في المجلّد الجديد', () => {
  const { current } = profile({ 'settings.json': '{"old":true}' })
  mkdirSync(current, { recursive: true })
  writeFileSync(join(current, 'settings.json'), '{"new":true}')
  mod.migrateLegacyProfile()
  assert.equal(readFileSync(join(current, 'settings.json'), 'utf8'), '{"new":true}')
})

test('غياب المجلّد القديم بدايةٌ نظيفة لا خطأ', () => {
  const { current } = profile()
  assert.doesNotThrow(() => mod.migrateLegacyProfile())
  assert.ok(!existsSync(join(current, 'settings.json')))
})
