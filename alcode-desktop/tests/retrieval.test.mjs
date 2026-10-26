import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * انتقاء ما يراه المساعد.
 *
 * الحالات هنا تقابل حالةً بحالة اختبارات الأندرويد (RetrievalTest.kt):
 * نسختان من نفس المنطق، وإن انحرفت إحداهما سقط اختبار على أحد الطرفين.
 * وهو ما يهمّ: نفس السؤال يجب أن يُنتج نفس السياق على الهاتف والحاسوب.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')
const dir = mkdtempSync(join(tmpdir(), 'awn-retrieval-'))
writeFileSync(join(dir, 'retrieval.ts'), readFileSync('electron/retrieval.ts', 'utf8'))
execFileSync(process.execPath, [tsc, join(dir, 'retrieval.ts'), '--outDir', dir,
  '--module', 'commonjs', '--target', 'es2022', '--moduleResolution', 'node',
  '--skipLibCheck'], { stdio: 'pipe' })
const { normalizeArabic, stemArabic, tokens, rank } = requireHere(join(dir, 'retrieval.js'))

const memory = (text, createdAt = 0) => ({ text, createdAt })

test('التشكيل لا يمنع المطابقة', () => {
  assert.equal(normalizeArabic('الصَّلاة'), normalizeArabic('الصلاة'))
})

test('الهمزات والتاء المربوطة والألف المقصورة تتوحّد', () => {
  assert.equal(normalizeArabic('أحمد'), 'احمد')
  assert.equal(normalizeArabic('مكة'), 'مكه')
  assert.equal(normalizeArabic('مستشفى'), 'مستشفي')
})

test('الأرقام العربية تصير لاتينية', () => {
  assert.equal(normalizeArabic('٢٠٢٦'), '2026')
})

test('ال التعريف وحروف الجرّ لا تمنع المطابقة', () => {
  assert.equal(stemArabic('الكتاب'), stemArabic('كتاب'))
  assert.equal(stemArabic('بالكتاب'), stemArabic('كتاب'))
})

test('التجذير لا يقصّر إلى جذر يطابق كل شيء', () => {
  assert.ok(stemArabic('كتب').length >= 3)
  assert.ok(stemArabic('الم').length >= 3)
})

test('أدوات الربط تُستبعد', () => {
  const words = tokens('ما هو الطقس في دبي اليوم')
  assert.ok(!words.includes('ما'))
  assert.ok(!words.includes('في'))
  assert.ok(words.includes('دبي'))
})

test('الذكرى ذات الصلة تسبق الأحدث', () => {
  const items = [
    memory('عندي حساسية من الفول السوداني', 1),
    memory('أعمل في شركة برمجيات', 50),
    memory('أحب القهوة بلا سكر', 60),
    memory('اجتماع الفريق كل اثنين', 70),
  ]
  const top = rank('هل أقدر آكل حلوى فيها فول سوداني؟', items, 1, (m) => m.text)
  assert.equal(top[0].text, 'عندي حساسية من الفول السوداني')
})

test('المطابقة تعمل رغم اختلاف ال التعريف والتشكيل', () => {
  const items = [memory('أصلّي الفجر في المسجد'), memory('أفضّل الرياضة مساءً')]
  assert.equal(rank('متى صلاة فجر؟', items, 1, (m) => m.text)[0].text, 'أصلّي الفجر في المسجد')
})

test('الكلمة الشائعة تزن أقلّ من النادرة', () => {
  const items = [
    memory('مشروع التقرير السنوي متأخّر'),
    memory('مشروع المطبخ انتهى'),
    memory('مشروع الموقع قيد العمل'),
    memory('كلمة السرّ في الخزنة'),
  ]
  assert.equal(rank('مشروع الخزنة', items, 1, (m) => m.text)[0].text, 'كلمة السرّ في الخزنة')
})

test('النصّ الطويل لا يفوز بطوله وحده', () => {
  const items = [
    memory('القطة اسمها لولو'),
    memory('كلام كثير ' + 'عن أمور متنوعة '.repeat(30) + ' وفيه ذكر القطة مرّة'),
  ]
  assert.equal(rank('ما اسم القطة؟', items, 1, (m) => m.text)[0].text, 'القطة اسمها لولو')
})

test('بلا سؤال ذي معنى نعود إلى الأحدث', () => {
  const items = [memory('قديمة', 1), memory('حديثة', 99)]
  const top = rank('؟؟؟', items, 1, (m) => m.text, (m) => m.createdAt)
  assert.equal(top[0].text, 'حديثة')
})

test('ما لا صلة له يُستبعد ولا يُحشى بصفر', () => {
  const items = [memory('القطة اسمها لولو'), memory('الاجتماع الساعة ثلاثة')]
  assert.equal(rank('ما اسم القطة؟', items, 5, (m) => m.text).length, 1)
})

test('الفارغة والحدّ صفر لا يرميان', () => {
  assert.deepEqual(rank('سؤال', [], 5, (m) => m.text), [])
  assert.deepEqual(rank('سؤال', [memory('شيء')], 0, (m) => m.text), [])
})

test('الحدّ الأعلى محترم', () => {
  const items = Array.from({ length: 40 }, (_, i) => memory(`مهمة رقم ${i} عن المشروع`))
  assert.equal(rank('المشروع', items, 12, (m) => m.text).length, 12)
})
