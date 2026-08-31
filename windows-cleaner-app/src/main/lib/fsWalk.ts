import fs from 'node:fs/promises'
import path from 'node:path'

export interface WalkStats {
  sizeBytes: number
  fileCount: number
}

/**
 * يحسب حجم مجلد بشكل تكراري بأمان (يتجاهل الأخطاء مثل نقص الصلاحيات
 * أو الروابط الرمزية المكسورة بدل إسقاط العملية بالكامل).
 */
export async function dirStats(rootPath: string, maxEntries = 200_000): Promise<WalkStats> {
  let sizeBytes = 0
  let fileCount = 0
  let visited = 0
  const stack: string[] = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()!
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (visited++ > maxEntries) return { sizeBytes, fileCount }
      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      try {
        const stat = await fs.stat(full)
        sizeBytes += stat.size
        fileCount += 1
      } catch {
        // ملف تعذّر الوصول إليه، نتجاهله
      }
    }
  }
  return { sizeBytes, fileCount }
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

export interface FlatFile {
  path: string
  sizeBytes: number
}

export class ScanCancelledError extends Error {
  constructor() {
    super('أُلغي الفحص')
    this.name = 'ScanCancelledError'
  }
}

export interface WalkOptions {
  maxEntries?: number
  /** يُستدعى دوريًا (وليس لكل ملف) لتفادي إغراق قناة IPC */
  onProgress?: (filesSeen: number, currentDir: string) => void
  shouldCancel?: () => boolean
}

const PROGRESS_EVERY = 400

/** يجمع كل الملفات تحت مجلد كقائمة مسطّحة (للحذف أو البحث عن التكرارات). */
export async function listFilesRecursive(
  rootPath: string,
  options: WalkOptions = {}
): Promise<FlatFile[]> {
  const { maxEntries = 200_000, onProgress, shouldCancel } = options
  const result: FlatFile[] = []
  let visited = 0
  const stack: string[] = [rootPath]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (shouldCancel?.()) throw new ScanCancelledError()

    let entries: import('node:fs').Dirent[]
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (visited++ > maxEntries) return result
      if (onProgress && visited % PROGRESS_EVERY === 0) onProgress(result.length, current)

      const full = path.join(current, entry.name)
      if (entry.isSymbolicLink()) continue
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      try {
        const stat = await fs.stat(full)
        result.push({ path: full, sizeBytes: stat.size })
      } catch {
        // تجاهل
      }
    }
  }
  return result
}
