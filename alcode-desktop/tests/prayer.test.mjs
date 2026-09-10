import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * يقارن محرّك أوقات الصلاة بالجدول المرجعي نفسه المستعمل في نسخة الأندرويد
 * (مأخوذ من خدمة AlAdhan لعشر حالات على خطوط عرض متباينة، شتاءً وصيفًا).
 *
 * الغرض: أن تعطي النسختان النتيجة نفسها. مستخدم يرى وقتًا على هاتفه وآخر
 * على حاسوبه يفقد الثقة في الاثنين معًا.
 */

// ننفّذ الوحدة المترجمة: الاختبار يعمل على JavaScript والمصدر TypeScript.
const dir = mkdtempSync(join(tmpdir(), 'alc-prayer-'))
execFileSync('npx', ['tsc', 'electron/daily/prayer.ts',
  '--outDir', dir, '--module', 'commonjs', '--target', 'es2022',
  '--moduleResolution', 'node', '--skipLibCheck'], { stdio: 'pipe' })

const modulePath = join(dir, 'prayer.js')
// نحوّل CommonJS إلى وحدة قابلة للاستيراد في ESM.
writeFileSync(join(dir, 'prayer.cjs'), readFileSync(modulePath))
const { createRequire } = await import('node:module')
const require = createRequire(import.meta.url)
const prayer = require(join(dir, 'prayer.cjs'))

const references = [
  ['الرياض', 24.7136, 46.6753, 'Asia/Riyadh', 'UMM_AL_QURA', '2026-01-15',
    ['05:17', '06:40', '12:03', '15:05', '17:26', '18:56'], 2],
  ['الرياض', 24.7136, 46.6753, 'Asia/Riyadh', 'UMM_AL_QURA', '2026-06-15',
    ['03:32', '05:04', '11:54', '15:15', '18:44', '20:14'], 2],
  ['القاهرة', 30.0444, 31.2357, 'Africa/Cairo', 'EGYPT', '2026-01-15',
    ['05:21', '06:52', '12:04', '14:57', '17:17', '18:39'], 2],
  ['القاهرة', 30.0444, 31.2357, 'Africa/Cairo', 'EGYPT', '2026-06-15',
    ['04:08', '05:53', '12:56', '16:31', '19:58', '21:31'], 2],
  // الجداول التركية الرسمية تضيف تعديلات غير موثّقة فوق الحساب الفلكي.
  ['إسطنبول', 41.0082, 28.9784, 'Europe/Istanbul', 'TURKEY', '2026-01-15',
    ['06:50', '08:20', '13:18', '15:44', '18:07', '19:32'], 10],
  ['جاكرتا', -6.2088, 106.8456, 'Asia/Jakarta', 'MWL', '2026-01-15',
    ['04:34', '05:49', '12:02', '15:26', '18:15', '19:26'], 2],
  ['جاكرتا', -6.2088, 106.8456, 'Asia/Jakarta', 'MWL', '2026-06-15',
    ['04:45', '06:00', '11:53', '15:15', '17:46', '18:57'], 2],
  ['كراتشي', 24.8607, 67.0011, 'Asia/Karachi', 'KARACHI', '2026-01-15',
    ['05:58', '07:19', '12:41', '15:43', '18:04', '19:24'], 2],
  ['كراتشي', 24.8607, 67.0011, 'Asia/Karachi', 'KARACHI', '2026-06-15',
    ['04:13', '05:42', '12:32', '15:54', '19:23', '20:52'], 2],
  ['لندن', 51.5074, -0.1278, 'Europe/London', 'MWL', '2026-01-15',
    ['05:59', '08:00', '12:10', '13:59', '16:21', '18:15'], 2],
]

const KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

/** الدقائق منذ منتصف الليل، مقروءة في المنطقة الزمنية للمدينة. */
function minutesInZone(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false, hour: '2-digit', minute: '2-digit',
  }).formatToParts(new Date(timestamp))
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return (get('hour') % 24) * 60 + get('minute')
}

test('المحرّك يطابق الجدول المرجعي في عشر حالات', () => {
  const problems = []

  for (const [city, lat, lng, zone, methodId, date, expected, tolerance] of references) {
    const [y, m, d] = date.split('-').map(Number)
    const day = prayer.calculate(
      new Date(y, m - 1, d),
      lat, lng,
      { ...prayer.defaultPrayerConfig, methodId },
      zone,
    )

    KEYS.forEach((key, index) => {
      const [eh, em] = expected[index].split(':').map(Number)
      const want = eh * 60 + em
      const got = minutesInZone(day.times[key], zone)
      const diff = Math.abs(got - want)
      if (diff > tolerance) {
        const hh = String(Math.floor(got / 60)).padStart(2, '0')
        const mm = String(got % 60).padStart(2, '0')
        problems.push(`${city} ${date} ${key}: توقّعنا ${expected[index]} وحصلنا ${hh}:${mm} (فارق ${diff} د)`)
      }
    })
  }

  assert.equal(problems.length, 0, '\n' + problems.join('\n'))
})

test('القبلة والمسافة إلى الكعبة', () => {
  // من الرياض: القبلة غربًا بميل جنوبي، والمسافة نحو ٧٩٠ كم بخط الدائرة العظمى
  // (٨٧٠ كم تقريبًا مسافة الطريق البرّي — وهي ليست ما نحسبه هنا).
  const bearing = prayer.qiblaBearing(24.7136, 46.6753)
  assert.ok(bearing > 235 && bearing < 250, `اتجاه غير متوقّع: ${bearing}`)

  const distance = prayer.distanceToKaaba(24.7136, 46.6753)
  assert.ok(Math.abs(distance - 790) < 20, `مسافة غير متوقّعة: ${distance}`)

  // من مكة نفسها المسافة صفر تقريبًا.
  assert.ok(prayer.distanceToKaaba(21.4225, 39.8252) < 1)
})

test('الصلاة القادمة والحالية تتبعان اللحظة', () => {
  const day = prayer.calculate(
    new Date(2026, 0, 15), 24.7136, 46.6753,
    { ...prayer.defaultPrayerConfig, methodId: 'UMM_AL_QURA' }, 'Asia/Riyadh',
  )
  const beforeFajr = day.times.fajr - 60_000
  assert.equal(prayer.nextPrayer(day, beforeFajr).key, 'fajr')
  assert.equal(prayer.currentPrayer(day, beforeFajr), null)

  const afterDhuhr = day.times.dhuhr + 60_000
  assert.equal(prayer.currentPrayer(day, afterDhuhr).key, 'dhuhr')
  assert.equal(prayer.nextPrayer(day, afterDhuhr).key, 'asr')

  // الشروق ليس صلاة، فلا يظهر كـ«القادمة».
  const afterFajr = day.times.fajr + 60_000
  assert.equal(prayer.nextPrayer(day, afterFajr).key, 'dhuhr')
})

test('التعديل اليدوي بالدقائق يُطبَّق', () => {
  const base = prayer.calculate(
    new Date(2026, 0, 15), 24.7136, 46.6753, prayer.defaultPrayerConfig, 'Asia/Riyadh',
  )
  const shifted = prayer.calculate(
    new Date(2026, 0, 15), 24.7136, 46.6753,
    { ...prayer.defaultPrayerConfig, offsets: { fajr: 5 } }, 'Asia/Riyadh',
  )
  assert.equal((shifted.times.fajr - base.times.fajr) / 60_000, 5)
  assert.equal(shifted.times.dhuhr, base.times.dhuhr, 'التعديل يخصّ صلاة واحدة')
})
