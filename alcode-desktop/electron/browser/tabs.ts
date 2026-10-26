import { BrowserWindow, WebContentsView, shell } from 'electron'
import { extractReadable } from '../readable'
import { rememberPage } from './memory'
import { resolveAddress } from './url'

/**
 * تبويبات المتصفّح.
 *
 * `WebContentsView` لا `<webview>`: الأخير وسمٌ تنصح إلكترون بتجنّبه، وهو
 * أبطأ وأقلّ استقرارًا ولا يصل إليه المساعد بسهولة. العروض هنا أبناءُ
 * النافذة نفسها، فيبقى كل تبويب عمليةً مستقلّة ولا يُسقط تبويبٌ معطوب
 * التطبيق كلّه.
 *
 * الصفحة لا تملك `nodeIntegration` ولا جسر التطبيق البتّة: هي موقعٌ من
 * الإنترنت، وما يُقرأ منها بيانات لا أوامر.
 */

export interface TabInfo {
  id: number
  title: string
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  active: boolean
}

interface Tab {
  id: number
  view: WebContentsView
}

const HOME = 'about:blank'

export class Browser {
  private tabs: Tab[] = []
  private activeId = 0
  private nextId = 1
  private bounds = { x: 0, y: 0, width: 0, height: 0 }
  private visible = false

  constructor(
    private readonly window: BrowserWindow,
    private readonly partition: string,
    private readonly onChange: () => void,
  ) {}

  // ----------------------------------------------------------- الحالة

  list(): TabInfo[] {
    return this.tabs.map((tab) => ({
      id: tab.id,
      title: tab.view.webContents.getTitle() || 'تبويب جديد',
      url: tab.view.webContents.getURL(),
      loading: tab.view.webContents.isLoading(),
      canGoBack: tab.view.webContents.navigationHistory.canGoBack(),
      canGoForward: tab.view.webContents.navigationHistory.canGoForward(),
      active: tab.id === this.activeId,
    }))
  }

  private find(id?: number): Tab | undefined {
    return id === undefined
      ? this.tabs.find((tab) => tab.id === this.activeId)
      : this.tabs.find((tab) => tab.id === id)
  }

  // ----------------------------------------------------------- الإنشاء

  open(url = HOME): number {
    const id = this.nextId++
    const view = new WebContentsView({
      webPreferences: {
        partition: this.partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // صفحة من الإنترنت لا ترى جسر التطبيق: لا مفتاح ولا أداة ولا ملف.
        preload: undefined,
      },
    })

    const wc = view.webContents
    const notify = () => this.onChange()

    for (const event of [
      'page-title-updated', 'did-start-loading', 'did-stop-loading',
      'did-navigate', 'did-navigate-in-page', 'did-fail-load',
    ] as const) {
      wc.on(event as never, notify)
    }

    // صفحة انتهت: تُحفظ في ذاكرة التصفّح لتبقى قابلة للبحث لاحقًا.
    wc.on('did-finish-load', () => {
      notify()
      void this.capture(id)
    })

    // الروابط التي تفتح نافذة تصير تبويبًا، ولا تُفتح نافذة بلا شريط عنوان.
    wc.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:/i.test(target)) this.open(target)
      else if (/^mailto:|^tel:/i.test(target)) void shell.openExternal(target)
      return { action: 'deny' }
    })

    this.tabs.push({ id, view })
    this.activate(id)
    if (url && url !== HOME) this.navigate(url, id)
    this.onChange()
    return id
  }

  close(id: number): void {
    const index = this.tabs.findIndex((tab) => tab.id === id)
    if (index < 0) return
    const [tab] = this.tabs.splice(index, 1)
    this.window.contentView.removeChildView(tab.view)
    tab.view.webContents.close()
    if (this.activeId === id) {
      const next = this.tabs[index] ?? this.tabs[index - 1]
      this.activeId = next?.id ?? 0
      if (next) this.attach(next)
    }
    this.onChange()
  }

  activate(id: number): void {
    const tab = this.find(id)
    if (!tab) return
    for (const other of this.tabs) {
      if (other.id !== id) this.window.contentView.removeChildView(other.view)
    }
    this.activeId = id
    this.attach(tab)
    this.onChange()
  }

  private attach(tab: Tab): void {
    if (!this.visible) return
    this.window.contentView.addChildView(tab.view)
    tab.view.setBounds(this.bounds)
  }

  // ----------------------------------------------------------- التنقّل

  navigate(input: string, id?: number): boolean {
    const tab = this.find(id) ?? this.find(this.open())
    if (!tab) return false
    void tab.view.webContents.loadURL(resolveAddress(input))
    return true
  }

  back(id?: number): void { this.find(id)?.view.webContents.navigationHistory.goBack() }
  forward(id?: number): void { this.find(id)?.view.webContents.navigationHistory.goForward() }
  reload(id?: number): void { this.find(id)?.view.webContents.reload() }
  stop(id?: number): void { this.find(id)?.view.webContents.stop() }

  // ----------------------------------------------------------- التخطيط

  setBounds(rect: { x: number; y: number; width: number; height: number }): void {
    this.bounds = {
      x: Math.round(rect.x), y: Math.round(rect.y),
      width: Math.max(0, Math.round(rect.width)),
      height: Math.max(0, Math.round(rect.height)),
    }
    this.find()?.view.setBounds(this.bounds)
  }

  /**
   * إظهار العروض وإخفاؤها.
   *
   * `WebContentsView` يرسم فوق الواجهة لا داخلها، فلو بقي ظاهرًا عند
   * الانتقال إلى تبويب آخر في التطبيق لغطّى الشاشة كلّها.
   */
  setVisible(value: boolean): void {
    this.visible = value
    if (value) {
      const tab = this.find()
      if (tab) this.attach(tab)
    } else {
      for (const tab of this.tabs) this.window.contentView.removeChildView(tab.view)
    }
  }

  // ----------------------------------------------------------- القراءة

  /** نصّ الصفحة كما يراه القارئ — هو ما يُعطى للمساعد. */
  async read(id?: number): Promise<{ title: string; url: string; text: string }> {
    const tab = this.find(id)
    if (!tab) return { title: '', url: '', text: '' }
    const html = await tab.view.webContents
      .executeJavaScript('document.documentElement.outerHTML')
      .catch(() => '')
    const page = extractReadable(String(html))
    return {
      title: page.title || tab.view.webContents.getTitle(),
      url: tab.view.webContents.getURL(),
      text: page.text,
    }
  }

  private async capture(id: number): Promise<void> {
    const tab = this.find(id)
    if (!tab) return
    const url = tab.view.webContents.getURL()
    if (!/^https?:/i.test(url)) return
    const page = await this.read(id).catch(() => null)
    if (page?.text) await rememberPage({ url, title: page.title, text: page.text })
  }

  async screenshot(id?: number): Promise<string> {
    const tab = this.find(id)
    if (!tab) return ''
    const image = await tab.view.webContents.capturePage()
    return image.toPNG().toString('base64')
  }

  async runInPage(script: string, id?: number): Promise<unknown> {
    const tab = this.find(id)
    if (!tab) return null
    return tab.view.webContents.executeJavaScript(script, true)
  }

  destroy(): void {
    for (const tab of this.tabs) {
      this.window.contentView.removeChildView(tab.view)
      tab.view.webContents.close()
    }
    this.tabs = []
  }
}
