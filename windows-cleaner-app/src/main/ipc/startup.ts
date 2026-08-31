import { ipcMain } from 'electron'
import type { StartupItem } from '../../shared/types'
import { listStartupItems, setStartupItemEnabled, removeStartupItem } from '../lib/startupLib'

export function registerStartupIpc(): void {
  ipcMain.handle('startup:list', async (): Promise<StartupItem[]> => {
    return listStartupItems()
  })

  ipcMain.handle('startup:setEnabled', async (_event, item: StartupItem, enabled: boolean) => {
    await setStartupItemEnabled(item, enabled)
  })

  ipcMain.handle('startup:remove', async (_event, item: StartupItem) => {
    await removeStartupItem(item)
  })
}
