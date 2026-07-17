import { ipcMain } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import type { AudioTag, AudioTagWrite } from '../../shared/types'
import {
  readFolderTags,
  writeAudioTag,
  buildNameFromPattern,
  parseTagsFromFileName
} from '../lib/tagEditorLib'
import { renameEntry } from '../lib/fileManagerLib'

export function registerTagEditorIpc(): void {
  ipcMain.handle('tags:readFolder', async (_event, folderPath: string): Promise<AudioTag[]> => {
    return readFolderTags(folderPath)
  })

  ipcMain.handle('tags:write', async (_event, input: AudioTagWrite) => {
    return writeAudioTag(input)
  })

  ipcMain.handle(
    'tags:writeBatch',
    async (_event, inputs: AudioTagWrite[]): Promise<{ path: string; success: boolean; message: string }[]> => {
      const results = []
      for (const input of inputs) {
        const r = await writeAudioTag(input)
        results.push({ path: input.path, success: r.success, message: r.message })
      }
      return results
    }
  )

  ipcMain.handle(
    'tags:renameFromPattern',
    async (_event, tag: AudioTag, pattern: string): Promise<{ success: boolean; newPath?: string; message: string }> => {
      const newBase = buildNameFromPattern(tag, pattern)
      const ext = path.extname(tag.path)
      const sanitized = newBase.replace(/[\\/:*?"<>|]/g, '_').trim()
      const newName = sanitized.endsWith(ext) ? sanitized : `${sanitized}${ext}`
      try {
        const newPath = await renameEntry(tag.path, newName)
        return { success: true, newPath, message: 'تم إعادة التسمية' }
      } catch (err) {
        return { success: false, message: (err as Error).message }
      }
    }
  )

  ipcMain.handle(
    'tags:fillFromFileName',
    async (
      _event,
      folderPath: string,
      pattern: string
    ): Promise<{ path: string; fields: Record<string, string> }[]> => {
      const entries = await fs.readdir(folderPath, { withFileTypes: true })
      const results: { path: string; fields: Record<string, string> }[] = []
      for (const entry of entries) {
        if (!entry.isFile()) continue
        const fields = parseTagsFromFileName(entry.name, pattern)
        if (Object.keys(fields).length > 0) {
          results.push({ path: path.join(folderPath, entry.name), fields })
        }
      }
      return results
    }
  )
}
