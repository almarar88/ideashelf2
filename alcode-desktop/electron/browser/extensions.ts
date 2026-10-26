import { app, session } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '../startup'

/**
 * إضافات كروم.
 *
 * بصراحة عن الحدّ: إلكترون **لا يدعم** كل واجهات إضافات كروم، ولا يقبل
 * ملفّات `.crx` المعبّأة من متجر كروم — توثيقه ينصّ على الأمرين. فما يعمل
 * هنا هو الإضافة **غير المعبّأة**: مجلّدٌ فيه `manifest.json`، وهو ما
 * تحصل عليه بفكّ ضغط الإضافة أو بتحميلها من مستودعها.
 *
 * وإضافةٌ تطلب واجهةً غير مدعومة تُحمَّل ويُسجَّل تحذيرها بدل أن تسقط
 * بصمت — فيعرف المستخدم لماذا لا تعمل بدل أن يظنّ المتصفّح معطوبًا.
 *
 * التحميل يتكرّر في كل إقلاع: إلكترون لم يعد يتذكّر الإضافات بين
 * التشغيلات، فنحفظ قائمة المجلّدات ونعيد تحميلها.
 */

export interface LoadedExtension {
  id: string
  name: string
  version: string
  path: string
}

export function extensionsDir(): string {
  const dir = join(app.getPath('userData'), 'extensions')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** اسم الإضافة ونسختها من مانيفستها، للعرض قبل التحميل. */
export function describe(path: string): { name: string; version: string } | null {
  try {
    const manifest = JSON.parse(readFileSync(join(path, 'manifest.json'), 'utf8')) as {
      name?: string; version?: string
    }
    return { name: String(manifest.name ?? 'إضافة'), version: String(manifest.version ?? '') }
  } catch {
    return null
  }
}

export async function loadFrom(partition: string, path: string): Promise<LoadedExtension> {
  if (!existsSync(join(path, 'manifest.json'))) {
    throw new Error('المجلّد لا يحوي manifest.json — اختر مجلّد الإضافة نفسه.')
  }
  const ses = session.fromPartition(partition)
  const extension = await ses.extensions.loadExtension(path, { allowFileAccess: false })
  log('حُمّلت إضافة', `${extension.name} ${extension.version}`)
  return {
    id: extension.id,
    name: extension.name,
    version: extension.version,
    path,
  }
}

export function listLoaded(partition: string): LoadedExtension[] {
  return session.fromPartition(partition).extensions.getAllExtensions().map((one) => ({
    id: one.id,
    name: one.name,
    version: one.version,
    path: one.path,
  }))
}

export function unload(partition: string, id: string): void {
  session.fromPartition(partition).extensions.removeExtension(id)
}

/**
 * يعيد تحميل كل مجلّد داخل مجلّد الإضافات.
 *
 * فشل إضافة لا يمنع البقيّة: إضافةٌ واحدة قديمة كانت ستُفرغ المتصفّح من
 * إضافاته كلّها لو رُميت المهمّة عند أول خطأ.
 */
export async function restoreAll(partition: string): Promise<LoadedExtension[]> {
  const dir = extensionsDir()
  const loaded: LoadedExtension[] = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    try {
      if (!statSync(path).isDirectory()) continue
      loaded.push(await loadFrom(partition, path))
    } catch (error) {
      log('تعذّر تحميل إضافة', `${name}: ${String(error)}`)
    }
  }
  return loaded
}
