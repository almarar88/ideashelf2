import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/**
 * وضوح النصّ، مقيسًا من ملفّ الألوان نفسه.
 *
 * السبب: نصّ أبيض على بطاقة شفافيتها ١٠٪ فوق سطح أبيض — أي أبيض على
 * أبيض. بدا سليمًا في الكود وغير مقروء على الجهاز. التقدير بالعين هو ما
 * أوصلنا إلى هناك، فصارت النسب تُقاس هنا وتُفرض.
 *
 * الحدود من WCAG: ٤٫٥ للنصّ العادي و٣ للكبير وعناصر الواجهة.
 */
const css = readFileSync('src/theme.css', 'utf8')

/** يقرأ قيمة متغيّر من كتلة :root أو من كتلة الوضع الداكن. */
function token(name, dark = false) {
  const blocks = css.split(/\n(?=[^\s}])/)
  const scope = dark
    ? css.slice(css.search(/\[data-theme=["']dark["']\]|prefers-color-scheme:\s*dark/))
    : css.slice(0, css.search(/\[data-theme=["']dark["']\]|prefers-color-scheme:\s*dark/))
  const matches = [...scope.matchAll(new RegExp(`--${name}:\\s*([^;]+);`, 'g'))]
  assert.ok(matches.length, `المتغيّر --${name} غير موجود (${dark ? 'داكن' : 'فاتح'})`)
  return matches[matches.length - 1][1].trim()
}

function parse(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const n = parseInt(hex[1], 16)
    return { r: (n >> 16) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 }
  }
  const rgba = value.match(/rgba?\(([^)]+)\)/)
  assert.ok(rgba, `لون غير مفهوم: ${value}`)
  const parts = rgba[1].split(',').map((p) => Number(p.trim()))
  return { r: parts[0] / 255, g: parts[1] / 255, b: parts[2] / 255, a: parts[3] ?? 1 }
}

const over = (fg, bg) => ({
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a),
  a: 1,
})

function luminance(c) {
  const f = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
}

function ratio(a, b) {
  const x = luminance(a)
  const y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function check(inkName, softName, dark, min = 4.5) {
  const surface = parse(token('surface', dark))
  const bg = over(parse(token(softName, dark)), surface)
  const ink = over(parse(token(inkName, dark)), bg)
  const r = ratio(ink, bg)
  assert.ok(
    r >= min,
    `${inkName} على ${softName} (${dark ? 'داكن' : 'فاتح'}) — ${r.toFixed(2)} أقلّ من ${min}`,
  )
}

for (const dark of [false, true]) {
  const mode = dark ? 'داكن' : 'فاتح'

  test(`النصّ الأساسي والثانوي واضحان — ${mode}`, () => {
    const surface = parse(token('surface', dark))
    const bg = parse(token('bg', dark))
    for (const [name, base] of [['surface', surface], ['bg', bg]]) {
      const label = over(parse(token('label', dark)), base)
      assert.ok(ratio(label, base) >= 4.5,
        `label على ${name} (${mode}) — ${ratio(label, base).toFixed(2)}`)
    }
  })

  test(`حبر كل لون واضح على خلفيته الباهتة — ${mode}`, () => {
    check('accent-ink', 'accent-soft', dark)
    check('green-ink', 'green-soft', dark)
    check('amber-ink', 'amber-soft', dark)
    check('red-ink', 'red-soft', dark)
    check('violet-ink', 'violet-soft', dark)
    check('teal-ink', 'teal-soft', dark)
  })

  test(`حبر كل لون واضح على السطح العادي — ${mode}`, () => {
    const surface = parse(token('surface', dark))
    for (const name of ['accent-ink', 'green-ink', 'amber-ink', 'red-ink', 'violet-ink', 'teal-ink']) {
      const ink = over(parse(token(name, dark)), surface)
      const r = ratio(ink, surface)
      assert.ok(r >= 4.5, `${name} على السطح (${mode}) — ${r.toFixed(2)}`)
    }
  })
}
