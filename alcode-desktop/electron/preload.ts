import { contextBridge, ipcRenderer } from 'electron'

/**
 * الجسر الوحيد بين الواجهة والنظام.
 *
 * الواجهة لا تملك Node ولا تصل إلى الملفات ولا إلى PowerShell ولا إلى المفتاح.
 * كل ما تستطيعه هو استدعاء الدوال المعدودة أدناه — وهذا ما يجعل نصًا خبيثًا
 * يصل إلى الشاشة (من موقع أو ملف) عاجزًا عن لمس الجهاز.
 */

const api = {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke('settings:set', patch),
    setKey: (key: string) => ipcRenderer.invoke('settings:setKey', key),
    testKey: () => ipcRenderer.invoke('settings:testKey'),
  },
  tools: {
    list: () => ipcRenderer.invoke('tools:list'),
    count: () => ipcRenderer.invoke('tools:count'),
  },
  platform: () => ipcRenderer.invoke('platform:info'),
  data: {
    get: (key: string) => ipcRenderer.invoke('data:get', key),
    deleteMemory: (id: string) => ipcRenderer.invoke('data:deleteMemory', id),
    deleteNote: (id: string) => ipcRenderer.invoke('data:deleteNote', id),
    deleteReminder: (id: string) => ipcRenderer.invoke('data:deleteReminder', id),
    resetUsage: () => ipcRenderer.invoke('data:resetUsage'),
  },
  agent: {
    send: (payload: { history: unknown[]; fromQuick?: boolean }) =>
      ipcRenderer.invoke('agent:send', payload),
    stop: () => ipcRenderer.send('agent:stop'),
    confirm: (id: string, allowed: boolean) =>
      ipcRenderer.send('agent:confirmResult', id, allowed),
    onEvent: (handler: (event: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => handler(payload)
      ipcRenderer.on('agent:event', listener)
      return () => ipcRenderer.removeListener('agent:event', listener)
    },
    onConfirm: (handler: (request: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => handler(payload)
      ipcRenderer.on('agent:confirm', listener)
      return () => ipcRenderer.removeListener('agent:confirm', listener)
    },
  },
  quick: {
    hide: () => ipcRenderer.send('quick:hide'),
    expand: () => ipcRenderer.send('quick:expand'),
    onFocus: (handler: () => void) => {
      const listener = () => handler()
      ipcRenderer.on('quick:focus', listener)
      return () => ipcRenderer.removeListener('quick:focus', listener)
    },
  },
}

contextBridge.exposeInMainWorld('alcode', api)

export type AlcodeApi = typeof api
