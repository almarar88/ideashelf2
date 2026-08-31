import { ipcMain, shell, BrowserWindow } from 'electron'
import path from 'node:path'
import type {
  DirListing,
  DuplicateGroup,
  LargeFileEntry,
  ScanProgress,
  DiskUsageResult,
  BrokenShortcut
} from '../../shared/types'
import {
  listDirectory,
  renameEntry,
  moveEntries,
  createFolder,
  buildBatchRenamePlan,
  applyBatchRename,
  type BatchRenamePlan
} from '../lib/fileManagerLib'
import { findDuplicates, findLargeFiles, searchFiles } from '../lib/duplicatesLib'
import { analyzeFolder, findEmptyFolders, findBrokenShortcuts } from '../lib/diskAnalyzerLib'

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

  // فحص واحد نشط في كل لحظة — يكفي لواجهة لا تسمح ببدء فحصين معًا
  let cancelRequested = false

  function scanHooks(event: Electron.IpcMainInvokeEvent): {
    onProgress: (progress: ScanProgress) => void
    shouldCancel: () => boolean
  } {
    const win = BrowserWindow.fromWebContents(event.sender)
    return {
      onProgress: (progress) => win?.webContents.send('fm:scanProgress', progress),
      shouldCancel: () => cancelRequested
    }
  }

  ipcMain.handle('fm:cancelScan', async () => {
    cancelRequested = true
  })

  ipcMain.handle(
    'fm:findDuplicates',
    async (event, rootPath: string, minSizeBytes: number): Promise<DuplicateGroup[]> => {
      cancelRequested = false
      return findDuplicates(rootPath, minSizeBytes, scanHooks(event))
    }
  )

  ipcMain.handle(
    'fm:findLargeFiles',
    async (event, rootPath: string, minSizeBytes: number): Promise<LargeFileEntry[]> => {
      cancelRequested = false
      return findLargeFiles(rootPath, minSizeBytes, 200, scanHooks(event))
    }
  )

  ipcMain.handle(
    'fm:analyzeFolder',
    async (event, rootPath: string): Promise<DiskUsageResult> => {
      cancelRequested = false
      return analyzeFolder(rootPath, scanHooks(event))
    }
  )

  ipcMain.handle('fm:findEmptyFolders', async (event, rootPath: string): Promise<string[]> => {
    cancelRequested = false
    return findEmptyFolders(rootPath, scanHooks(event))
  })

  ipcMain.handle(
    'fm:findBrokenShortcuts',
    async (event, rootPath: string): Promise<BrokenShortcut[]> => {
      cancelRequested = false
      return findBrokenShortcuts(rootPath, scanHooks(event))
    }
  )

  ipcMain.handle(
    'fm:search',
    async (event, rootPath: string, query: string): Promise<LargeFileEntry[]> => {
      cancelRequested = false
      return searchFiles(rootPath, query, scanHooks(event))
    }
  )

  // حذف مجلدات فارغة: آمن نسبيًا لكنه يمر عبر سلة المحذوفات احتياطًا
  ipcMain.handle('fm:trashPaths', async (_event, paths: string[]) => {
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

  ipcMain.handle('fm:homeDir', async () => {
    return process.platform === 'win32' ? process.env.USERPROFILE || '' : path.resolve('.')
  })
}
