import fs from 'node:fs/promises'
import path from 'node:path'
import type { DiskUsageResult, FolderUsage, BrokenShortcut, ScanProgress } from '../../shared/types'
import { dirStats, listFilesRecursive, pathExists, ScanCancelledError } from './fsWalk'
import { runPowerShellJson, psQuote } from './powershell'
import { isWindows } from './platform'

export interface AnalyzeHooks {
  onProgress?: (progress: ScanProgress) => void
  shouldCancel?: () => boolean
}

/**
 * يحسب حجم كل عنصر مباشر داخل مجلد، ليعرف المستخدم أين تذهب المساحة.
 * يُحسب كل ابن على حدة (لا مجموع واحد) حتى يمكن ترتيبها والتنقّل داخلها.
 */
export async function analyzeFolder(
  rootPath: string,
  hooks: AnalyzeHooks = {}
): Promise<DiskUsageResult> {
  const { onProgress, shouldCancel } = hooks
  const children: FolderUsage[] = []

  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true })
  } catch (err) {
    throw new Error(`تعذّر قراءة المجلد: ${(err as Error).message}`)
  }

  let index = 0
  for (const entry of entries) {
    if (shouldCancel?.()) throw new ScanCancelledError()
    index += 1
    const full = path.join(rootPath, entry.name)

    onProgress?.({
      phase: 'walking',
      filesSeen: index,
      processed: index,
      total: entries.length,
      currentPath: full
    })

    if (entry.isSymbolicLink()) continue

    if (entry.isDirectory()) {
      const stats = await dirStats(full)
      children.push({
        path: full,
        name: entry.name,
        sizeBytes: stats.sizeBytes,
        fileCount: stats.fileCount,
        isDirectory: true
      })
    } else {
      try {
        const stat = await fs.stat(full)
        children.push({
          path: full,
          name: entry.name,
          sizeBytes: stat.size,
          fileCount: 1,
          isDirectory: false
        })
      } catch {
        // تعذّر الوصول — نتخطاه
      }
    }
  }

  children.sort((a, b) => b.sizeBytes - a.sizeBytes)
  const totalBytes = children.reduce((sum, c) => sum + c.sizeBytes, 0)

  const parsed = path.parse(rootPath)
  const parent = parsed.root === rootPath ? null : path.dirname(rootPath)

  return { root: rootPath, parent: parent === rootPath ? null : parent, totalBytes, children }
}

/** يعثر على المجلدات التي لا تحتوي أي ملف في أي مستوى تحتها. */
export async function findEmptyFolders(
  rootPath: string,
  hooks: AnalyzeHooks = {}
): Promise<string[]> {
  const { onProgress, shouldCancel } = hooks
  const empty: string[] = []
  let visited = 0

  async function walk(dir: string): Promise<boolean> {
    if (shouldCancel?.()) throw new ScanCancelledError()

    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return false // لا نعتبر مجلدًا تعذّر فتحه فارغًا
    }

    visited += 1
    if (visited % 200 === 0) {
      onProgress?.({
        phase: 'walking',
        filesSeen: empty.length,
        processed: visited,
        total: 0,
        currentPath: dir
      })
    }

    let hasContent = false
    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        hasContent = true
        continue
      }
      if (entry.isDirectory()) {
        const childEmpty = await walk(path.join(dir, entry.name))
        if (!childEmpty) hasContent = true
      } else {
        hasContent = true
      }
    }

    if (!hasContent) empty.push(dir)
    return !hasContent
  }

  await walk(rootPath)
  // نستثني الجذر نفسه — حذفه ليس المقصود من الأداة
  return empty.filter((p) => p !== rootPath)
}

interface RawShortcut {
  Shortcut: string
  Target: string
}

/** يعثر على اختصارات .lnk التي اختفى هدفها. */
export async function findBrokenShortcuts(
  rootPath: string,
  hooks: AnalyzeHooks = {}
): Promise<BrokenShortcut[]> {
  if (!isWindows) return []

  const files = await listFilesRecursive(rootPath, {
    shouldCancel: hooks.shouldCancel,
    onProgress: (filesSeen, currentDir) =>
      hooks.onProgress?.({
        phase: 'walking',
        filesSeen,
        processed: 0,
        total: 0,
        currentPath: currentDir
      })
  })

  const shortcuts = files.filter((f) => f.path.toLowerCase().endsWith('.lnk'))
  if (shortcuts.length === 0) return []

  // حلّ الأهداف دفعة واحدة عبر COM بدل استدعاء PowerShell لكل ملف
  const listLiteral = shortcuts.map((s) => psQuote(s.path)).join(',')
  const script = `
    $shell = New-Object -ComObject WScript.Shell
    $result = foreach ($p in @(${listLiteral})) {
      try {
        $lnk = $shell.CreateShortcut($p)
        [PSCustomObject]@{ Shortcut = $p; Target = [string]$lnk.TargetPath }
      } catch {}
    }
    @($result) | ConvertTo-Json -Compress -Depth 2
  `

  const raw = await runPowerShellJson<RawShortcut[] | RawShortcut>(script, 120_000)
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : []

  const broken: BrokenShortcut[] = []
  for (const item of arr) {
    if (hooks.shouldCancel?.()) throw new ScanCancelledError()
    // اختصارات بلا هدف ملفّي (مثل اختصارات لوحة التحكم) ليست معطوبة
    if (!item.Target) continue
    if (!(await pathExists(item.Target))) {
      broken.push({ shortcutPath: item.Shortcut, targetPath: item.Target })
    }
  }
  return broken
}
