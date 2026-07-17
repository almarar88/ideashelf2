import crypto from 'node:crypto'
import fs from 'node:fs'
import type { DuplicateGroup, LargeFileEntry } from '../../shared/types'
import { listFilesRecursive } from './fsWalk'

const PARTIAL_HASH_BYTES = 64 * 1024

function hashFilePartial(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(filePath, { start: 0, end: PARTIAL_HASH_BYTES })
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

function hashFileFull(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

export async function findDuplicates(
  rootPath: string,
  minSizeBytes = 4096
): Promise<DuplicateGroup[]> {
  const files = await listFilesRecursive(rootPath)
  const bySize = new Map<number, string[]>()
  for (const f of files) {
    if (f.sizeBytes < minSizeBytes) continue
    const arr = bySize.get(f.sizeBytes) ?? []
    arr.push(f.path)
    bySize.set(f.sizeBytes, arr)
  }

  const candidateGroups = [...bySize.entries()].filter(([, paths]) => paths.length > 1)

  const byPartialHash = new Map<string, { sizeBytes: number; paths: string[] }>()
  for (const [sizeBytes, paths] of candidateGroups) {
    for (const p of paths) {
      try {
        const hash = await hashFilePartial(p)
        const key = `${sizeBytes}:${hash}`
        const entry = byPartialHash.get(key) ?? { sizeBytes, paths: [] }
        entry.paths.push(p)
        byPartialHash.set(key, entry)
      } catch {
        // تجاهل الملفات التي تعذّر قراءتها
      }
    }
  }

  const groups: DuplicateGroup[] = []
  for (const { sizeBytes, paths } of byPartialHash.values()) {
    if (paths.length < 2) continue
    const byFullHash = new Map<string, string[]>()
    for (const p of paths) {
      try {
        const hash = await hashFileFull(p)
        const arr = byFullHash.get(hash) ?? []
        arr.push(p)
        byFullHash.set(hash, arr)
      } catch {
        // تجاهل
      }
    }
    for (const [hash, filePaths] of byFullHash) {
      if (filePaths.length > 1) {
        groups.push({ hash, sizeBytes, files: filePaths })
      }
    }
  }

  return groups.sort((a, b) => b.sizeBytes * b.files.length - a.sizeBytes * a.files.length)
}

export async function findLargeFiles(
  rootPath: string,
  minSizeBytes = 100 * 1024 * 1024,
  limit = 200
): Promise<LargeFileEntry[]> {
  const files = await listFilesRecursive(rootPath)
  return files
    .filter((f) => f.sizeBytes >= minSizeBytes)
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, limit)
    .map((f) => ({ path: f.path, sizeBytes: f.sizeBytes }))
}
