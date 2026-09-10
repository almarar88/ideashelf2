import {
  app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Notification,
  nativeImage, screen, shell, Tray,
} from 'electron'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { AgentEvent, ToolCall, complete, friendly, runAgent, webSearchTool } from './claude'
import { contextBlock, systemPrompt } from './prompt'
import { defaultSettings, Habit, Settings, stores, Task } from './store'
import { allTools, toolByName, toolGroups, toolsForApi } from './tools'
import { isWindows } from './ps'
import { activeSources, contextSummary, getDay, getNews, getWeather, prayersFor } from './daily'
import { METHODS, PRAYERS } from './daily/prayer'
import { searchPlaces } from './daily/weather'
import { locateViaIp, locateViaWindows, placeFromCoordinates } from './daily/locate'
import { validateFeed, topicSource } from './daily/news'
import { longGregorianAr, longHijriAr } from './daily/dates'
import {
  installCrashGuards, log, markBootStarted, markBootSucceeded, previousBootFailed,
  readLogTail, reportFatal, startupLogPath,
} from './startup'

/**
 * العملية الرئيسية: النافذة، شريط المهام، الاختصار العام، وجسر الأوامر.
 *
 * المفتاح والأدوات كلها هنا. واجهة العرض لا تلمس نظام الملفات ولا PowerShell
 * ولا المفتاح — تتحدّث عبر قنوات محدّدة فقط، فحتى لو حُقن فيها نصّ خبيث
 * لا يملك بابًا إلى الجهاز.
 */

const isDev = !app.isPackaged

/**
 * الأيقونة: كان الكود يشير إلى build/icon.ico وهو ملف لا وجود له ولا يُحزَم
 * (المحزوم هو icon.png). النتيجة: شريط المهام يفشل بصمت فيبقى المستخدم بلا
 * نافذة وبلا أيقونة يفتح منها. نستعمل الملف الموجود فعلًا ونتحقّق منه.
 */
function appIcon(): Electron.NativeImage | undefined {
  // في النسخة المحزومة تُفكّ الأيقونة خارج الأرشيف (asarUnpack)، فنجرّب
  // المسارين: المفكوك أولًا ثم الداخلي عند التشغيل من المصدر.
  const candidates = [
    join(__dirname, '../build/icon.png').replace('app.asar', 'app.asar.unpacked'),
    join(__dirname, '../build/icon.png'),
  ]
  for (const path of candidates) {
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) return image
  }
  log('لم يُعثر على أيقونة التطبيق في أي مسار متوقّع')
  return undefined
}

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
    icon: appIcon(),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // النافذة تُظهَر في كل الأحوال:
  //  ١) عند أول رسم — الحالة السليمة.
  //  ٢) وإلا بعد ثانيتين من انتهاء التحميل — إن انهارت الواجهة قبل الرسم.
  //  ٣) وإلا بعد ست ثوانٍ مهما جرى — إن لم يكتمل التحميل أصلًا.
  // بدون (٢) و(٣) يبقى التطبيق حيًّا بلا نافذة، وهو ما شكا منه المستخدم.
  const reveal = (why: string) => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isVisible()) return
    log(`إظهار النافذة (${why})`)
    mainWindow.show()
    mainWindow.focus()
    // ظهرت نافذة: الإقلاع نجح، فتُمحى العلامة ويعود التسريع في المرّة القادمة.
    markBootSucceeded()
  }

  mainWindow.once('ready-to-show', () => reveal('أول رسم'))
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => reveal('انتهى التحميل بلا رسم'), 2_000)
  })
  const lastResort = setTimeout(() => reveal('مهلة الإقلاع'), 6_000)
  mainWindow.once('show', () => clearTimeout(lastResort))

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    log('فشل تحميل الواجهة', `${code} ${description} ${url}`)
    reveal('فشل التحميل')
    void mainWindow?.webContents.executeJavaScript(
      `document.body.innerHTML = ${JSON.stringify(
        '<div style="padding:40px;font:16px system-ui;direction:rtl">' +
        '<h2>تعذّر تحميل الواجهة</h2><p>راجع السجل في:<br><code>' +
        startupLogPath() + '</code></p></div>',
      )}`,
    ).catch(() => undefined)
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('انهارت عملية العرض', details.reason)
    if (details.reason !== 'clean-exit') {
      mainWindow?.webContents.reload()
    }
  })

  loadInto(mainWindow, '#/')

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
  if (!quickWindow) {
    try {
      createQuickWindow()
    } catch (error) {
      // نافذة شفّافة تفشل على بعض تعريفات الرسوميات: نفتح النافذة الكبيرة بدلها
      // بدل أن يضغط المستخدم الاختصار فلا يحدث شيء.
      log('تعذّر إنشاء الشريط السريع — نفتح النافذة الرئيسية', error)
      showMain()
      return
    }
  }
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
  const image = appIcon()
  if (!image) {
    log('لا أيقونة لشريط المهام — يُتجاوز')
    return
  }
  try {
    // شريط المهام في ويندوز يريد ١٦×١٦؛ الأيقونة الأصلية ١٠٢٤ فتُصغَّر.
    tray = new Tray(image.resize({ width: 16, height: 16 }))
  } catch (error) {
    log('تعذّر إنشاء أيقونة شريط المهام', error)
    return
  }
  tray.setToolTip('Alcode Ai')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'فتح Alcode Ai', click: showMain },
      { label: 'الشريط السريع', click: toggleQuick },
      { type: 'separator' },
      {
        label: 'مجلد السجل',
        click: () => {
          const path = startupLogPath()
          if (path) shell.showItemInFolder(path)
        },
      },
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

// ------------------------------------------------- تنبيهات الصلاة

/** ما أُعلن عنه اليوم، حتى لا يتكرّر التنبيه في كل دورة فحص. */
const announced = new Set<string>()

/**
 * تنبيه عند كل صلاة. نفحص كل نصف دقيقة كما في حلقة التذكيرات وللسبب نفسه:
 * مؤقّت واحد لكل صلاة يتوقّف عند سكون الجهاز ويمرّ الوقت بصمت.
 */
function startPrayerLoop() {
  setInterval(async () => {
    const settings = await stores.settings.load()
    if (!settings.place || !settings.prayerAlerts) return

    const now = new Date()
    const day = prayersFor(settings, now)
    if (!day) return

    const stamp = now.getTime()
    const today = now.toDateString()
    for (const prayer of PRAYERS) {
      if (!prayer.obligatory) continue
      const at = day.times[prayer.key]
      const key = `${today}:${prayer.key}`
      if (announced.has(key)) continue
      // نافذة دقيقة واحدة: مرّ الوقت ولم يمضِ عليه أكثر من ٦٠ ثانية.
      if (at > stamp || stamp - at > 60_000) continue
      announced.add(key)
      if (Notification.isSupported()) {
        new Notification({
          title: `🕌 ${prayer.arabic}`,
          body: `حان وقت ${prayer.arabic} — ${settings.place.name}`,
        }).show()
      }
      mainWindow?.webContents.send('prayer:fired', prayer.key)
    }
    // مفاتيح الأمس تُحذف، ومفاتيح اليوم تبقى. المسح الكامل كان يسمح بإعادة
    // التنبيه للصلاة نفسها ما دامت داخل نافذة الدقيقة.
    if (announced.size > 12) {
      for (const key of [...announced]) {
        if (!key.startsWith(today)) announced.delete(key)
      }
    }
  }, 30_000)
}

// ---------------------------------------------------- ملخّص الصباح

/*
 * آخر يوم أُرسل فيه الملخّص يُخزَّن على القرص (`stores.brief`) لا في الذاكرة:
 * متغيّر في الذاكرة يضيع مع كل إغلاق، فمن يعيد تشغيل التطبيق بعد ملخّص
 * الصباح كان يستقبله من جديد.
 */

/**
 * إشعار واحد في الصباح: التاريخ، الصلاة القادمة، الطقس، والمهام.
 * يُرسَل عند أول فحص يتجاوز الوقت المحدّد — فإن كان الجهاز نائمًا وقتها
 * وصل عند الاستيقاظ بدل أن يُفقَد.
 */
function startBriefLoop() {
  setInterval(async () => {
    const settings = await stores.settings.load()
    if (!settings.morningBriefAt) return

    const now = new Date()
    const today = now.toDateString()
    if ((await stores.brief.load()).on === today) return

    const [hour, minute] = settings.morningBriefAt.split(':').map(Number)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return
    if (now.getHours() * 60 + now.getMinutes() < hour * 60 + minute) return

    await stores.brief.save({ on: today })
    const summary = await contextSummary().catch(() => '')
    if (!summary || !Notification.isSupported()) return

    const notification = new Notification({
      title: `☀️ صباح الخير${settings.userName ? ' ' + settings.userName : ''}`,
      // الإشعار يقتصر على أول أربعة أسطر: ويندوز يقصّ ما زاد بلا رحمة.
      body: summary.split('\n').slice(0, 4).join('\n'),
    })
    notification.on('click', showMain)
    notification.show()
  }, 60_000)
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

  // حالة اليوم (صلاة، طقس، مهام، عناوين) تُحقن مع كل رسالة، كما في نسخة الهاتف:
  // بدونها يسأل المساعد عن أشياء يعرفها التطبيق أصلًا.
  const daily = await contextSummary().catch(() => '')

  return contextBlock({ userName: settings.userName, memories, reminders }) +
    (daily ? `\n<يومك>\n${daily}\n</يومك>` : '')
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

  // ------------------------------------------------------ الرفيق اليومي

  ipcMain.handle('daily:day', async () => getDay())

  ipcMain.handle('daily:weather', async (_event, force: boolean) => getWeather(force === true))

  ipcMain.handle('daily:news', async (_event, force: boolean) => getNews(force === true))

  ipcMain.handle('daily:sources', async () => {
    const settings = await stores.settings.load()
    return activeSources(settings)
  })

  ipcMain.handle('daily:toggleSource', async (_event, id: string, enabled: boolean) => {
    await stores.settings.update((current) => {
      const disabled = new Set(current.disabledSources)
      if (enabled) disabled.delete(id)
      else disabled.add(id)
      return { ...current, disabledSources: [...disabled] }
    })
    return true
  })

  ipcMain.handle('daily:addSource', async (_event, url: string, category: string) => {
    try {
      const probe = await validateFeed(url)
      await stores.settings.update((current) => ({
        ...current,
        customSources: [...current.customSources, {
          id: `custom:${Date.now()}`,
          name: probe.name,
          url,
          category: category || 'الأهم',
          enabled: true,
          custom: true,
        }],
      }))
      return { ok: true, name: probe.name, count: probe.count, error: '' }
    } catch (error) {
      return { ok: false, name: '', count: 0, error: (error as Error).message }
    }
  })

  ipcMain.handle('daily:removeSource', async (_event, id: string) => {
    await stores.settings.update((current) => ({
      ...current,
      customSources: current.customSources.filter((s) => s.id !== id),
    }))
    return true
  })

  ipcMain.handle('daily:addTopic', async (_event, query: string) => {
    const trimmed = String(query ?? '').trim()
    if (!trimmed) return false
    await stores.settings.update((current) => ({
      ...current,
      topics: [...new Set([...current.topics, trimmed])],
    }))
    void topicSource(trimmed)
    return true
  })

  ipcMain.handle('daily:removeTopic', async (_event, query: string) => {
    await stores.settings.update((current) => ({
      ...current,
      topics: current.topics.filter((t) => t !== query),
    }))
    return true
  })

  /**
   * تحديد الموقع تلقائيًا. `allowIp` صريح: تقدير IP يكشف عنوانك لخدمة خارجية،
   * فلا يجري إلا إذا اختاره المستخدم بعد فشل خدمة ويندوز.
   */
  ipcMain.handle('daily:detectPlace', async (_event, allowIp: boolean) => {
    let result = await locateViaWindows()
    if (result.status !== 'ok' && allowIp === true) {
      const fallback = await locateViaIp()
      if (fallback.status === 'ok') result = fallback
    }
    if (result.status !== 'ok') {
      return { ok: false, status: result.status, message: result.message, place: null, source: 'none' }
    }
    const place = await placeFromCoordinates(result.latitude, result.longitude)
    await stores.settings.update((current) => ({ ...current, place }))
    log(`حُدّد الموقع من ${result.source}: ${place.name}`)
    return {
      ok: true,
      status: 'ok',
      message: '',
      place,
      source: result.source,
      accuracyMeters: result.accuracyMeters,
    }
  })

  /** يفتح صفحة خصوصية الموقع في ويندوز ليمنح المستخدم الصلاحية بنفسه. */
  ipcMain.handle('daily:openLocationSettings', async () => {
    await shell.openExternal('ms-settings:privacy-location')
    return true
  })

  ipcMain.handle('diag:log', async () => ({
    path: startupLogPath(),
    tail: readLogTail(240),
    version: app.getVersion(),
    electron: process.versions.electron,
    platform: `${process.platform} ${process.arch}`,
  }))

  ipcMain.handle('diag:openLog', async () => {
    const path = startupLogPath()
    if (!path) return false
    shell.showItemInFolder(path)
    return true
  })

  ipcMain.handle('daily:methods', async () =>
    METHODS.map((method) => ({ id: method.id, arabic: method.arabic })))

  ipcMain.handle('daily:searchPlaces', async (_event, query: string) => {
    try {
      return await searchPlaces(String(query ?? ''))
    } catch {
      return []
    }
  })

  ipcMain.handle('daily:prayerMonth', async (_event, year: number, month: number) => {
    const settings = await stores.settings.load()
    if (!settings.place) return []
    const days = new Date(year, month, 0).getDate()
    const rows = []
    for (let day = 1; day <= days; day++) {
      const date = new Date(year, month - 1, day)
      const prayers = prayersFor(settings, date)
      if (!prayers) continue
      rows.push({
        day,
        gregorian: longGregorianAr(date),
        hijri: longHijriAr(date, settings.hijriOffset),
        times: PRAYERS.map((p) => ({ key: p.key, arabic: p.arabic, at: prayers.times[p.key] })),
      })
    }
    return rows
  })

  ipcMain.handle('daily:tasks', async () => stores.tasks.load())
  ipcMain.handle('daily:habits', async () => stores.habits.load())

  /**
   * الحفظ دمج لا استبدال.
   *
   * الاستبدال كان يمحو كل حقل لم يرسله المُنادي: الشاشة الرئيسية تُعلّم المهمة
   * منجزة وترسل العنوان والموعد فقط، فتضيع الملاحظة والأولوية والتكرار بصمت.
   * الدمج يحفظ المرسَل ويُبقي الباقي، والحقل الذي يريد المستخدم مسحه يُرسَل
   * صراحةً بقيمة فارغة فيُمسح.
   */
  ipcMain.handle('daily:saveTask', async (_event, task: any) => {
    if (!task?.id) return false
    await stores.tasks.update((list) => {
      const index = list.findIndex((t) => t.id === task.id)
      if (index < 0) {
        return [{
          note: '', dueDate: null, dueTime: null, priority: 1,
          done: false, createdAt: Date.now(), repeat: null,
          ...task,
        } as Task, ...list]
      }
      const next = [...list]
      next[index] = { ...next[index], ...task }
      return next
    })
    return true
  })

  ipcMain.handle('daily:deleteTask', async (_event, id: string) => {
    await stores.tasks.update((list) => list.filter((t) => t.id !== id))
    return true
  })

  ipcMain.handle('daily:saveHabit', async (_event, habit: any) => {
    if (!habit?.id) return false
    await stores.habits.update((list) => {
      const index = list.findIndex((h) => h.id === habit.id)
      if (index < 0) {
        return [...list, {
          emoji: '', targetPerDay: 1, log: {}, createdAt: Date.now(), ...habit,
        } as Habit]
      }
      // الدمج هنا أهمّ: `log` يحمل تاريخ العادة كله، وإرسال جزئي واحد
      // بلا هذا الحقل كان يمحو السلسلة من أوّلها.
      const next = [...list]
      next[index] = { ...next[index], ...habit }
      return next
    })
    return true
  })

  ipcMain.handle('daily:deleteHabit', async (_event, id: string) => {
    await stores.habits.update((list) => list.filter((h) => h.id !== id))
    return true
  })

  ipcMain.handle('daily:openExternal', async (_event, url: string) => {
    if (!/^https?:\/\//i.test(String(url))) return false
    await shell.openExternal(String(url))
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

  /**
   * النافذة تتبع محتواها. الحدّ الأدنى يمنع اختفاءها والأعلى يمنع تجاوز الشاشة،
   * والمقاس يبقى ثابت العرض حتى لا يقفز الشريط تحت المؤشّر.
   */
  ipcMain.on('quick:resize', (_event, height: number) => {
    if (!quickWindow || quickWindow.isDestroyed()) return
    const wanted = Math.round(Number(height) || 0)
    if (!Number.isFinite(wanted) || wanted <= 0) return
    const { height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const clamped = Math.min(Math.max(wanted, 96), Math.max(200, screenHeight - 200))
    const bounds = quickWindow.getBounds()
    if (bounds.height === clamped) return
    quickWindow.setBounds({ ...bounds, height: clamped })
  })
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

installCrashGuards()
log(`إقلاع Alcode Ai ${app.getVersion()} — ${process.platform} ${process.arch}`)

// يجب أن يسبق whenReady: تعطيل التسريع لا يُقبل بعد جهوزية التطبيق.
if (previousBootFailed()) {
  log('التشغيل السابق لم يُظهر نافذة — نُقلع بلا تسريع عتادي')
  app.disableHardwareAcceleration()
}
markBootStarted()

const single = app.requestSingleInstanceLock()
if (!single) {
  log('نسخة أخرى تعمل بالفعل — نُظهر نافذتها ونخرج')
  app.quit()
} else {
  app.on('second-instance', showMain)

  app.whenReady().then(async () => {
    // كل خطوة داخل حرس: خطأ في أي منها كان يعني قبلًا تطبيقًا حيًّا بلا نافذة.
    // النافذة تُنشأ أولًا حتى يرى المستخدم شيئًا حتى لو تعطّل ما بعدها.
    try {
      log('جاهز — أُنشئ النافذة')
      createMainWindow()
    } catch (error) {
      reportFatal('إنشاء النافذة', error)
      return
    }

    const step = async (name: string, work: () => unknown) => {
      try {
        await work()
        log(`تمّ: ${name}`)
      } catch (error) {
        // خطوة ثانوية تفشل لا تُسقط التطبيق — تُسجَّل ويستمر.
        log(`تعذّر: ${name}`, error)
      }
    }

    await step('تسجيل قنوات الجسر', registerIpc)

    const settings = await stores.settings.load().catch((error) => {
      log('تعذّرت قراءة الإعدادات — نستعمل الافتراضية', error)
      return defaultSettings
    })

    await step('شريط المهام', createTray)
    await step('الاختصار العام', () => registerHotkey(settings.hotkey))
    await step('حلقة التذكيرات', startReminderLoop)
    await step('حلقة تنبيهات الصلاة', startPrayerLoop)
    await step('حلقة ملخّص الصباح', startBriefLoop)

    // الشريط السريع نافذة شفّافة، وهي أكثر ما يتعارض مع تعريفات الرسوميات.
    // نؤجّلها إلى أول استعمال فعلي بدل أن تُخطر الإقلاع كله.
    if (process.argv.includes('--hidden')) {
      log('أُقلِع مخفيًا بطلب من ويندوز')
      mainWindow?.hide()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
    log('اكتمل الإقلاع')
  }).catch((error) => reportFatal('الإقلاع', error))

  app.on('window-all-closed', () => {
    // نبقى في شريط المهام: الاختصار العام والتذكيرات تحتاج عملية حيّة.
  })

  app.on('before-quit', () => { quitting = true })
  app.on('will-quit', () => globalShortcut.unregisterAll())
}
