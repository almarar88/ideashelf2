import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { DirListing, FileEntry } from '../../shared/types'
import { isWindows } from './platform'
import { runPowerShellJson } from './powershell'
import { pathExists } from './fsWalk'

interface RawDrive {
  DeviceID: string
  Size: number | null
  FreeSpace: number | null
}

export async function listDrives(): Promise<string[]> {
  if (!isWindows) return [os.homedir()]
  try {
    const raw = await runPowerShellJson<RawDrive[] | RawDrive>(
      'Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json -Compress'
    )
    const arr = Array.isArray(raw) ? raw : raw ? [raw] : []
    return arr.map((d) => `${d.DeviceID}\\`)
  } catch {
    return ['C:\\']
  }
}

export async function listDirectory(targetPath: string | null): Promise<DirListing> {
  if (!targetPath) {
    const drives = await listDrives()
    return { path: '', parent: null, entries: [], drives }
  }

  const entries: FileEntry[] = []
  const rawEntries = await fs.readdir(targetPath, { withFileTypes: true })
  for (const entry of rawEntries) {
    const full = path.join(targetPath, entry.name)
    try {
      const stat = await fs.stat(full)
      entries.push({
        name: entry.name,
        path: full,
        isDirectory: entry.isDirectory(),
        sizeBytes: entry.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtime.toISOString(),
        extension: entry.isDirectory() ? '' : path.extname(entry.name).replace('.', '')
      })
    } catch {
      // ملف/مجلد تعذّر الوصول إليه (صلاحيات)، نتجاهله
    }
  }
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, 'ar')
  })

  const parsed = path.parse(targetPath)
  const isRoot = parsed.dir === '' || parsed.dir === parsed.root
  const parent = isRoot && parsed.root === targetPath ? null : path.dirname(targetPath)

  return {
    path: targetPath,
    parent: targetPath === parent ? null : parent,
    entries
  }
}

export async function renameEntry(targetPath: string, newName: string): Promise<string> {
  const dest = path.join(path.dirname(targetPath), newName)
  await fs.rename(targetPath, dest)
  return dest
}

export async function moveEntries(paths: string[], destinationDir: string): Promise<void> {
  for (const p of paths) {
    const dest = path.join(destinationDir, path.basename(p))
    await fs.rename(p, dest)
  }
}

export async function createFolder(parentDir: string, name: string): Promise<string> {
  const dest = path.join(parentDir, name)
  await fs.mkdir(dest, { recursive: false })
  return dest
}

export interface BatchRenamePlan {
  from: string
  to: string
}

export function buildBatchRenamePlan(
  filePaths: string[],
  pattern: string,
  startNumber = 1
): BatchRenamePlan[] {
  return filePaths.map((filePath, index) => {
    const dir = path.dirname(filePath)
    const ext = path.extname(filePath)
    const baseName = path.basename(filePath, ext)
    const number = String(startNumber + index).padStart(String(filePaths.length + startNumber).length, '0')
    const newBaseName = pattern
      .replace(/%name%/gi, baseName)
      .replace(/%n%/gi, number)
      .replace(/%ext%/gi, ext.replace('.', ''))
    const newName = newBaseName.includes('.') ? newBaseName : `${newBaseName}${ext}`
    return { from: filePath, to: path.join(dir, newName) }
  })
}

export interface BatchRenameResult {
  applied: BatchRenamePlan[]
  failed: { path: string; error: string }[]
}

/**
 * ينفّذ خطة إعادة التسمية ملفًا ملفًا. لا يتوقف عند أول خطأ، ولا يستبدل
 * ملفًا موجودًا أبدًا (fs.rename يستبدل الهدف بصمت على بعض الأنظمة).
 */
export async function applyBatchRename(plan: BatchRenamePlan[]): Promise<BatchRenameResult> {
  const applied: BatchRenamePlan[] = []
  const failed: { path: string; error: string }[] = []

  for (const step of plan) {
    if (step.from === step.to) continue
    try {
      if (await pathExists(step.to)) {
        failed.push({ path: step.from, error: 'يوجد ملف بنفس الاسم مسبقًا' })
        continue
      }
      await fs.rename(step.from, step.to)
      applied.push(step)
    } catch (err) {
      failed.push({ path: step.from, error: (err as Error).message })
    }
  }
  return { applied, failed }
}
