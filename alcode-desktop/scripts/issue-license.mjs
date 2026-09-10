#!/usr/bin/env node
import { createPrivateKey, sign } from 'node:crypto'
import { readFileSync, existsSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * يصدر مفتاح ترخيص لمشترٍ.
 *
 *   node scripts/issue-license.mjs buyer@example.com [--tier pro] [--days 365]
 *
 * بلا `--days` يكون الترخيص دائمًا. كل مفتاح يُسجَّل في `licenses-issued.csv`
 * (مستبعَد من Git) لتعرف لمن أصدرت ومتى — تحتاجه للدعم وللمحاسبة.
 */

const [, , email, ...rest] = process.argv

if (!email || !email.includes('@')) {
  console.error('الاستعمال: node scripts/issue-license.mjs buyer@example.com [--tier pro] [--days 365]')
  process.exit(1)
}

const flag = (name, fallback) => {
  const index = rest.indexOf(`--${name}`)
  return index >= 0 && rest[index + 1] ? rest[index + 1] : fallback
}

const tier = flag('tier', 'pro')
const days = Number(flag('days', '0'))

const privatePath = resolve('license-private.pem')
if (!existsSync(privatePath)) {
  console.error(`لا يوجد ${privatePath}. شغّل أولًا: npm run license:keygen`)
  process.exit(1)
}

const payload = {
  email,
  tier,
  issuedAt: Math.floor(Date.now() / 1000),
  // صفر = دائم. نخزّن ثوانٍ لا مللي ثانية ليبقى المفتاح أقصر.
  expiresAt: days > 0 ? Math.floor(Date.now() / 1000) + days * 86400 : 0,
}

const raw = Buffer.from(JSON.stringify(payload), 'utf8')
const privateKey = createPrivateKey(readFileSync(privatePath, 'utf8'))
const signature = sign(null, raw, privateKey)

const b64 = (buffer) => buffer.toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const key = `ALC1.${b64(raw)}.${b64(signature)}`

appendFileSync(
  resolve('licenses-issued.csv'),
  `${new Date().toISOString()},${email},${tier},${days || 'perpetual'},${key}\n`,
)

console.log(`
المشتري : ${email}
الباقة  : ${tier}
المدّة   : ${days > 0 ? `${days} يومًا` : 'دائم'}

المفتاح (أرسله للمشتري):

${key}
`)
