/**
 * يولّد icon.ico و icon.png من ملفي الـ SVG المصدريين.
 *
 * التشغيل (لا يحتاج إضافة تبعيات للمشروع):
 *   cd windows-cleaner-app/build
 *   npm install --no-save sharp png-to-ico
 *   node generate-icons.mjs
 *
 * الأحجام الصغيرة (16/24/32) تُولَّد من icon-small.svg المبسّط لأن النسخة
 * التفصيلية تتحوّل إلى بقعة غير مقروءة في شريط المهام.
 */
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const here = path.dirname(new URL(import.meta.url).pathname)
const SMALL_SIZES = [16, 24, 32]
const BIG_SIZES = [48, 64, 128, 256]

const detailed = await fs.readFile(path.join(here, 'icon.svg'))
const small = await fs.readFile(path.join(here, 'icon-small.svg'))

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanshelf-icons-'))
const pngPaths = []

for (const size of [...SMALL_SIZES, ...BIG_SIZES]) {
  const source = SMALL_SIZES.includes(size) ? small : detailed
  const out = path.join(tmpDir, `icon-${size}.png`)
  await sharp(source, { density: 512 }).resize(size, size).png().toFile(out)
  pngPaths.push(out)
}

await sharp(detailed, { density: 512 })
  .resize(512, 512)
  .png()
  .toFile(path.join(here, 'icon.png'))

await fs.writeFile(path.join(here, 'icon.ico'), await pngToIco(pngPaths))
await fs.rm(tmpDir, { recursive: true, force: true })

console.log('تم توليد icon.ico و icon.png')
