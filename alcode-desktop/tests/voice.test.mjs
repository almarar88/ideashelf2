import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

/**
 * منطق الصوت الخالص: تقطيع الجُمل وتنظيف النصّ للنطق.
 *
 * الخطأ هنا يُدفع ثمنه حرفًا حرفًا: ElevenLabs يحاسب بالحرف، فنطق علامات
 * Markdown أو تلاوة كتلة شيفرة كاملة خسارةُ مالٍ وجودةٍ معًا.
 */
const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')

function loadVoice() {
  const dir = mkdtempSync(join(tmpdir(), 'alc-voice-'))
  // نأخذ الدوالّ الخالصة فقط: الباقي يمسّ DOM ولا يعمل خارج المتصفّح.
  const source = readFileSync('src/voice.ts', 'utf8')
  const cut = source.indexOf('// ------------------------------------------------------- تشغيل الصوت')
  const file = join(dir, 'voice.ts')
  writeFileSync(file, source.slice(0, cut))
  execFileSync(process.execPath, [tsc, file, '--outDir', dir, '--module', 'commonjs',
    '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck'], { stdio: 'pipe' })
  return requireHere(join(dir, 'voice.js'))
}

const voice = loadVoice()

test('الجُمل تُقتطع عند الترقيم العربي والإنجليزي', () => {
  const first = voice.takeSentences('فتحت المجلد. وجدت ثلاثة ملفات؟ الباقي')
  assert.deepEqual(first.ready, ['فتحت المجلد.', 'وجدت ثلاثة ملفات؟'])
  assert.equal(first.rest, 'الباقي')

  // الفاصلة المنقوطة العربية وعلامة التعجّب.
  const second = voice.takeSentences('تمّ؛ انتهيت!')
  assert.equal(second.ready.length, 2)
})

test('الجملة غير المكتملة تبقى في المخزن حتى تكتمل', () => {
  const partial = voice.takeSentences('أنا أعمل على')
  assert.deepEqual(partial.ready, [])
  assert.equal(partial.rest, 'أنا أعمل على')

  // نحاكي البثّ: نضيف ونقتطع كما تفعل الواجهة.
  let buffer = ''
  const spoken = []
  for (const delta of ['رتّبت ', 'الملفات. ', 'وجدت ', 'خمسة عشر ملفًا.']) {
    buffer += delta
    const step = voice.takeSentences(buffer)
    spoken.push(...step.ready)
    buffer = step.rest
  }
  assert.deepEqual(spoken, ['رتّبت الملفات.', 'وجدت خمسة عشر ملفًا.'])
  assert.equal(buffer, '')
})

test('الترقيم وحده لا يصير نداء شبكة مدفوعًا', () => {
  // نقاط متتالية أو رمز وحيد: لا يستحقّ نطقًا منفصلًا.
  const result = voice.takeSentences('...!!! ')
  assert.deepEqual(result.ready, [])
})

test('تنظيف النصّ يمنع نطق علامات Markdown', () => {
  const clean = voice.speakable('**تمّ** الأمر `npm install` بنجاح')
  assert.ok(!clean.includes('*'), 'النجوم تُنطق حرفيًا لو بقيت')
  assert.ok(!clean.includes('`'))
  assert.ok(clean.includes('npm install'))

  // كتلة الشيفرة تُختصر ولا تُتلى.
  const code = voice.speakable('جرّب:\n```bash\nrm -rf /tmp/x\nls -la\n```\nوانتهى')
  assert.ok(!code.includes('rm -rf'), 'كتلة الشيفرة تُتلى سطرًا سطرًا لو بقيت')
  assert.ok(code.includes('شيفرة'))
  assert.ok(code.includes('وانتهى'))

  // الروابط: النصّ يبقى والعنوان يسقط.
  const link = voice.speakable('راجع [التوثيق](https://example.com/very/long/path) الآن')
  assert.ok(link.includes('التوثيق'))
  assert.ok(!link.includes('example.com'))

  // رابط عارٍ يُستبدل بكلمة بدل تهجئة حروفه.
  assert.ok(voice.speakable('حمّله من https://a.io/b').includes('رابط'))

  // العناوين والقوائم لا تُنطق رموزها.
  const list = voice.speakable('## العنوان\n- أول\n- ثاني')
  assert.ok(!list.includes('#'))
  assert.ok(!list.includes('-'))
  assert.ok(list.includes('أول'))
})

test('النصّ الفارغ أو الرموز وحدها لا تُنطق', () => {
  assert.equal(voice.speakable('   '), '')
  assert.equal(voice.speakable('***'), '')
})
