import fs from 'node:fs/promises'
import path from 'node:path'
import { parseFile } from 'music-metadata'
import NodeID3 from 'node-id3'
import type { AudioTag, AudioTagWrite } from '../../shared/types'

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac', '.wma'])

export function isAudioFile(filePath: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export async function listAudioFiles(folderPath: string): Promise<string[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  return entries
    .filter((e) => e.isFile() && isAudioFile(e.name))
    .map((e) => path.join(folderPath, e.name))
}

export async function readAudioTag(filePath: string): Promise<AudioTag> {
  const stat = await fs.stat(filePath)
  const fileName = path.basename(filePath)
  try {
    const meta = await parseFile(filePath, { duration: true, skipCovers: false })
    const common = meta.common
    return {
      path: filePath,
      fileName,
      format: meta.format.container || path.extname(filePath).replace('.', '').toUpperCase(),
      durationSec: Math.round(meta.format.duration || 0),
      title: common.title || '',
      artist: common.artist || (common.artists ? common.artists.join(', ') : ''),
      album: common.album || '',
      albumArtist: common.albumartist || '',
      year: common.year ? String(common.year) : '',
      genre: common.genre ? common.genre.join(', ') : '',
      track: common.track?.no ? String(common.track.no) : '',
      comment: Array.isArray(common.comment) ? common.comment.join(' ') : '',
      hasCover: Boolean(common.picture && common.picture.length > 0),
      sizeBytes: stat.size
    }
  } catch (err) {
    return {
      path: filePath,
      fileName,
      format: path.extname(filePath).replace('.', '').toUpperCase(),
      durationSec: 0,
      title: '',
      artist: '',
      album: '',
      albumArtist: '',
      year: '',
      genre: '',
      track: '',
      comment: '',
      hasCover: false,
      sizeBytes: stat.size,
      error: (err as Error).message
    }
  }
}

export async function readFolderTags(folderPath: string): Promise<AudioTag[]> {
  const files = await listAudioFiles(folderPath)
  const results: AudioTag[] = []
  for (const f of files) {
    results.push(await readAudioTag(f))
  }
  return results
}

export async function writeAudioTag(input: AudioTagWrite): Promise<{ success: boolean; message: string }> {
  const ext = path.extname(input.path).toLowerCase()
  if (ext !== '.mp3') {
    return {
      success: false,
      message: 'تحرير الوسوم بالكتابة مدعوم حاليًا لملفات MP3 فقط في هذا الإصدار.'
    }
  }

  const tags: NodeID3.Tags = {}
  if (input.title !== undefined) tags.title = input.title
  if (input.artist !== undefined) tags.artist = input.artist
  if (input.album !== undefined) tags.album = input.album
  if (input.albumArtist !== undefined) tags.performerInfo = input.albumArtist
  if (input.year !== undefined) tags.year = input.year
  if (input.genre !== undefined) tags.genre = input.genre
  if (input.track !== undefined) tags.trackNumber = input.track
  if (input.comment !== undefined) tags.comment = { language: 'eng', text: input.comment }

  if (input.coverPath) {
    tags.image = {
      mime: 'image/jpeg',
      type: { id: 3, name: 'front cover' },
      description: 'cover',
      imageBuffer: await fs.readFile(input.coverPath)
    }
  }

  const ok = NodeID3.update(tags, input.path)
  if (!ok) {
    return { success: false, message: 'فشل حفظ الوسوم — تأكد أن الملف غير مستخدَم من برنامج آخر.' }
  }
  return { success: true, message: 'تم الحفظ' }
}

export function buildNameFromPattern(tag: AudioTag, pattern: string): string {
  return pattern
    .replace(/%artist%/gi, tag.artist || 'Unknown Artist')
    .replace(/%title%/gi, tag.title || tag.fileName)
    .replace(/%album%/gi, tag.album || '')
    .replace(/%track%/gi, tag.track || '')
    .replace(/%year%/gi, tag.year || '')
}

export function parseTagsFromFileName(
  fileName: string,
  pattern: string
): Partial<Pick<AudioTag, 'artist' | 'title' | 'album' | 'track'>> {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const tokens = ['artist', 'title', 'album', 'track']
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let regexStr = escaped
  for (const t of tokens) {
    regexStr = regexStr.replace(new RegExp(`%${t}%`, 'gi'), `(?<${t}>.+?)`)
  }
  regexStr = '^' + regexStr + '$'
  try {
    const match = baseName.match(new RegExp(regexStr))
    if (!match || !match.groups) return {}
    const result: Record<string, string> = {}
    for (const t of tokens) {
      if (match.groups[t]) result[t] = match.groups[t].trim()
    }
    return result
  } catch {
    return {}
  }
}
