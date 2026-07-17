import { ipcMain, shell } from 'electron'
import path from 'node:path'
import type { DirListing, DuplicateGroup, LargeFileEntry } from '../../shared/types'
import {
  listDirectory,
  renameEntry,
  moveEntries,
  createFolder,
  buildBatchRenamePlan,
  applyBatchRename,
  type BatchRenamePlan
} from '../lib/fileManagerLib'
import { findDuplicates, findLargeFiles } from '../lib/duplicatesLib'

export function registerFileManagerIpc(): void {
  ipcMain.handle('fm:list', async (_event, targetPath: string | null): Promise<DirListing> => {
    return listDirectory(targetPath)
  })

  ipcMain.handle('fm:rename', async (_event, targetPath: string, newName: string) => {
    return renameEntry(targetPath, newName)
  })

  ipcMain.handle('fm:move', async (_event, paths: string[], destinationDir: string) => {
    await moveEntries(paths, destinationDir)
  })

  ipcMain.handle('fm:createFolder', async (_event, parentDir: string, name: string) => {
    return createFolder(parentDir, name)
  })

  // الحذف يمر دائمًا عبر سلة المحذوفات (قابل للتراجع) — لا حذف نهائي من مدير الملفات
  ipcMain.handle('fm:delete', async (_event, paths: string[]) => {
    const results: { path: string; success: boolean; error?: string }[] = []
    for (const p of paths) {
      try {
        await shell.trashItem(p)
        results.push({ path: p, success: true })
      } catch (err) {
        results.push({ path: p, success: false, error: (err as Error).message })
      }
    }
    return results
  })

  ipcMain.handle('fm:reveal', async (_event, targetPath: string) => {
    shell.showItemInFolder(targetPath)
  })

  ipcMain.handle('fm:openPath', async (_event, targetPath: string) => {
    await shell.openPath(targetPath)
  })

  ipcMain.handle(
    'fm:batchRenamePreview',
    async (_event, paths: string[], pattern: string, startNumber: number): Promise<BatchRenamePlan[]> => {
      return buildBatchRenamePlan(paths, pattern, startNumber)
    }
  )

  ipcMain.handle('fm:batchRenameApply', async (_event, plan: BatchRenamePlan[]) => {
    return applyBatchRename(plan)
  })

  ipcMain.handle(
    'fm:findDuplicates',
    async (_event, rootPath: string, minSizeBytes: number): Promise<DuplicateGroup[]> => {
      return findDuplicates(rootPath, minSizeBytes)
    }
  )

  ipcMain.handle(
    'fm:findLargeFiles',
    async (_event, rootPath: string, minSizeBytes: number): Promise<LargeFileEntry[]> => {
      return findLargeFiles(rootPath, minSizeBytes)
    }
  )

  ipcMain.handle('fm:homeDir', async () => {
    return process.platform === 'win32' ? process.env.USERPROFILE || '' : path.resolve('.')
  })
}
