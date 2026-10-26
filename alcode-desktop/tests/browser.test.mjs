import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * شريط العنوان: عنوانٌ أم بحث؟
 *
 * القرار الذي تخطئ فيه المتصفّحات بطرفيه — تبحث عمّا هو عنوان، أو تحاول
 * فتح عبارةٍ عربية كأنها نطاق. والعربية تجعله أهمّ: أغلب ما يُكتب هنا
 * عباراتُ بحث لا نطاقات.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')
const dir = mkdtempSync(join(tmpdir(), 'awn-url-'))
writeFileSync(join(dir, 'url.ts'), readFileSync('electron/browser/url.ts', 'utf8'))
execFileSync(process.execPath, [tsc, join(dir, 'url.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const { resolveAddress } = requireHere(join(dir, 'url.js'))

test('الروابط الكاملة تُفتح كما هي', () => {
  assert.equal(resolveAddress('https://example.com/a?b=1'), 'https://example.com/a?b=1')
  assert.equal(resolveAddress('http://example.com'), 'http://example.com')
})

test('النطاق بلا مخطّط يُكمَّل بـ https', () => {
  assert.equal(resolveAddress('example.com'), 'https://example.com')
  assert.equal(resolveAddress('news.bbc.co.uk/arabic'), 'https://news.bbc.co.uk/arabic')
})

test('العبارة العربية بحثٌ لا نطاق', () => {
  const out = resolveAddress('أسعار الذهب اليوم')
  assert.ok(out.startsWith('https://duckduckgo.com/?q='), out)
  assert.ok(out.includes(encodeURIComponent('أسعار الذهب اليوم')))
})

test('الكلمة الواحدة بحثٌ لا نطاق', () => {
  assert.ok(resolveAddress('طقس').startsWith('https://duckduckgo.com/?q='))
  assert.ok(resolveAddress('weather').startsWith('https://duckduckgo.com/?q='))
})

/** جملة فيها نقطة ليست نطاقًا — المسافة هي الفارق. */
test('الجملة التي فيها نقطة تبقى بحثًا', () => {
  assert.ok(resolveAddress('كم سعر الذهب. وش رايك').startsWith('https://duckduckgo.com/?q='))
})

test('localhost يُفتح على http لا https', () => {
  assert.equal(resolveAddress('localhost:5173'), 'http://localhost:5173')
  assert.equal(resolveAddress('127.0.0.1:8080/x'), 'http://127.0.0.1:8080/x')
})

/**
 * `javascript:` في شريط العنوان هو الطريق الكلاسيكي لخداع المستخدم
 * بلصق سكربت في صفحةٍ هو مسجَّل دخول فيها. لا يُفتح ولا يُبحث عنه.
 */
test('المخطّطات الخطرة لا تُفتح ولا تصير بحثًا', () => {
  for (const bad of ['javascript:alert(1)', 'file:///etc/passwd', 'chrome://settings']) {
    assert.equal(resolveAddress(bad), 'about:blank', bad)
  }
})

test('الفراغ يعطي صفحة فارغة', () => {
  assert.equal(resolveAddress('   '), 'about:blank')
})
