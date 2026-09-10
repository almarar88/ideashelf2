import { app, dialog } from 'electron'
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

/**
 * حواجز الإقلاع.
 *
 * السبب: نافذة Electron تُنشأ مخفية وتُظهَر عند أول رسم (`ready-to-show`).
 * فإن انهار الرسم — خطأ في الواجهة، جسر لم يُحمَّل، ملف ناقص — لا يُرسَم شيء،
 * ولا يُطلق الحدث، ولا تظهر النافذة أبدًا: تبقى العملية حيّة في مدير المهام
 * والمستخدم يرى «التطبيق ما يفتح» بلا أي رسالة. حدث هذا فعلًا وأُعيد إنتاجه.
 *
 * القاعدة هنا: لا فشل صامت. كل خطوة تُسجَّل، وكل خطأ يظهر في نافذة حوار،
 * والنافذة تُظهَر في كل الأحوال ولو بصفحة خطأ.
 */

let logPath = ''
let fatalShown = false

function ensureLogPath(): string {
  if (logPath) return logPath
  try {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    logPath = join(dir, 'startup.log')
    // نقصّ السجل إن تجاوز ربع ميغابايت حتى لا ينمو بلا حدّ.
    try {
      if (statSync(logPath).size > 262_144) writeFileSync(logPath, '')
    } catch {
      // لا وجود للملف بعد — طبيعي في أول تشغيل.
    }
  } catch {
    logPath = ''
  }
  return logPath
}

/** يسجّل خطوة إقلاع بطابع زمني. */
export function log(step: string, detail?: unknown): void {
  const stamp = new Date().toISOString()
  const extra = detail === undefined
    ? ''
    : ' — ' + (detail instanceof Error ? `${detail.message}\n${detail.stack ?? ''}` : String(detail))
  const line = `[${stamp}] ${step}${extra}\n`
  const path = ensureLogPath()
  if (path) {
    try {
      appendFileSync(path, line, 'utf8')
    } catch {
      // القرص ممتلئ أو المجلد محمي: نكتفي بالطرفية.
    }
  }
  process.stdout.write(line)
}

/** مسار السجل ليعرضه التطبيق للمستخدم عند الحاجة. */
export function startupLogPath(): string {
  return ensureLogPath()
}

/** آخر أسطر السجل، لعرضها في شاشة التشخيص. */
export function readLogTail(lines = 200): string {
  const path = ensureLogPath()
  if (!path) return ''
  try {
    return readFileSync(path, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return ''
  }
}

/**
 * يعرض الخطأ للمستخدم بدل أن يموت التطبيق بصمت.
 * مرة واحدة فقط: انهيار متسلسل لا يعني عشر نوافذ حوار.
 */
export function reportFatal(where: string, error: unknown): void {
  log(`فشل قاتل في ${where}`, error)
  if (fatalShown) return
  fatalShown = true
  const message = error instanceof Error ? error.message : String(error)
  try {
    dialog.showErrorBox(
      'Alcode Ai — تعذّر الإقلاع',
      `وقف التطبيق عند: ${where}\n\n${message}\n\n` +
      `سجل التفاصيل:\n${startupLogPath()}\n\n` +
      'أرسل هذا السجل ليُعرف السبب بدقة.',
    )
  } catch {
    // قد لا تكون واجهة الحوار جاهزة بعد؛ السجل يبقى.
  }
}

/**
 * يلتقط ما لم يُلتقط. بدونها تصير الأخطاء غير المتوقّعة صمتًا تامًا،
 * وهو أسوأ سلوك ممكن لتطبيق سطح مكتب.
 */
export function installCrashGuards(): void {
  process.on('uncaughtException', (error) => reportFatal('استثناء غير ملتقط', error))
  process.on('unhandledRejection', (reason) => reportFatal('وعد مرفوض بلا معالج', reason))
  app.on('render-process-gone', (_event, _contents, details) => {
    log('عملية العرض انتهت', details.reason)
  })
  app.on('child-process-gone', (_event, details) => {
    log('عملية فرعية انتهت', `${details.type}: ${details.reason}`)
  })
}


// ------------------------------------------------- الإقلاع الآمن

function markerPath(): string {
  try {
    return join(app.getPath('userData'), 'booting.marker')
  } catch {
    return ''
  }
}

/**
 * علامة «إقلاع جارٍ»: تُكتب قبل إنشاء النافذة وتُمحى فور ظهورها.
 *
 * إن وُجدت عند بدء التشغيل فمعناها أن التشغيل السابق مات قبل أن يُظهر شيئًا.
 * أشهر سبب لذلك على ويندوز تعريف رسوميات معطوب: Electron يعلّق في تهيئة GPU
 * فلا يُرسم شيء أبدًا. فنُقلع المرّة التالية بلا تسريع عتادي — أبطأ قليلًا،
 * لكنه يفتح. أفضل من تطبيق لا يفتح وحلٍّ لا يعرفه المستخدم.
 */
export function previousBootFailed(): boolean {
  const path = markerPath()
  return Boolean(path) && existsSync(path)
}

export function markBootStarted(): void {
  const path = markerPath()
  if (!path) return
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(path, new Date().toISOString(), 'utf8')
  } catch {
    // تعذّرت الكتابة: نفقد الحماية لا أكثر.
  }
}

export function markBootSucceeded(): void {
  const path = markerPath()
  if (!path) return
  try {
    rmSync(path, { force: true })
  } catch {
    // لا شيء نفعله؛ أسوأ ما يحدث إقلاع بلا تسريع في المرّة القادمة.
  }
}
