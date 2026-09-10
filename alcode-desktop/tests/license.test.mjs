import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { generateKeyPairSync, createPrivateKey, sign } from 'node:crypto'

/**
 * اختبارات الترخيص.
 *
 * تولّد زوج مفاتيح حقيقيًا وتوقّع به، فتغطّي سلسلة التحقّق كاملة لا محاكاة
 * لها. الحرج هنا أن يُرفض المفتاح المزوّر: خطأ في هذا الاتجاه يعني منتجًا
 * مجّانيًا للجميع بلا أن يلاحظ أحد.
 */

const requireHere = createRequire(import.meta.url)
const tsc = requireHere.resolve('typescript/bin/tsc')

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).trim()
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })

/** يترجم وحدة الترخيص بمفتاح عامّ مُعطى (أو بلا مفتاح). */
function loadLicense(pem) {
  const dir = mkdtempSync(join(tmpdir(), 'alc-lic-'))
  const source = readFileSync('electron/license.ts', 'utf8')
    .replace("import { PUBLIC_KEY_PEM } from './licenseKey'", `const PUBLIC_KEY_PEM = \`${pem}\``)
    .replace("import { stores } from './store'", 'const stores = { license: null }')
  const file = join(dir, 'license.ts')
  writeFileSync(file, source)
  execFileSync(process.execPath, [tsc, file, '--outDir', dir, '--module', 'commonjs',
    '--target', 'es2022', '--moduleResolution', 'node', '--skipLibCheck'], { stdio: 'pipe' })
  return requireHere(join(dir, 'license.js'))
}

const lic = loadLicense(publicPem)
const open = loadLicense('')

function issue({ email = 'buyer@example.com', tier = 'pro', expiresAt = 0 } = {}) {
  const raw = Buffer.from(JSON.stringify({
    email, tier, expiresAt, issuedAt: Math.floor(Date.now() / 1000),
  }), 'utf8')
  const signature = sign(null, raw, createPrivateKey(privatePem))
  const b64 = (b) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `ALC1.${b64(raw)}.${b64(signature)}`
}

test('المفتاح الصحيح يُقبل بحمولته', () => {
  const payload = lic.verifyKey(issue({ email: 'a@b.com' }))
  assert.ok(payload)
  assert.equal(payload.email, 'a@b.com')
  assert.equal(payload.tier, 'pro')
})

test('المفتاح المزوّر أو المعبوث به يُرفض', () => {
  const good = issue()
  const [, payloadPart, signaturePart] = good.split('.')

  // توقيع صحيح على حمولة مبدّلة: الهجوم البديهي.
  const forged = Buffer.from(JSON.stringify({
    email: 'thief@example.com', tier: 'pro', expiresAt: 0, issuedAt: 1,
  })).toString('base64url')
  assert.equal(lic.verifyKey(`ALC1.${forged}.${signaturePart}`), null)

  // توقيع مبدّل على حمولة صحيحة.
  const flipped = Buffer.from(signaturePart, 'base64url')
  flipped[0] ^= 0xff
  assert.equal(lic.verifyKey(`ALC1.${payloadPart}.${flipped.toString('base64url')}`), null)

  // مفتاح من زوج آخر تمامًا.
  const other = generateKeyPairSync('ed25519')
  const raw = Buffer.from(JSON.stringify({ email: 'x@y.z', tier: 'pro', expiresAt: 0, issuedAt: 1 }))
  const otherSig = sign(null, raw, other.privateKey)
  assert.equal(
    lic.verifyKey(`ALC1.${raw.toString('base64url')}.${otherSig.toString('base64url')}`),
    null,
  )

  // أشكال تالفة لا تُسقط التطبيق.
  for (const bad of ['', 'ALC1', 'ALC1.x', 'ALC2.a.b', 'كلام عربي', 'ALC1..', good.slice(0, -4)]) {
    assert.equal(lic.verifyKey(bad), null, `قُبل مفتاح تالف: ${bad}`)
  }
})

test('انتهاء الصلاحية يُحترم، والصفر يعني دائمًا', () => {
  const now = Date.UTC(2026, 5, 1)
  const expired = lic.verifyKey(issue({ expiresAt: Math.floor(now / 1000) - 10 }))
  assert.equal(lic.isExpired(expired, now), true)

  const future = lic.verifyKey(issue({ expiresAt: Math.floor(now / 1000) + 86400 }))
  assert.equal(lic.isExpired(future, now), false)

  assert.equal(lic.isExpired(lic.verifyKey(issue({ expiresAt: 0 })), now), false)
})

test('التجربة تُحتسب بالأيام وتنتهي', () => {
  const start = Date.UTC(2026, 0, 1)
  assert.equal(lic.trialDaysLeft(start, start), lic.TRIAL_DAYS)
  assert.equal(lic.trialDaysLeft(start, start + 3 * 86_400_000), lic.TRIAL_DAYS - 3)
  assert.equal(lic.trialDaysLeft(start, start + 99 * 86_400_000), 0)
})

test('ترتيب الحالات: مفتاح، ثم تجربة، ثم مجّاني', () => {
  const start = Date.UTC(2026, 0, 1)
  const during = start + 2 * 86_400_000
  const after = start + 60 * 86_400_000

  const licensed = lic.resolveState(issue(), start, after)
  assert.equal(licensed.tier, 'pro')
  assert.equal(licensed.source, 'licensed')

  const trial = lic.resolveState('', start, during)
  assert.equal(trial.tier, 'pro')
  assert.equal(trial.source, 'trial')
  assert.ok(trial.trialDaysLeft > 0)

  const lapsed = lic.resolveState('', start, after)
  assert.equal(lapsed.tier, 'free')
  assert.equal(lapsed.valid, false)
  assert.ok(lapsed.message.includes('الرفيق اليومي'))

  // مفتاح منتهٍ داخل التجربة: يعمل، ويُقال له السبب.
  const expiredInTrial = lic.resolveState(
    issue({ expiresAt: Math.floor(start / 1000) + 1 }), start, during,
  )
  assert.equal(expiredInTrial.tier, 'pro')
  assert.ok(expiredInTrial.message.includes('انتهت صلاحية'))
})

test('بناء بلا مفتاح عامّ يعمل بلا قيد', () => {
  assert.equal(open.licensingEnabled(), false)
  const state = open.resolveState('', 0, Date.now())
  assert.equal(state.tier, 'pro')
  assert.equal(state.source, 'unlicensed-build')
  assert.equal(state.valid, true)
})
