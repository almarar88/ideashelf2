import fs from 'node:fs/promises'
import path from 'node:path'
import type { StartupItem } from '../../shared/types'
import { runPowerShell, runPowerShellJson, psQuote } from './powershell'
import { env, isWindows } from './platform'
import { pathExists } from './fsWalk'

const RUN_KEY_HKCU = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const RUN_KEY_HKLM = 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
const DISABLED_BACKUP_KEY = 'HKCU:\\Software\\CleanShelf\\DisabledStartup'

interface RawRunEntry {
  Name: string
  Command: string
}

async function readRunKey(keyPath: string): Promise<RawRunEntry[]> {
  const script = `
    if (Test-Path ${psQuote(keyPath)}) {
      $item = Get-Item ${psQuote(keyPath)}
      $names = $item.GetValueNames()
      $result = foreach ($n in $names) {
        [PSCustomObject]@{ Name = $n; Command = [string]$item.GetValue($n) }
      }
      @($result) | ConvertTo-Json -Compress
    } else {
      '[]'
    }
  `
  try {
    const raw = await runPowerShellJson<RawRunEntry[] | RawRunEntry>(script)
    return Array.isArray(raw) ? raw : raw ? [raw] : []
  } catch {
    return []
  }
}

function startupFolderPaths(): { user: string; common: string } {
  return {
    user: path.join(env('APPDATA'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'),
    common: path.join(
      env('PROGRAMDATA'),
      'Microsoft',
      'Windows',
      'Start Menu',
      'Programs',
      'Startup'
    )
  }
}

async function listStartupFolder(
  folderPath: string,
  location: StartupItem['location']
): Promise<StartupItem[]> {
  if (!(await pathExists(folderPath))) return []
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  const items: StartupItem[] = []
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
      items.push({
        id: `${location}:${entry.name}`,
        name: entry.name.replace(/\.lnk$/i, ''),
        command: path.join(folderPath, entry.name),
        location,
        enabled: true
      })
    }
  }
  const disabledDir = path.join(folderPath, 'Disabled')
  if (await pathExists(disabledDir)) {
    const disabledEntries = await fs.readdir(disabledDir, { withFileTypes: true })
    for (const entry of disabledEntries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
        items.push({
          id: `${location}:${entry.name}`,
          name: entry.name.replace(/\.lnk$/i, ''),
          command: path.join(disabledDir, entry.name),
          location,
          enabled: false
        })
      }
    }
  }
  return items
}

export async function listStartupItems(): Promise<StartupItem[]> {
  if (!isWindows) return []

  const [hkcu, hklm, disabledBackup] = await Promise.all([
    readRunKey(RUN_KEY_HKCU),
    readRunKey(RUN_KEY_HKLM),
    readRunKey(DISABLED_BACKUP_KEY)
  ])

  const items: StartupItem[] = [
    ...hkcu.map((e) => ({
      id: `HKCU-Run:${e.Name}`,
      name: e.Name,
      command: e.Command,
      location: 'HKCU-Run' as const,
      enabled: true
    })),
    ...hklm.map((e) => ({
      id: `HKLM-Run:${e.Name}`,
      name: e.Name,
      command: e.Command,
      location: 'HKLM-Run' as const,
      enabled: true
    })),
    ...disabledBackup.map((e) => ({
      id: `HKCU-Run:${e.Name}`,
      name: e.Name,
      command: e.Command,
      location: 'HKCU-Run' as const,
      enabled: false
    }))
  ]

  const { user, common } = startupFolderPaths()
  items.push(...(await listStartupFolder(user, 'StartupFolder-User')))
  items.push(...(await listStartupFolder(common, 'StartupFolder-Common')))

  return items
}

export async function setStartupItemEnabled(item: StartupItem, enabled: boolean): Promise<void> {
  if (item.location === 'HKCU-Run' || item.location === 'HKLM-Run') {
    const runKey = item.location === 'HKCU-Run' ? RUN_KEY_HKCU : RUN_KEY_HKLM
    if (enabled) {
      await runPowerShell(`
        New-Item -Path ${psQuote(DISABLED_BACKUP_KEY)} -Force | Out-Null
        New-Item -Path ${psQuote(runKey)} -Force | Out-Null
        New-ItemProperty -Path ${psQuote(runKey)} -Name ${psQuote(item.name)} -Value ${psQuote(item.command)} -PropertyType String -Force | Out-Null
        Remove-ItemProperty -Path ${psQuote(DISABLED_BACKUP_KEY)} -Name ${psQuote(item.name)} -ErrorAction SilentlyContinue
      `)
    } else {
      await runPowerShell(`
        New-Item -Path ${psQuote(DISABLED_BACKUP_KEY)} -Force | Out-Null
        New-ItemProperty -Path ${psQuote(DISABLED_BACKUP_KEY)} -Name ${psQuote(item.name)} -Value ${psQuote(item.command)} -PropertyType String -Force | Out-Null
        Remove-ItemProperty -Path ${psQuote(runKey)} -Name ${psQuote(item.name)} -ErrorAction SilentlyContinue
      `)
    }
    return
  }

  // اختصارات مجلد بدء التشغيل: التعطيل = نقلها إلى مجلد فرعي Disabled
  const folder = path.dirname(item.command)
  if (enabled) {
    const targetFolder = folder.endsWith('Disabled') ? path.dirname(folder) : folder
    await fs.rename(item.command, path.join(targetFolder, path.basename(item.command)))
  } else {
    const disabledDir = path.join(folder, 'Disabled')
    await fs.mkdir(disabledDir, { recursive: true })
    await fs.rename(item.command, path.join(disabledDir, path.basename(item.command)))
  }
}

export async function removeStartupItem(item: StartupItem): Promise<void> {
  if (item.location === 'HKCU-Run' || item.location === 'HKLM-Run') {
    const runKey = item.location === 'HKCU-Run' ? RUN_KEY_HKCU : RUN_KEY_HKLM
    await runPowerShell(`
      Remove-ItemProperty -Path ${psQuote(runKey)} -Name ${psQuote(item.name)} -ErrorAction SilentlyContinue
      Remove-ItemProperty -Path ${psQuote(DISABLED_BACKUP_KEY)} -Name ${psQuote(item.name)} -ErrorAction SilentlyContinue
    `)
    return
  }
  await fs.unlink(item.command)
}
