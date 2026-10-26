import { useCallback, useEffect, useRef, useState } from 'react'
import type { BrowserTab, BrowserExtension } from '../electron/preload-api'

/**
 * المتصفّح.
 *
 * الصفحة ليست داخل هذا الـ DOM: `WebContentsView` يرسمها النظام **فوق**
 * الواجهة. فهذا المكوّن يرسم الإطار فقط، ويقيس المستطيل الفارغ في وسطه
 * ويخبر العملية الرئيسية أين تضع الصفحة — ويُخفيها عند مغادرة التبويب،
 * وإلا غطّت بقيّة التطبيق.
 */
export function BrowserPane({ visible }: { visible: boolean }) {
  const [tabs, setTabs] = useState<BrowserTab[]>([])
  const [address, setAddress] = useState('')
  const [editing, setEditing] = useState(false)
  const [panel, setPanel] = useState<'' | 'extensions' | 'history'>('')
  const slot = useRef<HTMLDivElement>(null)

  const active = tabs.find((tab) => tab.active)

  // مقاس الصفحة يتبع المستطيل الفارغ، ويُعاد قياسه مع كل تغيّر حجم.
  const measure = useCallback(() => {
    const node = slot.current
    if (!node || !visible) return
    const rect = node.getBoundingClientRect()
    void window.alcode.browser.bounds({
      x: rect.left, y: rect.top, width: rect.width, height: rect.height,
    })
  }, [visible])

  useEffect(() => window.alcode.browser.onTabs((next) => setTabs(next as BrowserTab[])), [])

  useEffect(() => {
    void window.alcode.browser.tabs().then(setTabs)
  }, [])

  useEffect(() => {
    void window.alcode.browser.visible(visible)
    if (visible) measure()
  }, [visible, measure])

  useEffect(() => {
    if (!visible) return undefined
    measure()
    const observer = new ResizeObserver(measure)
    if (slot.current) observer.observe(slot.current)
    window.addEventListener('resize', measure)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [visible, measure, panel])

  // شريط العنوان يتبع التبويب إلا أثناء الكتابة فيه.
  useEffect(() => {
    if (!editing) setAddress(active?.url && active.url !== 'about:blank' ? active.url : '')
  }, [active?.url, editing])

  const go = (value: string) => {
    if (!value.trim()) return
    setEditing(false)
    if (tabs.length) void window.alcode.browser.navigate(value)
    else void window.alcode.browser.open(value)
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 0 }}>
      {/* شريط التبويبات */}
      <div className="row" style={{ gap: 6, padding: '10px 12px 0', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={tab.active ? 'pill active' : 'pill'}
            onClick={() => void window.alcode.browser.activate(tab.id)}
            style={{ maxWidth: 220, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
            }}>
              {tab.loading ? 'يحمّل…' : (tab.title || 'تبويب جديد')}
            </span>
            <span
              role="button"
              aria-label="إغلاق"
              onClick={(event) => { event.stopPropagation(); void window.alcode.browser.close(tab.id) }}
              style={{ opacity: 0.6, paddingInlineStart: 2 }}
            >
              ✕
            </span>
          </button>
        ))}
        <button className="chip" onClick={() => void window.alcode.browser.open()}>+ تبويب</button>
      </div>

      {/* شريط العنوان والتحكّم */}
      <div className="row" style={{ gap: 6, padding: '8px 12px', alignItems: 'center' }}>
        <button className="chip" disabled={!active?.canGoBack}
          onClick={() => void window.alcode.browser.back()} aria-label="رجوع">›</button>
        <button className="chip" disabled={!active?.canGoForward}
          onClick={() => void window.alcode.browser.forward()} aria-label="تقدّم">‹</button>
        <button className="chip"
          onClick={() => void (active?.loading
            ? window.alcode.browser.stop() : window.alcode.browser.reload())}>
          {active?.loading ? 'إيقاف' : '↻'}
        </button>
        <input
          className="field grow"
          value={address}
          onChange={(event) => { setEditing(true); setAddress(event.target.value) }}
          onKeyDown={(event) => { if (event.key === 'Enter') go(address) }}
          onBlur={() => setEditing(false)}
          placeholder="اكتب عنوانًا أو ابحث"
          style={{ direction: 'ltr', textAlign: 'left', fontSize: 13 }}
        />
        <button className={panel === 'history' ? 'chip active' : 'chip'}
          onClick={() => setPanel(panel === 'history' ? '' : 'history')}>سجلّي</button>
        <button className={panel === 'extensions' ? 'chip active' : 'chip'}
          onClick={() => setPanel(panel === 'extensions' ? '' : 'extensions')}>الإضافات</button>
      </div>

      {panel === 'extensions' && <ExtensionsPanel />}
      {panel === 'history' && <HistoryPanel onOpen={(url) => void window.alcode.browser.open(url)} />}

      {/* المستطيل الذي تُرسم فيه الصفحة — فارغ عمدًا */}
      <div ref={slot} style={{ flex: 1, minHeight: 120, margin: '0 12px 12px', borderRadius: 12 }}>
        {!tabs.length && (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--label-2)' }}>
            <p style={{ fontSize: 15 }}>افتح تبويبًا وابدأ.</p>
            <p className="footnote">
              المساعد يقرأ تبويباتك ويقارن بينها، وكل صفحة تقرأها تبقى قابلة
              للبحث بنصّها لا بعنوانها فقط.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * الإضافات.
 *
 * صريحة في حدودها: إلكترون لا يقبل ملفّات `.crx` من متجر كروم ولا يدعم
 * كل واجهاته. فالمطلوب مجلّد غير مضغوط، وهذا مكتوبٌ للمستخدم هنا بدل
 * أن يكتشفه برسالة فشل غامضة.
 */
function ExtensionsPanel() {
  const [list, setList] = useState<BrowserExtension[]>([])
  const [error, setError] = useState('')

  const refresh = () => { void window.alcode.browser.extensions().then(setList) }
  useEffect(refresh, [])

  return (
    <div className="card" style={{ margin: '0 12px 10px', padding: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 14 }}>إضافات كروم</strong>
        <button className="chip" onClick={async () => {
          const result = await window.alcode.browser.addExtension()
          setError(result.ok ? '' : result.error)
          refresh()
        }}>أضِف مجلّد إضافة</button>
      </div>
      <p className="footnote" style={{ marginTop: 6 }}>
        تُقبل الإضافة كمجلّد غير مضغوط فيه <code>manifest.json</code>. ملفّات
        <code> .crx</code> من المتجر غير مدعومة في إلكترون، وبعض واجهات كروم
        غير متوفّرة — فقد تعمل الإضافة جزئيًا.
      </p>
      {error && <p style={{ color: 'var(--red-ink)', margin: '6px 0 0' }}>⚠️ {error}</p>}
      {list.map((one) => (
        <div key={one.id} className="row"
          style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <span style={{ fontSize: 13 }}>{one.name} <span className="footnote">{one.version}</span></span>
          <button className="chip" onClick={async () => {
            await window.alcode.browser.removeExtension(one.id); refresh()
          }}>أزِل</button>
        </div>
      ))}
      {!list.length && !error && <p className="footnote" style={{ marginTop: 8 }}>ما في إضافات بعد.</p>}
    </div>
  )
}

/** البحث في نصّ ما قرأته، لا في عناوينه. */
function HistoryPanel({ onOpen }: { onOpen: (url: string) => void }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<{ url: string; title: string; text: string; at: number }[]>([])

  useEffect(() => {
    const timer = setTimeout(() => { void window.alcode.browser.history(query).then(setRows) }, 200)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="card" style={{ margin: '0 12px 10px', padding: 14, maxHeight: 260, overflowY: 'auto' }}>
      <input
        className="field"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="ابحث في ما قرأته — بالمعنى لا بالعنوان"
      />
      {rows.map((row) => (
        <div key={row.url} style={{ marginTop: 10, cursor: 'pointer' }} onClick={() => onOpen(row.url)}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{row.title || row.url}</div>
          <div className="footnote" style={{ direction: 'ltr', textAlign: 'left' }}>{row.url}</div>
          <div className="footnote" style={{ marginTop: 2 }}>{row.text.slice(0, 160)}…</div>
        </div>
      ))}
      {!rows.length && (
        <p className="footnote" style={{ marginTop: 8 }}>
          {query ? 'ما لقيت شيئًا.' : 'الصفحات التي تقرأها تظهر هنا وتبقى قابلة للبحث بنصّها.'}
        </p>
      )}
    </div>
  )
}
