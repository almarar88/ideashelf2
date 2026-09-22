import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * دمج الإعدادات القديمة مع الافتراضية.
 *
 * هذا اختبار ترقية لا اختبار ميزة: كل حقل يُضاف في نسخة لاحقة يكون مفقودًا
 * في ملف مستخدم قديم. بلا دمج يعود `undefined` فينهار أول `.trim()` أو
 * `.map()` عليه — وهو عطل لا يظهر أبدًا على جهاز نظيف، أي عند المطوّر.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')

const dir = mkdtempSync(join(tmpdir(), 'alc-store-'))
const source = readFileSync('electron/store.ts', 'utf8')
// نعزل منطق الدمج عن Electron والمسارات.
const start = source.indexOf('/** كائن عادي')
const end = source.indexOf('export interface Memory')
// نعيد ما تحتاجه القطعة المعزولة، ونستبدل Electron بجذر مؤقّت.
const preamble = [
  "import { promises as fs } from 'node:fs'",
  "import { join } from 'node:path'",
  `const app = { getPath: (_name: string) => ${JSON.stringify(dir)} }`,
  '',
].join('\n')
writeFileSync(join(dir, 'store.ts'), preamble + source.slice(start, end))
execFileSync(process.execPath, [tsc, join(dir, 'store.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const { JsonStore } = requireHere(join(dir, 'store.js'))

/** نصل إلى الدمج مباشرة: القراءة من القرص تحتاج Electron. */
const reconcile = (fallback, parsed) => {
  const store = new JsonStore('x.json', fallback)
  return store.reconcile(parsed)
}

test('الحقول الجديدة تأخذ قيمتها الافتراضية لا undefined', () => {
  const fallback = {
    userName: '', topics: [], prayerAlerts: true,
    elevenKey: '', voiceSpeed: 1, place: null,
  }
  // ملف مستخدم من نسخة أقدم: لا يعرف إلا حقلين.
  const old = { userName: 'عبدالله', topics: ['الذهب'] }
  const merged = reconcile(fallback, old)

  assert.equal(merged.userName, 'عبدالله', 'قيمة المستخدم تُحفظ')
  assert.deepEqual(merged.topics, ['الذهب'])
  assert.equal(merged.elevenKey, '', 'الحقل الجديد ليس undefined')
  assert.equal(merged.voiceSpeed, 1)
  assert.equal(merged.prayerAlerts, true)
  assert.equal(merged.place, null)

  // هذا ما كان ينهار فعلًا قبل الإصلاح.
  assert.doesNotThrow(() => merged.elevenKey.trim())
  assert.doesNotThrow(() => merged.topics.map((x) => x))
})

test('الكائنات المتداخلة تُدمج لا تُستبدل', () => {
  const fallback = {
    prayer: { methodId: 'UMM_AL_QURA', asrFactor: 1, highLatitudeRule: 'ANGLE_BASED', offsets: {} },
  }
  // ملف قديم يعرف الطريقة فقط، ولا يعرف قاعدة خطوط العرض.
  const merged = reconcile(fallback, { prayer: { methodId: 'DUBAI', offsets: { fajr: 2 } } })

  assert.equal(merged.prayer.methodId, 'DUBAI', 'اختيار المستخدم يبقى')
  assert.equal(merged.prayer.highLatitudeRule, 'ANGLE_BASED', 'الحقل الناقص يعود للافتراضي')
  assert.equal(merged.prayer.asrFactor, 1)
  assert.deepEqual(merged.prayer.offsets, { fajr: 2 })
})

test('القيم الصريحة لا تُستبدل بالافتراضي ولو كانت فارغة', () => {
  const merged = reconcile(
    { autoSpeak: true, userName: 'افتراضي', voiceStability: 0.5 },
    { autoSpeak: false, userName: '', voiceStability: 0 },
  )
  assert.equal(merged.autoSpeak, false, 'false ليست غيابًا')
  assert.equal(merged.userName, '', 'النصّ الفارغ اختيار صريح')
  assert.equal(merged.voiceStability, 0, 'الصفر قيمة لا غياب')
})

test('المصفوفات والملفات التالفة لا تنهار', () => {
  assert.deepEqual(reconcile([], [{ id: 'a' }]), [{ id: 'a' }])
  assert.deepEqual(reconcile([], null), [])
  // ملف يحمل مصفوفة حيث يُتوقّع كائن: يُؤخذ كما هو بلا استثناء.
  assert.doesNotThrow(() => reconcile({ a: 1 }, [1, 2]))
})
