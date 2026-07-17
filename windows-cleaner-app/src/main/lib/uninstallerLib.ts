import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { InstalledApp, LeftoverItem } from '../../shared/types'
import { runPowerShellJson, psQuote } from './powershell'
import { dirStats, pathExists } from './fsWalk'
import { env } from './platform'

interface RawApp {
  Key: string
  Hive: 'HKLM' | 'HKLM32' | 'HKCU'
  Name: string
  Version: string | null
  Publisher: string | null
  InstallLocation: string | null
  InstallDate: string | null
  EstimatedSizeKb: number | null
  UninstallString: string | null
  QuietUninstallString: string | null
}

const LIST_SCRIPT = `
$sets = @(
  @{ Path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Hive = 'HKLM' },
  @{ Path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Hive = 'HKLM32' },
  @{ Path = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*'; Hive = 'HKCU' }
)
$apps = foreach ($s in $sets) {
  Get-ItemProperty -Path $s.Path -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne '' -and $_.SystemComponent -ne 1 } |
    ForEach-Object {
      [PSCustomObject]@{
        Key = $_.PSChildName
        Hive = $s.Hive
        Name = $_.DisplayName
        Version = [string]$_.DisplayVersion
        Publisher = [string]$_.Publisher
        InstallLocation = [string]$_.InstallLocation
        InstallDate = [string]$_.InstallDate
        EstimatedSizeKb = if ($_.EstimatedSize) { [int]$_.EstimatedSize } else { 0 }
        UninstallString = [string]$_.UninstallString
        QuietUninstallString = [string]$_.QuietUninstallString
      }
    }
}
@($apps) | ConvertTo-Json -Depth 3 -Compress
`

export async function listInstalledApps(): Promise<InstalledApp[]> {
  const raw = await runPowerShellJson<RawApp[] | RawApp>(LIST_SCRIPT, 45_000)
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
  return arr
    .map((a) => ({
      key: `${a.Hive}\\${a.Key}`,
      name: a.Name,
      version: a.Version || '',
      publisher: a.Publisher || '',
      installLocation: a.InstallLocation || '',
      installDate: a.InstallDate || '',
      estimatedSizeKb: a.EstimatedSizeKb || 0,
      uninstallString: a.UninstallString || '',
      quietUninstallString: a.QuietUninstallString || '',
      hive: a.Hive
    }))
    .sort((a, b) => b.estimatedSizeKb - a.estimatedSizeKb)
}

export function runUninstallCommand(command: string): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    if (!command || !command.trim()) {
      resolve({ success: false, message: 'لا يوجد أمر إزالة مسجَّل لهذا البرنامج.' })
      return
    }
    exec(command, { windowsHide: false, timeout: 5 * 60 * 1000 }, (error, _stdout, stderr) => {
      if (error) {
        resolve({ success: false, message: stderr?.toString() || error.message })
        return
      }
      resolve({ success: true, message: 'تم تشغيل أداة إزالة البرنامج.' })
    })
  })
}

const LEFTOVER_ROOTS = [
  env('PROGRAMFILES'),
  env('PROGRAMFILES(X86)'),
  env('PROGRAMDATA'),
  env('APPDATA'),
  env('LOCALAPPDATA')
].filter(Boolean)

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '')
    .trim()
}

export async function findLeftovers(appName: string, publisher: string): Promise<LeftoverItem[]> {
  const targets = [appName, publisher].filter((s) => s && s.trim().length > 1)
  const normalizedTargets = targets.map(normalizeForMatch).filter((s) => s.length > 2)
  if (normalizedTargets.length === 0) return []

  const found: LeftoverItem[] = []
  for (const root of LEFTOVER_ROOTS) {
    if (!(await pathExists(root))) continue
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(root, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const normalizedEntry = normalizeForMatch(entry.name)
      const matches = normalizedTargets.some(
        (t) => normalizedEntry.includes(t) || t.includes(normalizedEntry)
      )
      if (!matches) continue
      const full = path.join(root, entry.name)
      const stats = await dirStats(full, 20_000)
      found.push({ path: full, kind: 'folder', sizeBytes: stats.sizeBytes })
    }
  }
  return found
}

export async function removeLeftoverFolder(target: string): Promise<void> {
  const isSafe = LEFTOVER_ROOTS.some((root) => target.toLowerCase().startsWith(root.toLowerCase()))
  if (!isSafe) {
    throw new Error('مسار غير آمن للحذف.')
  }
  await fs.rm(target, { recursive: true, force: true })
}

export { psQuote }
