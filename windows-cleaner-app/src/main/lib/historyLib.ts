import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from 'electron'
import type { CleanHistoryEntry } from '../../shared/types'
import { runPowerShell, psQuote } from './powershell'
import { isWindows } from './platform'

const MAX_ENTRIES = 200

function historyPath(): string {
  return path.join(app.getPath('userData'), 'clean-history.json')
}

export async function readHistory(): Promise<CleanHistoryEntry[]> {
  try {
    const raw = await fs.readFile(historyPath(), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    // أول تشغيل، أو ملف تالف — نبدأ من سجل فارغ بدل إسقاط العملية
    return []
  }
}

export async function appendHistory(entry: CleanHistoryEntry): Promise<void> {
  const history = await readHistory()
  history.unshift(entry)
  try {
    await fs.writeFile(historyPath(), JSON.stringify(history.slice(0, MAX_ENTRIES), null, 2), 'utf8')
  } catch {
    // فشل الكتابة لا يبرّر إفشال عملية التنظيف نفسها
  }
}

export async function clearHistory(): Promise<void> {
  try {
    await fs.unlink(historyPath())
  } catch {
    // لا يوجد ملف أصلًا
  }
}

/**
 * ينشئ نقطة استعادة نظام قبل تنظيف حسّاس. يتطلب صلاحيات مدير و"حماية النظام"
 * مفعّلة على قرص النظام، ولذلك نعيد رسالة واضحة بدل رمي استثناء.
 */
export async function createRestorePoint(
  description = 'CleanShelf — قبل التنظيف'
): Promise<{ success: boolean; message: string }> {
  if (!isWindows) return { success: false, message: 'متاح على ويندوز فقط' }

  try {
    await runPowerShell(
      `Checkpoint-Computer -Description ${psQuote(description)} ` +
        `-RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop`,
      180_000
    )
    return { success: true, message: 'أُنشئت نقطة استعادة' }
  } catch (err) {
    const message = (err as Error).message
    if (/access is denied|PermissionDenied/i.test(message)) {
      return { success: false, message: 'يتطلب تشغيل التطبيق كمسؤول' }
    }
    if (/System Restore|disabled|shadow/i.test(message)) {
      return {
        success: false,
        message: 'حماية النظام (System Restore) غير مفعّلة على هذا الجهاز'
      }
    }
    // ويندوز يرفض إنشاء أكثر من نقطة واحدة كل 24 ساعة افتراضيًا
    if (/1440|frequency/i.test(message)) {
      return { success: false, message: 'يوجد نقطة استعادة حديثة بالفعل (حد ويندوز: واحدة كل 24 ساعة)' }
    }
    return { success: false, message: message.trim().split('\n')[0] }
  }
}
