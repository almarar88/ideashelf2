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
  daily: {
    day: () => ipcRenderer.invoke('daily:day'),
    weather: (force = false) => ipcRenderer.invoke('daily:weather', force),
    news: (force = false) => ipcRenderer.invoke('daily:news', force),
    sources: () => ipcRenderer.invoke('daily:sources'),
    toggleSource: (id: string, enabled: boolean) =>
      ipcRenderer.invoke('daily:toggleSource', id, enabled),
    addSource: (url: string, category: string) =>
      ipcRenderer.invoke('daily:addSource', url, category),
    removeSource: (id: string) => ipcRenderer.invoke('daily:removeSource', id),
    addTopic: (query: string) => ipcRenderer.invoke('daily:addTopic', query),
    removeTopic: (query: string) => ipcRenderer.invoke('daily:removeTopic', query),
    methods: () => ipcRenderer.invoke('daily:methods'),
    detectPlace: (allowIp = false) => ipcRenderer.invoke('daily:detectPlace', allowIp),
    openLocationSettings: () => ipcRenderer.invoke('daily:openLocationSettings'),
    searchPlaces: (query: string) => ipcRenderer.invoke('daily:searchPlaces', query),
    prayerMonth: (year: number, month: number) =>
      ipcRenderer.invoke('daily:prayerMonth', year, month),
    tasks: () => ipcRenderer.invoke('daily:tasks'),
    habits: () => ipcRenderer.invoke('daily:habits'),
    saveTask: (task: unknown) => ipcRenderer.invoke('daily:saveTask', task),
    deleteTask: (id: string) => ipcRenderer.invoke('daily:deleteTask', id),
    saveHabit: (habit: unknown) => ipcRenderer.invoke('daily:saveHabit', habit),
    deleteHabit: (id: string) => ipcRenderer.invoke('daily:deleteHabit', id),
    openExternal: (url: string) => ipcRenderer.invoke('daily:openExternal', url),
  },
  diag: {
    log: () => ipcRenderer.invoke('diag:log'),
    openLog: () => ipcRenderer.invoke('diag:openLog'),
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
