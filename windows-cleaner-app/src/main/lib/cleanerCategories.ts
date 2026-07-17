import fs from 'node:fs/promises'
import path from 'node:path'
import { dirStats, pathExists } from './fsWalk'
import { runPowerShell } from './powershell'
import { env } from './platform'

export interface CategoryDef {
  id: string
  labelKey: string
  risk: 'safe' | 'caution'
  /** يعيد المجلدات المرشّحة لهذه الفئة (بعضها قد لا يكون موجودًا فعليًا). */
  resolvePaths: () => Promise<string[]>
  /** حساب الحجم بطريقة خاصة (سلة المحذوفات مثلاً)، اختياري. */
  customScan?: () => Promise<{ sizeBytes: number; fileCount: number }>
  /** تنظيف بطريقة خاصة (سلة المحذوفات مثلاً)، اختياري. */
  customClean?: () => Promise<number>
}

async function firefoxCacheDirs(): Promise<string[]> {
  const profilesRoot = path.join(env('LOCALAPPDATA'), 'Mozilla', 'Firefox', 'Profiles')
  if (!(await pathExists(profilesRoot))) return []
  try {
    const entries = await fs.readdir(profilesRoot, { withFileTypes: true })
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => path.join(profilesRoot, e.name, 'cache2'))
  } catch {
    return []
  }
}

export const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'user_temp',
    labelKey: 'cleaner.userTemp',
    risk: 'safe',
    resolvePaths: async () => [env('TEMP') || env('TMP')].filter(Boolean)
  },
  {
    id: 'windows_temp',
    labelKey: 'cleaner.windowsTemp',
    risk: 'safe',
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Temp')]
  },
  {
    id: 'prefetch',
    labelKey: 'cleaner.prefetch',
    risk: 'caution',
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Prefetch')]
  },
  {
    id: 'windows_update_cache',
    labelKey: 'cleaner.windowsUpdate',
    risk: 'safe',
    resolvePaths: async () => [
      path.join(env('WINDIR') || 'C:\\Windows', 'SoftwareDistribution', 'Download')
    ]
  },
  {
    id: 'thumbnail_cache',
    labelKey: 'cleaner.thumbnails',
    risk: 'safe',
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Windows', 'Explorer')
    ]
  },
  {
    id: 'windows_error_reports',
    labelKey: 'cleaner.errorReports',
    risk: 'safe',
    resolvePaths: async () => [path.join(env('LOCALAPPDATA'), 'Microsoft', 'Windows', 'WER')]
  },
  {
    id: 'recent_list',
    labelKey: 'cleaner.recentList',
    risk: 'safe',
    resolvePaths: async () => [path.join(env('APPDATA'), 'Microsoft', 'Windows', 'Recent')]
  },
  {
    id: 'chrome_cache',
    labelKey: 'cleaner.chromeCache',
    risk: 'safe',
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(env('LOCALAPPDATA'), 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache')
    ]
  },
  {
    id: 'edge_cache',
    labelKey: 'cleaner.edgeCache',
    risk: 'safe',
    resolvePaths: async () => [
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'),
      path.join(env('LOCALAPPDATA'), 'Microsoft', 'Edge', 'User Data', 'Default', 'Code Cache')
    ]
  },
  {
    id: 'firefox_cache',
    labelKey: 'cleaner.firefoxCache',
    risk: 'safe',
    resolvePaths: firefoxCacheDirs
  },
  {
    id: 'delivery_optimization',
    labelKey: 'cleaner.deliveryOptimization',
    risk: 'caution',
    resolvePaths: async () => [
      path.join(env('WINDIR') || 'C:\\Windows', 'SoftwareDistribution', 'DeliveryOptimization')
    ]
  },
  {
    id: 'minidumps',
    labelKey: 'cleaner.minidumps',
    risk: 'caution',
    resolvePaths: async () => [path.join(env('WINDIR') || 'C:\\Windows', 'Minidump')]
  },
  {
    id: 'recycle_bin',
    labelKey: 'cleaner.recycleBin',
    risk: 'caution',
    resolvePaths: async () => [],
    customScan: async () => {
      const script = `
        $shell = New-Object -ComObject Shell.Application
        $bin = $shell.Namespace(0xA)
        $items = $bin.Items()
        $size = 0
        foreach ($i in $items) { $size += $i.ExtendedProperty('Size') }
        [PSCustomObject]@{ SizeBytes = $size; Count = $items.Count } | ConvertTo-Json -Compress
      `
      try {
        const out = await runPowerShell(script)
        const parsed = JSON.parse(out.trim())
        return { sizeBytes: Number(parsed.SizeBytes) || 0, fileCount: Number(parsed.Count) || 0 }
      } catch {
        return { sizeBytes: 0, fileCount: 0 }
      }
    },
    customClean: async () => {
      const before = await CATEGORY_DEFS.find((c) => c.id === 'recycle_bin')!.customScan!()
      await runPowerShell('Clear-RecycleBin -Force -ErrorAction SilentlyContinue')
      return before.sizeBytes
    }
  }
]

export async function scanCategory(
  def: CategoryDef
): Promise<{ sizeBytes: number; fileCount: number; existingPaths: string[] }> {
  if (def.customScan) {
    const r = await def.customScan()
    return { ...r, existingPaths: [] }
  }
  const candidates = await def.resolvePaths()
  const existingPaths: string[] = []
  let sizeBytes = 0
  let fileCount = 0
  for (const p of candidates) {
    if (!p || !(await pathExists(p))) continue
    existingPaths.push(p)
    const stats = await dirStats(p)
    sizeBytes += stats.sizeBytes
    fileCount += stats.fileCount
  }
  return { sizeBytes, fileCount, existingPaths }
}

/** يحذف محتويات مجلد (وليس المجلد نفسه) لتفادي كسر تطبيقات تتوقع وجوده. */
export async function clearDirectoryContents(dirPath: string): Promise<number> {
  let freed = 0
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const entry of entries) {
    const full = path.join(dirPath, entry.name)
    try {
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        const stats = await dirStats(full)
        await fs.rm(full, { recursive: true, force: true })
        freed += stats.sizeBytes
      } else {
        const stat = await fs.stat(full)
        await fs.unlink(full)
        freed += stat.size
      }
    } catch {
      // ملف مستخدَم حاليًا أو محمي، نتخطاه ونكمل الباقي
    }
  }
  return freed
}
