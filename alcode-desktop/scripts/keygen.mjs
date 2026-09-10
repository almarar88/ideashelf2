#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * يولّد زوج مفاتيح Ed25519 للتوقيع على التراخيص.
 *
 * المفتاح الخاصّ يُكتب في `license-private.pem` وهو **مستبعَد من Git**.
 * من يملكه يستطيع إصدار تراخيص مجّانية لنفسه وللعالم، ومن يفقده يفقد قدرته
 * على إصدار تراخيص جديدة لكل من اشترى (فالتطبيقات الموزّعة تحمل العامّ).
 * احفظ نسخة منه في مكان آمن خارج جهازك قبل أي شيء آخر.
 */

const privatePath = resolve('license-private.pem')

if (existsSync(privatePath) && !process.argv.includes('--force')) {
  console.error(
    `\n⚠️  ${privatePath} موجود بالفعل.\n` +
    'توليد زوج جديد يُبطل كل التراخيص التي أصدرتها بالقديم.\n' +
    'إن كنت متأكّدًا: npm run license:keygen -- --force\n',
  )
  process.exit(1)
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519')

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' })
const publicPem = publicKey.export({ type: 'spki', format: 'pem' })

writeFileSync(privatePath, privatePem, { mode: 0o600 })

console.log(`
✅ تولّد زوج المفاتيح.

المفتاح الخاصّ  →  ${privatePath}   (لا يُرفع إلى Git — احفظه خارج جهازك)

الآن ضع المفتاح العامّ في electron/licenseKey.ts:

export const PUBLIC_KEY_PEM = \`
${publicPem.trim()}
\`

ثم ابنِ نسخة التوزيع. أي بناء بلا مفتاح عامّ يعمل بلا قيود.
`)
