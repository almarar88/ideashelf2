import fs from 'node:fs'
import { app, BrowserWindow } from 'electron'
import { getSystemSummary } from './lib/systemInfoLib'
import { CATEGORY_DEFS, scanCategory } from './lib/cleanerCategories'
import { listInstalledApps } from './lib/uninstallerLib'
import { listStartupItems } from './lib/startupLib'
import { listDrives } from './lib/fileManagerLib'
import { isElevated } from './lib/elevation'
import { listProcesses } from './lib/processesLib'
import { listServices } from './lib/servicesLib'
import { listAdapters } from './lib/networkLib'
import { analyzeFolder } from './lib/diskAnalyzerLib'
import { readHistory } from './lib/historyLib'

/**
 * فحص تشغيل سريع للنسخة المبنية: يتأكد أن النافذة تُحمَّل فعلًا، وأن جسر
 * preload وصل للواجهة، وأن منطق العملية الرئيسية يعمل على ويندوز حقيقي.
 * يعمل فقط عند ضبط CLEANSHELF_SMOKE_TEST=1، ويُنهي التطبيق برمز خروج.
 */
export async function runSmokeTest(win: BrowserWindow): Promise<void> {
  const lines: string[] = []
  const failures: string[] = []

  const timeout = setTimeout(() => {
    finish('انتهت المهلة (120 ثانية) قبل اكتمال الفحص')
  }, 120_000)

  function log(line: string): void {
    lines.push(line)
    console.log(line)
  }

  function finish(fatal?: string): void {
    clearTimeout(timeout)
    if (fatal) failures.push(fatal)
    const summary = [
      ...lines,
      '',
      failures.length ? `فشل ${failures.length}:` : 'كل الفحوصات نجحت ✅',
      ...failures
    ].join('\n')

    const logPath = process.env['CLEANSHELF_SMOKE_LOG']
    if (logPath) {
      try {
        fs.writeFileSync(logPath, summary, 'utf8')
      } catch {
        // لا شيء نفعله لو تعذّرت الكتابة — رمز الخروج هو المرجع
      }
    }
    console.log(summary)
    app.exit(failures.length === 0 ? 0 : 1)
  }

  async function check(name: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      const result = await fn()
      log(`✔ ${name}: ${result}`)
    } catch (err) {
      const message = `✘ ${name}: ${(err as Error).message}`
      log(message)
      failures.push(message)
    }
  }

  // React قد يكون في منتصف أول رسم عند ready-to-show، فنعيد المحاولة بدل التذبذب
  async function retry<T>(fn: () => Promise<T>, attempts = 20, delayMs = 500): Promise<T> {
    let lastError: unknown
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
    throw lastError
  }

  // 1) الواجهة: هل حُمّلت React فعلًا؟ (يكشف كسر CSP أو مسار index.html)
  await check('تحميل الواجهة', async () =>
    retry(async () => {
      const navCount = await win.webContents.executeJavaScript(
        'document.querySelectorAll(".nav-item").length'
      )
      if (!navCount || navCount < 1) throw new Error('لم تُرسم عناصر الواجهة')
      return `${navCount} عنصر تنقّل`
    })
  )

  // 2) جسر preload: هل وصل window.api للواجهة؟
  await check('جسر preload', async () =>
    retry(async () => {
      const apiShape = await win.webContents.executeJavaScript(
        'typeof window.api?.cleaner?.scan + "," + typeof window.api?.fm?.list'
      )
      if (apiShape !== 'function,function') throw new Error(`window.api غير مكتمل: ${apiShape}`)
      return 'window.api متاح'
    })
  )

  // 3) منطق العملية الرئيسية على ويندوز حقيقي
  await check('معلومات النظام', async () => {
    const summary = await getSystemSummary()
    return `${summary.osName} — ${summary.disks.length} قرص`
  })

  await check('قائمة الأقراص', async () => (await listDrives()).join(' '))

  await check('فحص فئة تنظيف', async () => {
    const def = CATEGORY_DEFS.find((c) => c.id === 'user_temp')!
    const result = await scanCategory(def)
    return `${result.fileCount} ملف / ${result.sizeBytes} بايت`
  })

  await check('قائمة البرامج المثبَّتة', async () => {
    const apps = await listInstalledApps()
    if (apps.length === 0) throw new Error('لم يُقرأ أي برنامج من السجل')
    return `${apps.length} برنامج`
  })

  await check('برامج بدء التشغيل', async () => `${(await listStartupItems()).length} عنصر`)

  await check('كشف صلاحيات المدير', async () => String(await isElevated()))

  await check('قائمة العمليات', async () => {
    const list = await listProcesses()
    if (list.length === 0) throw new Error('لم تُقرأ أي عملية')
    return `${list.length} عملية`
  })

  await check('خدمات ويندوز', async () => {
    const list = await listServices()
    if (list.length === 0) throw new Error('لم تُقرأ أي خدمة')
    return `${list.length} خدمة`
  })

  await check('محوّلات الشبكة', async () => `${(await listAdapters()).length} محوّل`)

  await check('تحليل المساحة', async () => {
    const result = await analyzeFolder(process.env['TEMP'] || 'C:\\Windows\\Temp')
    return `${result.children.length} عنصر / ${result.totalBytes} بايت`
  })

  await check('سجل التنظيف', async () => `${(await readHistory()).length} قيد`)

  finish()
}
