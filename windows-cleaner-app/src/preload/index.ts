import { contextBridge, ipcRenderer } from 'electron'
import type {
  CleanerScanResult,
  CleanProgress,
  InstalledApp,
  UninstallResult,
  LeftoverItem,
  DirListing,
  DuplicateGroup,
  LargeFileEntry,
  AudioTag,
  AudioTagWrite,
  StartupItem,
  SystemSummary
} from '../shared/types'
import type { BatchRenamePlan, BatchRenameResult } from '../main/lib/fileManagerLib'

const api = {
  cleaner: {
    scan: (): Promise<CleanerScanResult> => ipcRenderer.invoke('cleaner:scan'),
    clean: (categoryIds: string[]): Promise<{ totalFreedBytes: number }> =>
      ipcRenderer.invoke('cleaner:clean', categoryIds),
    onProgress: (listener: (p: CleanProgress) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: CleanProgress): void => listener(p)
      ipcRenderer.on('cleaner:progress', handler)
      return (): void => {
        ipcRenderer.removeListener('cleaner:progress', handler)
      }
    }
  },
  uninstaller: {
    list: (): Promise<InstalledApp[]> => ipcRenderer.invoke('uninstaller:list'),
    uninstall: (app: InstalledApp): Promise<UninstallResult> =>
      ipcRenderer.invoke('uninstaller:uninstall', app),
    findLeftovers: (appName: string, publisher: string): Promise<LeftoverItem[]> =>
      ipcRenderer.invoke('uninstaller:findLeftovers', appName, publisher),
    removeLeftover: (target: string): Promise<void> =>
      ipcRenderer.invoke('uninstaller:removeLeftover', target)
  },
  fm: {
    list: (targetPath: string | null): Promise<DirListing> => ipcRenderer.invoke('fm:list', targetPath),
    rename: (targetPath: string, newName: string): Promise<string> =>
      ipcRenderer.invoke('fm:rename', targetPath, newName),
    move: (paths: string[], destinationDir: string): Promise<void> =>
      ipcRenderer.invoke('fm:move', paths, destinationDir),
    createFolder: (parentDir: string, name: string): Promise<string> =>
      ipcRenderer.invoke('fm:createFolder', parentDir, name),
    delete: (paths: string[]): Promise<{ path: string; success: boolean; error?: string }[]> =>
      ipcRenderer.invoke('fm:delete', paths),
    reveal: (targetPath: string): Promise<void> => ipcRenderer.invoke('fm:reveal', targetPath),
    openPath: (targetPath: string): Promise<void> => ipcRenderer.invoke('fm:openPath', targetPath),
    batchRenamePreview: (paths: string[], pattern: string, startNumber: number): Promise<BatchRenamePlan[]> =>
      ipcRenderer.invoke('fm:batchRenamePreview', paths, pattern, startNumber),
    batchRenameApply: (plan: BatchRenamePlan[]): Promise<BatchRenameResult> =>
      ipcRenderer.invoke('fm:batchRenameApply', plan),
    findDuplicates: (rootPath: string, minSizeBytes: number): Promise<DuplicateGroup[]> =>
      ipcRenderer.invoke('fm:findDuplicates', rootPath, minSizeBytes),
    findLargeFiles: (rootPath: string, minSizeBytes: number): Promise<LargeFileEntry[]> =>
      ipcRenderer.invoke('fm:findLargeFiles', rootPath, minSizeBytes),
    homeDir: (): Promise<string> => ipcRenderer.invoke('fm:homeDir')
  },
  tags: {
    readFolder: (folderPath: string): Promise<AudioTag[]> => ipcRenderer.invoke('tags:readFolder', folderPath),
    write: (input: AudioTagWrite): Promise<{ success: boolean; message: string }> =>
      ipcRenderer.invoke('tags:write', input),
    writeBatch: (
      inputs: AudioTagWrite[]
    ): Promise<{ path: string; success: boolean; message: string }[]> =>
      ipcRenderer.invoke('tags:writeBatch', inputs),
    renameFromPattern: (
      tag: AudioTag,
      pattern: string
    ): Promise<{ success: boolean; newPath?: string; message: string }> =>
      ipcRenderer.invoke('tags:renameFromPattern', tag, pattern),
    fillFromFileName: (
      folderPath: string,
      pattern: string
    ): Promise<{ path: string; fields: Record<string, string> }[]> =>
      ipcRenderer.invoke('tags:fillFromFileName', folderPath, pattern)
  },
  startup: {
    list: (): Promise<StartupItem[]> => ipcRenderer.invoke('startup:list'),
    setEnabled: (item: StartupItem, enabled: boolean): Promise<void> =>
      ipcRenderer.invoke('startup:setEnabled', item, enabled),
    remove: (item: StartupItem): Promise<void> => ipcRenderer.invoke('startup:remove', item)
  },
  system: {
    summary: (): Promise<SystemSummary> => ipcRenderer.invoke('system:summary'),
    isAdmin: (): Promise<boolean> => ipcRenderer.invoke('system:isAdmin'),
    relaunchAsAdmin: (): Promise<{ started: boolean; message: string }> =>
      ipcRenderer.invoke('system:relaunchAsAdmin')
  },
  dialogs: {
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickFolder'),
    pickImageFile: (): Promise<string | null> => ipcRenderer.invoke('dialog:pickImageFile'),
    confirm: (message: string, detail?: string): Promise<boolean> =>
      ipcRenderer.invoke('dialog:confirm', message, detail)
  }
}

export type CleanShelfApi = typeof api

contextBridge.exposeInMainWorld('api', api)
