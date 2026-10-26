import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * استخراج نصّ الصفحة.
 *
 * ما يُعاد هنا يُرسَل إلى النموذج ويُدفع ثمنه بالرموز، فالقمامة فيه تكلّف
 * مرّتين: مالًا وجودةَ إجابة. الحالات تقابل اختبارات الأندرويد
 * (ReadableTest.kt) حالةً بحالة.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')
const dir = mkdtempSync(join(tmpdir(), 'awn-readable-'))
writeFileSync(join(dir, 'readable.ts'), readFileSync('electron/readable.ts', 'utf8'))
execFileSync(process.execPath, [tsc, join(dir, 'readable.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const { extractReadable } = requireHere(join(dir, 'readable.js'))

test('السكربت والتنسيق لا يصلان إلى النموذج', () => {
  const html = `<html><head><title>خبر</title>
    <style>.a{color:red}</style>
    <script>var x = "نصّ داخل سكربت"; alert(1);</script>
    </head><body><p>المتن الحقيقي.</p></body></html>`
  const page = extractReadable(html)
  assert.ok(!page.text.includes('alert'))
  assert.ok(!page.text.includes('نصّ داخل سكربت'))
  assert.ok(!page.text.includes('color:red'))
  assert.ok(page.text.includes('المتن الحقيقي'))
})

test('العنوان يُستخرج منفصلًا', () => {
  const page = extractReadable('<html><head><title>  عنوان الصفحة </title></head><body><p>متن</p></body></html>')
  assert.equal(page.title, 'عنوان الصفحة')
})

test('الوسوم الكتلية تفصل الفقرات بأسطر', () => {
  const page = extractReadable('<body><p>الفقرة الأولى</p><p>الفقرة الثانية</p></body>')
  assert.ok(!page.text.includes('الأولىالفقرة'))
  assert.ok(page.text.includes('الفقرة الأولى'))
  assert.ok(page.text.includes('الفقرة الثانية'))
})

test('الكيانات تُفكّ بما فيها الرقمية', () => {
  const page = extractReadable('<body><p>&quot;قال&quot; &amp; &#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;</p></body>')
  assert.ok(page.text.includes('"قال"'))
  assert.ok(!page.text.includes('&amp;'))
  assert.ok(page.text.includes('العربية'))
})

test('النصّ يُقتطع عند الحدّ فلا يبتلع السياق', () => {
  const page = extractReadable(`<body><p>${'كلمة '.repeat(5000)}</p></body>`, 500)
  assert.ok(page.text.length <= 520)
  assert.ok(page.text.endsWith('…'))
})

test('صفحة بلا نصّ تعيد فراغًا لا قمامة', () => {
  const page = extractReadable('<html><head><title>ت</title></head><body><script>x()</script></body></html>')
  assert.equal(page.text, '')
})

test('الفارغة أو المشوّهة لا ترمي', () => {
  assert.equal(extractReadable('').text, '')
  assert.equal(extractReadable('<<<>>').text.trim(), '')
  extractReadable('<p>غير مغلق')
})

test('شريط التنقّل والتذييل يُسقطان', () => {
  const page = extractReadable('<body><nav>الرئيسية الأقسام</nav><p>الخبر المهم</p><footer>حقوق النشر</footer></body>')
  assert.ok(page.text.includes('الخبر المهم'))
  assert.ok(!page.text.includes('حقوق النشر'))
})
