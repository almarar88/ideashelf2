import { ipcMain } from 'electron'
import type { InstalledApp, LeftoverItem, UninstallResult } from '../../shared/types'
import {
  listInstalledApps,
  runUninstallCommand,
  findLeftovers,
  removeLeftoverFolder
} from '../lib/uninstallerLib'

export function registerUninstallerIpc(): void {
  ipcMain.handle('uninstaller:list', async (): Promise<InstalledApp[]> => {
    return listInstalledApps()
  })

  ipcMain.handle(
    'uninstaller:uninstall',
    async (_event, app: InstalledApp): Promise<UninstallResult> => {
      const command = app.quietUninstallString || app.uninstallString
      const result = await runUninstallCommand(command)
      return { key: app.key, success: result.success, message: result.message }
    }
  )

  ipcMain.handle(
    'uninstaller:findLeftovers',
    async (_event, appName: string, publisher: string): Promise<LeftoverItem[]> => {
      return findLeftovers(appName, publisher)
    }
  )

  ipcMain.handle('uninstaller:removeLeftover', async (_event, target: string): Promise<void> => {
    await removeLeftoverFolder(target)
  })
}
