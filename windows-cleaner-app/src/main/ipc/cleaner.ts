import { ipcMain, BrowserWindow } from 'electron'
import type { CleanerScanResult, CleanProgress } from '../../shared/types'
import { CATEGORY_DEFS, scanCategory, clearDirectoryContents } from '../lib/cleanerCategories'

export function registerCleanerIpc(): void {
  ipcMain.handle('cleaner:scan', async (): Promise<CleanerScanResult> => {
    const categories = await Promise.all(
      CATEGORY_DEFS.map(async (def) => {
        try {
          const { sizeBytes, fileCount } = await scanCategory(def)
          return {
            id: def.id,
            labelKey: def.labelKey,
            path: null,
            sizeBytes,
            fileCount,
            scanned: true,
            risk: def.risk,
            requiresAdmin: def.requiresAdmin
          }
        } catch (err) {
          return {
            id: def.id,
            labelKey: def.labelKey,
            path: null,
            sizeBytes: 0,
            fileCount: 0,
            scanned: false,
            error: (err as Error).message,
            risk: def.risk,
            requiresAdmin: def.requiresAdmin
          }
        }
      })
    )
    const totalBytes = categories.reduce((sum, c) => sum + c.sizeBytes, 0)
    return { categories, totalBytes }
  })

  ipcMain.handle(
    'cleaner:clean',
    async (event, categoryIds: string[]): Promise<{ totalFreedBytes: number }> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      let totalFreedBytes = 0
      for (const id of categoryIds) {
        const def = CATEGORY_DEFS.find((c) => c.id === id)
        if (!def) continue
        const progress: CleanProgress = { categoryId: id, done: false, freedBytes: 0 }
        win?.webContents.send('cleaner:progress', progress)
        try {
          let freed = 0
          if (def.customClean) {
            freed = await def.customClean()
          } else {
            const { existingPaths } = await scanCategory(def)
            for (const p of existingPaths) {
              freed += await clearDirectoryContents(p)
            }
          }
          totalFreedBytes += freed
          win?.webContents.send('cleaner:progress', {
            categoryId: id,
            done: true,
            freedBytes: freed
          } satisfies CleanProgress)
        } catch (err) {
          win?.webContents.send('cleaner:progress', {
            categoryId: id,
            done: true,
            freedBytes: 0,
            error: (err as Error).message
          } satisfies CleanProgress)
        }
      }
      return { totalFreedBytes }
    }
  )
}
