import { ipcMain, app } from 'electron'
import type { SystemSummary } from '../../shared/types'
import { getSystemSummary } from '../lib/systemInfoLib'
import { isElevated, relaunchAsAdmin } from '../lib/elevation'

export function registerSystemInfoIpc(): void {
  ipcMain.handle('system:summary', async (): Promise<SystemSummary> => {
    return getSystemSummary()
  })

  ipcMain.handle('system:isAdmin', async (): Promise<boolean> => {
    return isElevated()
  })

  ipcMain.handle(
    'system:relaunchAsAdmin',
    async (): Promise<{ started: boolean; message: string }> => {
      if (!app.isPackaged) {
        return {
          started: false,
          message: 'إعادة التشغيل كمسؤول متاحة في النسخة المثبَّتة فقط، وليس في وضع التطوير.'
        }
      }
      relaunchAsAdmin()
      return { started: true, message: 'جارٍ إعادة التشغيل بصلاحيات المدير…' }
    }
  )
}
