import {
  app, BrowserWindow, globalShortcut, ipcMain, Menu, Notification, screen, shell, Tray,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { AgentEvent, ToolCall, complete, friendly, runAgent, webSearchTool } from './claude'
import { contextBlock, systemPrompt } from './prompt'
import { defaultSettings, Settings, stores } from './store'
import { allTools, toolByName, toolGroups, toolsForApi } from './tools'
import { isWindows } from './ps'

/**
 * العملية الرئيسية: النافذة، شريط المهام، الاختصار العام، وجسر الأوامر.
 *
 * المفتاح والأدوات كلها هنا. واجهة العرض لا تلمس نظام الملفات ولا PowerShell
 * ولا المفتاح — تتحدّث عبر قنوات محدّدة فقط، فحتى لو حُقن فيها نصّ خبيث
 * لا يملك بابًا إلى الجهاز.
 */

const isDev = !app.isPackaged
let mainWindow: BrowserWindow | null = null
let quickWindow: BrowserWindow | null = null
let tray: Tray | null = null
let currentAbort: AbortController | null = null

// -------------------------------------------------------------- النوافذ

function loadInto(window: BrowserWindow, hash: string) {
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    void window.loadURL(process.env.VITE_DEV_SERVER_URL + hash)
  } else {
    void window.loadFile(join(__dirname, '../dist/index.html'), { hash: hash.replace('#', '') })
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: '#EDE7E1',
    autoHideMenuBar: true,
    title: 'Alcode Ai',
    icon: join(__dirname, '../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  loadInto(mainWindow, '#/')
  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // الإغلاق يخفي بدل أن ينهي: التذكيرات والاختصار العام يحتاجان بقاء التطبيق.
  mainWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })

  // أي رابط خارجي يُفتح في المتصفّح لا داخل نافذة التطبيق.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

/**
 * الشريط السريع: نافذة صغيرة بلا إطار تنزل من أعلى الشاشة عند الاختصار.
 * هذا مقابل "الضغط المطوّل على زر التشغيل" في نسخة الهاتف.
 */
function createQuickWindow() {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  quickWindow = new BrowserWindow({
    width: 720,
    height: 460,
    x: Math.round(width / 2 - 360),
    y: 120,
    show: false,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  loadInto(quickWindow, '#/quick')
  quickWindow.on('blur', () => quickWindow?.hide())
  quickWindow.on('closed', () => { quickWindow = null })
}

function toggleQuick() {
  if (!quickWindow) createQuickWindow()
  if (!quickWindow) return
  if (quickWindow.isVisible()) {
    quickWindow.hide()
    return
  }
  const { width } = screen.getPrimaryDisplay().workAreaSize
  quickWindow.setPosition(Math.round(width / 2 - 360), 120)
  quickWindow.show()
  quickWindow.focus()
  quickWindow.webContents.send('quick:focus')
}

function showMain() {
  if (!mainWindow) createMainWindow()
  mainWindow?.show()
  mainWindow?.focus()
}

// -------------------------------------------------------- شريط المهام

function createTray() {
  const iconPath = join(__dirname, '../build/icon.ico')
  try {
    tray = new Tray(iconPath)
  } catch {
    return
  }
  tray.setToolTip('Alcode Ai')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'فتح Alcode Ai', click: showMain },
      { label: 'الشريط السريع', click: toggleQuick },
      { type: 'separator' },
      { label: 'خروج', click: () => { quitting = true; app.quit() } },
    ]),
  )
  tray.on('double-click', showMain)
}

// ------------------------------------------------------ الاختصار العام

let registeredHotkey = ''

function registerHotkey(accelerator: string): boolean {
  if (registeredHotkey) globalShortcut.unregister(registeredHotkey)
  registeredHotkey = ''
  if (!accelerator) return true
  try {
    const okay = globalShortcut.register(accelerator, toggleQuick)
    if (okay) registeredHotkey = accelerator
    return okay
  } catch {
    return false
  }
}

// ----------------------------------------------------------- التذكيرات

/**
 * فحص دوري كل ٣٠ ثانية.
 *
 * لماذا لا مؤقّت لكل تذكير؟ لأن مؤقّتات JS تتوقّف عند سكون الجهاز ولا تُعوَّض،
 * فيمرّ الموعد بصمت. الفحص الدوري يلتقط ما فات فور استيقاظ الجهاز.
 */
function startReminderLoop() {
  setInterval(async () => {
    const all = await stores.reminders.load()
    const now = Date.now()
    const due = all.filter((r) => !r.done && r.at <= now)
    if (!due.length) return

    for (const reminder of due) {
      if (Notification.isSupported()) {
        const notification = new Notification({ title: '⏰ تذكير', body: reminder.text })
        notification.on('click', showMain)
        notification.show()
      }
    }
    await stores.reminders.update((list) =>
      list.map((r) => (due.some((d) => d.id === r.id) ? { ...r, done: true } : r)),
    )
    mainWindow?.webContents.send('reminders:fired', due.map((r) => r.text))
  }, 30_000)
}

// ------------------------------------------------------------- الجلسة

interface PendingConfirm {
  resolve: (allowed: boolean) => void
}

const pendingConfirms = new Map<string, PendingConfirm>()

function targetWindow(fromQuick: boolean): BrowserWindow | null {
  return fromQuick ? quickWindow : mainWindow
}

/** يطلب موافقة المستخدم على أمر خطر ويعلّق التنفيذ حتى يردّ. */
function askConfirm(call: ToolCall, fromQuick: boolean): Promise<boolean> {
  const window = targetWindow(fromQuick)
  if (!window) return Promise.resolve(false)

  const id = randomUUID()
  const spec = toolByName(call.name)
  window.webContents.send('agent:confirm', {
    id,
    tool: call.name,
    danger: spec?.danger ?? 'confirm',
    title: spec?.group ?? 'أمر',
    details: JSON.stringify(call.input, null, 1).slice(0, 900),
  })

  return new Promise<boolean>((resolve) => {
    pendingConfirms.set(id, { resolve })
    // لا نُبقي الطلب معلّقًا للأبد إن أُغلقت النافذة.
    setTimeout(() => {
      if (pendingConfirms.delete(id)) resolve(false)
    }, 120_000)
  })
}

async function buildContext(settings: Settings): Promise<string> {
  const memories = (await stores.memories.load()).slice(-12).map((m) => m.text)
  const reminders = (await stores.reminders.load())
    .filter((r) => !r.done)
    .slice(0, 5)
    .map((r) => `${r.text} (${new Date(r.at).toLocaleString('ar', { hour12: false })})`)
  return contextBlock({ userName: settings.userName, memories, reminders })
}

let quitting = false

// ---------------------------------------------------------------- IPC

function registerIpc() {
  ipcMain.handle('settings:get', async () => {
    const settings = await stores.settings.load()
    // المفتاح لا يغادر العملية الرئيسية — نرسل وجوده فقط.
    return { ...settings, apiKey: '', hasApiKey: Boolean(settings.apiKey) }
  })

  ipcMain.handle('settings:set', async (_event, patch: Partial<Settings>) => {
    const next = await stores.settings.update((current) => ({ ...current, ...patch }))
    if (patch.hotkey !== undefined) registerHotkey(next.hotkey)
    if (patch.launchAtLogin !== undefined && isWindows) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] })
    }
    return { ...next, apiKey: '', hasApiKey: Boolean(next.apiKey) }
  })

  ipcMain.handle('settings:setKey', async (_event, key: string) => {
    await stores.settings.update((current) => ({ ...current, apiKey: String(key ?? '').trim() }))
    return true
  })

  ipcMain.handle('settings:testKey', async () => {
    const settings = await stores.settings.load()
    if (!settings.apiKey) return { ok: false, error: 'ما في مفتاح محفوظ.' }
    try {
      await complete(settings.apiKey, settings.model, 'رد بكلمة واحدة.', 'قل: جاهز', 16)
      return { ok: true, error: '' }
    } catch (error) {
      return { ok: false, error: friendly(error) }
    }
  })

  ipcMain.handle('tools:list', async () => toolGroups())
  ipcMain.handle('tools:count', async () => allTools.length)
  ipcMain.handle('platform:info', async () => ({
    windows: isWindows,
    version: app.getVersion(),
    platform: process.platform,
  }))

  ipcMain.handle('data:get', async (_event, key: 'memories' | 'notes' | 'reminders' | 'usage') => {
    switch (key) {
      case 'memories': return stores.memories.load()
      case 'notes': return stores.notes.load()
      case 'reminders': return stores.reminders.load()
      case 'usage': return stores.usage.load()
    }
  })

  ipcMain.handle('data:deleteMemory', async (_event, id: string) => {
    await stores.memories.update((list) => list.filter((m) => m.id !== id))
    return true
  })

  ipcMain.handle('data:deleteNote', async (_event, id: string) => {
    await stores.notes.update((list) => list.filter((n) => n.id !== id))
    return true
  })

  ipcMain.handle('data:deleteReminder', async (_event, id: string) => {
    await stores.reminders.update((list) => list.filter((r) => r.id !== id))
    return true
  })

  ipcMain.handle('data:resetUsage', async () => {
    await stores.usage.save({ input: 0, output: 0, cached: 0, requests: 0 })
    return true
  })

  ipcMain.on('agent:confirmResult', (_event, id: string, allowed: boolean) => {
    const pending = pendingConfirms.get(id)
    if (pending) {
      pendingConfirms.delete(id)
      pending.resolve(allowed)
    }
  })

  ipcMain.on('agent:stop', () => {
    currentAbort?.abort()
    currentAbort = null
  })

  ipcMain.on('quick:hide', () => quickWindow?.hide())
  ipcMain.on('quick:expand', () => {
    quickWindow?.hide()
    showMain()
  })

  ipcMain.handle('agent:send', async (event, payload: {
    history: Record<string, unknown>[]
    fromQuick?: boolean
  }) => {
    const settings = await stores.settings.load()
    if (!settings.apiKey) {
      return { ok: false, error: 'أضِف مفتاح Anthropic من الإعدادات أولًا.' }
    }

    const sender = event.sender
    const fromQuick = payload.fromQuick === true
    const emit = (agentEvent: AgentEvent) => {
      if (!sender.isDestroyed()) sender.send('agent:event', agentEvent)
    }

    const context = await buildContext(settings)
    const history = payload.history.map((message) => ({ ...message }))

    // حالة اللحظة تُرفق بآخر رسالة للمستخدم فقط، لتبقى البادئة قابلة للتخزين.
    for (let i = history.length - 1; i >= 0; i--) {
      const message = history[i] as { role: string; content: unknown }
      if (message.role === 'user' && typeof message.content === 'string') {
        message.content = `${context}\n\n${message.content}`
        break
      }
    }

    const tools = [...toolsForApi()]
    if (settings.webSearch) tools.push(webSearchTool(settings.model))

    currentAbort = new AbortController()

    await runAgent({
      apiKey: settings.apiKey,
      model: settings.model,
      effort: settings.effort,
      system: systemPrompt(settings),
      history,
      tools,
      signal: currentAbort.signal,
      confirm: async (call) => {
        const spec = toolByName(call.name)
        if (!spec) return false
        if (spec.danger === 'safe') return true
        if (spec.danger === 'confirm' && !settings.confirmDanger) return true
        // الأوامر عالية الخطر تُسأل دائمًا، حتى لو أطفأ المستخدم التأكيد.
        return askConfirm(call, fromQuick)
      },
      execute: async (call) => {
        const spec = toolByName(call.name)
        if (!spec) {
          return { ok: false, display: `أداة غير معروفة: ${call.name}`, detail: 'أداة غير معروفة.' }
        }
        try {
          return await spec.run(call.input as Record<string, any>)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return { ok: false, display: `فشل ${call.name}`, detail: `تعذّر التنفيذ: ${message}` }
        }
      },
      emit: (agentEvent) => {
        if (agentEvent.type === 'usage') {
          void stores.usage.update((current) => ({
            input: current.input + agentEvent.input,
            output: current.output + agentEvent.output,
            cached: current.cached + agentEvent.cached,
            requests: current.requests + 1,
          }))
        }
        emit(agentEvent)
      },
    })

    currentAbort = null
    return { ok: true, error: '', history }
  })
}

// --------------------------------------------------------------- إقلاع

const single = app.requestSingleInstanceLock()
if (!single) {
  app.quit()
} else {
  app.on('second-instance', showMain)

  app.whenReady().then(async () => {
    registerIpc()

    const settings = await stores.settings.load().catch(() => defaultSettings)
    createMainWindow()
    createQuickWindow()
    createTray()
    registerHotkey(settings.hotkey)
    startReminderLoop()

    if (process.argv.includes('--hidden')) mainWindow?.hide()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    // نبقى في شريط المهام: الاختصار العام والتذكيرات تحتاج عملية حيّة.
  })

  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
