// أنواع مشتركة بين العملية الرئيسية (main) وواجهة المستخدم (renderer)

export interface CleanerCategory {
  id: string
  labelKey: string
  path: string | null
  sizeBytes: number
  fileCount: number
  scanned: boolean
  error?: string
  risk: 'safe' | 'caution'
}

export interface CleanerScanResult {
  categories: CleanerCategory[]
  totalBytes: number
}

export interface CleanProgress {
  categoryId: string
  done: boolean
  freedBytes: number
  error?: string
}

export interface InstalledApp {
  key: string
  name: string
  version: string
  publisher: string
  installLocation: string
  installDate: string
  estimatedSizeKb: number
  uninstallString: string
  quietUninstallString: string
  hive: 'HKLM' | 'HKLM32' | 'HKCU'
}

export interface UninstallResult {
  key: string
  success: boolean
  message: string
}

export interface LeftoverItem {
  path: string
  kind: 'folder' | 'registry'
  sizeBytes: number
}

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  sizeBytes: number
  modifiedAt: string
  extension: string
}

export interface DirListing {
  path: string
  parent: string | null
  entries: FileEntry[]
  drives?: string[]
}

export interface DuplicateGroup {
  hash: string
  sizeBytes: number
  files: string[]
}

export interface LargeFileEntry {
  path: string
  sizeBytes: number
}

export interface AudioTag {
  path: string
  fileName: string
  format: string
  durationSec: number
  title: string
  artist: string
  album: string
  albumArtist: string
  year: string
  genre: string
  track: string
  comment: string
  hasCover: boolean
  sizeBytes: number
  error?: string
}

export interface AudioTagWrite {
  path: string
  title?: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: string
  genre?: string
  track?: string
  comment?: string
  coverPath?: string | null
}

export interface StartupItem {
  id: string
  name: string
  command: string
  location: 'HKLM-Run' | 'HKCU-Run' | 'StartupFolder-User' | 'StartupFolder-Common'
  enabled: boolean
}

export interface SystemSummary {
  osName: string
  osVersion: string
  hostname: string
  cpuModel: string
  cpuLoadPercent: number
  totalMemBytes: number
  usedMemBytes: number
  uptimeSec: number
  disks: { mount: string; totalBytes: number; usedBytes: number; freeBytes: number }[]
}

export type ProgressListener<T> = (payload: T) => void
