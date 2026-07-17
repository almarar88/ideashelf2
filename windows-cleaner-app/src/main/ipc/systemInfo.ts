import { ipcMain } from 'electron'
import type { SystemSummary } from '../../shared/types'
import { getSystemSummary } from '../lib/systemInfoLib'

export function registerSystemInfoIpc(): void {
  ipcMain.handle('system:summary', async (): Promise<SystemSummary> => {
    return getSystemSummary()
  })
}
