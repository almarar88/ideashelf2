import { execFile } from 'node:child_process'
import { app } from 'electron'
import { runPowerShell, psQuote } from './powershell'
import { isWindows } from './platform'

/** هل يعمل التطبيق حاليًا بصلاحيات المدير؟ */
export async function isElevated(): Promise<boolean> {
  if (!isWindows) return false
  try {
    const out = await runPowerShell(
      '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent())' +
        '.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)',
      10_000
    )
    return out.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

/**
 * يعيد تشغيل التطبيق بصلاحيات المدير عبر UAC ثم يغلق النسخة الحالية.
 * تُستخدم Start-Process -Verb RunAs لأنها الطريقة الوحيدة لطلب رفع الصلاحيات
 * من عملية غير مرفوعة على ويندوز.
 */
export function relaunchAsAdmin(): void {
  if (!isWindows) return
  const exePath = app.getPath('exe')

  execFile(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Start-Process -FilePath ${psQuote(exePath)} -Verb RunAs`
    ],
    { windowsHide: true },
    (error) => {
      // لو رفض المستخدم طلب UAC نُبقي النسخة الحالية تعمل كما هي
      if (!error) app.quit()
    }
  )
}
