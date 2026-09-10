import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const requireHere = createRequire(import.meta.url)
// نستدعي المترجم بـ node مباشرة لا بـ npx: على ويندوز اسمه npx.cmd
// و execFile لا يشغّل ملفات .cmd بلا صدفة، فيسقط الاختبار هناك وحده.
const tsc = requireHere.resolve('typescript/bin/tsc')

/** يترجم وحدة TypeScript ويحمّلها للاختبار. */
function load(file) {
  const dir = mkdtempSync(join(tmpdir(), 'alc-'))
  execFileSync(process.execPath, [tsc, file, '--outDir', dir, '--module', 'commonjs',
    '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck'], { stdio: 'pipe' })
  const name = file.split('/').pop().replace('.ts', '.js')
  return requireHere(join(dir, name))
}

const news = load('electron/daily/news.ts')
const dates = load('electron/daily/dates.ts')
const weather = load('electron/daily/weather.ts')

// ------------------------------------------------------------ الأخبار

const RSS = `<?xml version="1.0"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>مصدر تجريبي</title>
    <item>
      <title><![CDATA[عنوان فيه & رمز]]></title>
      <link>https://example.com/a?utm=1</link>
      <description>&lt;p&gt;وصف &amp;amp; مختصر&lt;/p&gt;</description>
      <pubDate>Tue, 15 Jan 2026 08:00:00 GMT</pubDate>
      <media:content url="https://example.com/a.jpg"/>
    </item>
    <item>
      <title>خبر ثانٍ</title>
      <link>https://example.com/b</link>
      <pubDate>Tue, 15 Jan 2026 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Source</title>
  <entry>
    <title>Atom entry</title>
    <link rel="alternate" href="https://example.org/x"/>
    <summary>ملخّص</summary>
    <updated>2026-01-15T10:00:00Z</updated>
  </entry>
</feed>`

const source = { id: 's', name: 'مصدر', url: '', category: 'الأهم', enabled: true }

test('يحلّل RSS مع CDATA والكيانات والصورة', () => {
  const items = news.parseFeed(RSS, source)
  assert.equal(items.length, 2)
  assert.equal(items[0].title, 'عنوان فيه & رمز')
  assert.equal(items[0].link, 'https://example.com/a?utm=1')
  assert.equal(items[0].summary, 'وصف & مختصر', 'الوسوم والكيانات المزدوجة تُفكّ')
  assert.equal(items[0].image, 'https://example.com/a.jpg')
  assert.ok(items[0].publishedAt > 0)
})

test('يحلّل Atom حيث الرابط سمة لا محتوى وسم', () => {
  const items = news.parseFeed(ATOM, source)
  assert.equal(items.length, 1)
  assert.equal(items[0].link, 'https://example.org/x')
  assert.equal(items[0].title, 'Atom entry')
})

test('عنصر بلا عنوان أو رابط يُتجاهل بدل أن يُسقط الموجز', () => {
  const broken = '<rss><channel><item><description>بلا عنوان</description></item></channel></rss>'
  assert.equal(news.parseFeed(broken, source).length, 0)
  assert.equal(news.parseFeed('ليس XML أصلًا', source).length, 0)
})

test('المصادر الافتراضية سليمة وبلا تكرار', () => {
  const all = news.DEFAULT_SOURCES
  assert.ok(all.length >= 18, `مصادر قليلة: ${all.length}`)
  assert.equal(new Set(all.map((s) => s.id)).size, all.length, 'معرّف مكرّر')
  for (const s of all) {
    assert.ok(s.url.startsWith('https://'), `${s.name}: الرابط يجب أن يكون HTTPS`)
    assert.ok(news.CATEGORIES.includes(s.category), `${s.name}: تصنيف غير معروف`)
  }
})

test('الموضوع يتحوّل إلى بحث مُرمّز', () => {
  const topic = news.topicSource('أسعار النفط')
  assert.ok(topic.url.includes(encodeURIComponent('أسعار النفط')))
  assert.ok(topic.url.startsWith('https://'))
})

// ----------------------------------------------------------- التواريخ

test('التاريخ الهجري بتقويم أم القرى', () => {
  // ١ يناير ٢٠٢٦ يوافق منتصف رجب ١٤٤٧ تقريبًا.
  const hijri = dates.hijriParts(new Date(2026, 0, 1))
  assert.equal(hijri.year, 1447)
  assert.ok(hijri.month >= 1 && hijri.month <= 12)
  assert.ok(hijri.day >= 1 && hijri.day <= 30)
  assert.ok(dates.longHijriAr(new Date(2026, 0, 1)).includes('هـ'))
})

test('الإزاحة اليدوية تحرّك التاريخ الهجري يومًا', () => {
  const base = dates.hijriParts(new Date(2026, 0, 15), 0)
  const shifted = dates.hijriParts(new Date(2026, 0, 15), 1)
  assert.notEqual(base.day, shifted.day)
})

test('صيغ الوقت والمدّة', () => {
  assert.equal(dates.humanDuration(0), '0 د')
  assert.equal(dates.humanDuration(45 * 60_000), '45 د')
  assert.equal(dates.humanDuration(3 * 3_600_000), '3 س')
  assert.equal(dates.humanDuration(3 * 3_600_000 + 12 * 60_000), '3 س 12 د')
  assert.equal(dates.relativePast(Date.now() - 30_000), 'الآن')
  assert.equal(dates.relativePast(0), '')
})

test('التحية تتبع الساعة', () => {
  assert.equal(dates.greeting(7), 'صباح الخير')
  assert.equal(dates.greeting(13), 'نهارك سعيد')
  assert.equal(dates.greeting(22), 'مساء الخير')
})

// ------------------------------------------------------------- الطقس

test('طوابع Open-Meteo تُقرأ بمنطقة المكان لا بمنطقة الجهاز', () => {
  // شروق دبي ٠٦:٠٢ بتوقيتها المحلّي، وإزاحتها +٤ ساعات.
  const dubai = weather.openMeteoEpoch('2026-09-10T06:02', 4 * 3600)
  assert.equal(new Date(dubai * 1000).toISOString(), '2026-09-10T02:02:00.000Z')

  // الاختبار نفسه بمنطقة سالبة: نيويورك −٤ صيفًا.
  const newYork = weather.openMeteoEpoch('2026-09-10T06:02', -4 * 3600)
  assert.equal(new Date(newYork * 1000).toISOString(), '2026-09-10T10:02:00.000Z')

  // بلا إزاحة تبقى القراءة UTC كما هي.
  assert.equal(
    new Date(weather.openMeteoEpoch('2026-09-10T06:02', 0) * 1000).toISOString(),
    '2026-09-10T06:02:00.000Z',
  )

  // قيمة فارغة أو تالفة لا تُسقط الجلب كله.
  assert.equal(weather.openMeteoEpoch('', 3600), 0)
  assert.equal(weather.openMeteoEpoch('ليس تاريخًا', 3600), 0)
})

test('رموز WMO تُترجم إلى عربي وأيقونة', () => {
  assert.equal(weather.describeWeather(0, true).text, 'صحو')
  assert.notEqual(weather.describeWeather(0, true).emoji, weather.describeWeather(0, false).emoji)
  // رمز غير معروف لا ينهار بل يعيد وصفًا محايدًا.
  assert.ok(weather.describeWeather(9999, true).text.length > 0)
})
