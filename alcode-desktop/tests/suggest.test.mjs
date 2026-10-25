import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * الاقتراحات السياقية. تُختبر لأنها «الذكاء» الظاهر في الشاشة الرئيسية:
 * اقتراح في غير وقته يبدو غباءً أوضح من غياب الاقتراح أصلًا.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')
const dir = mkdtempSync(join(tmpdir(), 'alc-sg-'))
writeFileSync(join(dir, 'suggest.ts'), readFileSync('src/suggest.ts', 'utf8'))
execFileSync(process.execPath, [tsc, join(dir, 'suggest.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const { suggestionsFor } = requireHere(join(dir, 'suggest.js'))

const at = (hour) => new Date(2026, 9, 25, hour, 0, 0).getTime()
const ids = (list) => list.map((one) => one.id)

test('الصلاة القريبة تتصدّر، والبعيدة لا تُذكر', () => {
  const soon = suggestionsFor(
    { nextPrayer: { arabic: 'المغرب', at: at(17) + 25 * 60_000 }, hasPlace: true },
    at(17),
  )
  assert.equal(ids(soon)[0], 'prayer-soon')
  assert.ok(soon[0].text.includes('المغرب'))

  // بعد خمس ساعات: ليست شاغل اللحظة.
  const later = suggestionsFor(
    { nextPrayer: { arabic: 'الفجر', at: at(17) + 5 * 3_600_000 }, hasPlace: true },
    at(17),
  )
  assert.ok(!ids(later).includes('prayer-soon'))
})

test('ملخّص اليوم صباحًا فقط', () => {
  assert.ok(ids(suggestionsFor({ hasPlace: true }, at(7))).includes('brief'))
  assert.ok(!ids(suggestionsFor({ hasPlace: true }, at(22))).includes('brief'))
})

test('المطر يسبق الحرارة لأنه يغيّر القرار', () => {
  const rainy = suggestionsFor(
    { rainChance: 60, temperature: 41, hasPlace: true }, at(13),
  )
  assert.ok(ids(rainy).includes('rain'))
  assert.ok(!ids(rainy).includes('hot'), 'لا يُعرض الاثنان معًا')

  const hot = suggestionsFor({ rainChance: 5, temperature: 41, hasPlace: true }, at(13))
  assert.ok(ids(hot).includes('hot'))

  // جوّ معتدل بلا مطر: لا اقتراح طقس أصلًا.
  const mild = suggestionsFor({ rainChance: 0, temperature: 24, hasPlace: true }, at(13))
  assert.ok(!ids(mild).includes('hot') && !ids(mild).includes('rain'))
})

test('بلا موقع يُقترح تحديده وحده', () => {
  const list = suggestionsFor(
    { hasPlace: false, tasksOpen: 5, headlines: 20,
      nextPrayer: { arabic: 'العصر', at: at(13) + 60_000 } },
    at(13),
  )
  assert.equal(ids(list)[0], 'place')
  assert.ok(!ids(list).includes('prayer-soon'), 'لا صلاة بلا موقع — اقتراحها كذب')
})

test('القائمة تمتلئ دائمًا وبلا تكرار', () => {
  for (const hour of [3, 7, 13, 19, 23]) {
    const list = suggestionsFor(
      { hasPlace: true, tasksOpen: 2, headlines: 9, temperature: 30, rainChance: 10 },
      at(hour),
    )
    assert.equal(list.length, 4, `الساعة ${hour}`)
    assert.equal(new Set(ids(list)).size, 4, `تكرار في الساعة ${hour}`)
    for (const one of list) assert.ok(one.text.length > 3 && one.icon)
  }
})

test('الحدّ يُحترم ولو توفّر سياق أكثر', () => {
  const list = suggestionsFor(
    { hasPlace: true, tasksOpen: 3, headlines: 12, rainChance: 70,
      nextPrayer: { arabic: 'الظهر', at: at(11) + 30 * 60_000 } },
    at(11), 3,
  )
  assert.equal(list.length, 3)
  assert.equal(ids(list)[0], 'prayer-soon')
})
