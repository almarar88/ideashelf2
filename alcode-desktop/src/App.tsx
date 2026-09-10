import { useCallback, useEffect, useState } from 'react'
import { Bubble, ConfirmDialog, Section, Thinking, useAutoScroll } from './components'
import { useAgent } from './useAgent'
import { AppSettings, Place } from './types'
import {
  DayTab, HomeTab, NewsTab, PrayerTab, TimeZoneContext, Use24hContext, WeatherTab,
} from './daily'

type Tab =
  | 'home' | 'chat' | 'day' | 'prayer' | 'weather' | 'news'
  | 'skills' | 'memory' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'الرئيسية', icon: '🏠' },
  { id: 'chat', label: 'المساعد', icon: '✨' },
  { id: 'day', label: 'يومي', icon: '📋' },
  { id: 'prayer', label: 'الصلاة', icon: '🕌' },
  { id: 'weather', label: 'الطقس', icon: '⛅' },
  { id: 'news', label: 'الأخبار', icon: '📰' },
  { id: 'skills', label: 'القدرات', icon: '🧩' },
  { id: 'memory', label: 'الذاكرة', icon: '🧠' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
]

const SUGGESTIONS = [
  'شو حالة الجهاز؟',
  'رتّب مجلد التنزيلات',
  'شو في الشاشة؟',
  'وين راحت مساحة القرص؟',
  'صغّر كل النوافذ',
  'ذكّرني بعد ٢٠ دقيقة أشرب ماء',
]

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [toolCount, setToolCount] = useState(0)
  const [platform, setPlatform] = useState<{ windows: boolean; version: string } | null>(null)

  const agent = useAgent(false)
  const scrollRef = useAutoScroll(agent.messages.map((m) => m.content).join('|'))
  const [input, setInput] = useState('')

  const refreshSettings = useCallback(async () => {
    setSettings(await window.alcode.settings.get())
  }, [])

  useEffect(() => {
    void refreshSettings()
    void window.alcode.tools.count().then(setToolCount)
    void window.alcode.platform().then(setPlatform)
  }, [refreshSettings])

  // المظهر يتبع الإعداد، و"النظام" يتبع تفضيل ويندوز نفسه.
  useEffect(() => {
    if (!settings) return
    const apply = () => {
      const dark = settings.theme === 'dark' ||
        (settings.theme === 'system' &&
          window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    }
    apply()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [settings])

  const patchSettings = async (patch: Partial<AppSettings>) => {
    setSettings(await window.alcode.settings.set(patch as Record<string, unknown>))
  }

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void agent.send(text)
  }

  /** إرسال من خارج شاشة المحادثة: ننتقل إليها أولًا ليرى الردّ يُكتب. */
  const ask = useCallback((text: string) => {
    setTab('chat')
    void agent.send(text)
  }, [agent])

  // ------------------------------------------------------- الاختصارات
  const [palette, setPalette] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing = event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA'].includes(event.target.tagName)

      if (event.key === 'Escape') {
        setPalette(false)
        return
      }

      if (!event.ctrlKey || event.altKey) return

      // Ctrl+1..9 ينتقل بين التبويبات بترتيب الشريط الجانبي.
      const digit = Number(event.key)
      if (Number.isInteger(digit) && digit >= 1 && digit <= TABS.length) {
        event.preventDefault()
        setTab(TABS[digit - 1].id)
        return
      }

      switch (event.key.toLowerCase()) {
        case 'k':
          event.preventDefault()
          setPalette((open) => !open)
          break
        case 'n':
          event.preventDefault()
          agent.reset()
          setTab('chat')
          break
        case ',':
          event.preventDefault()
          setTab('settings')
          break
        case 'l':
          // التركيز على حقل الكتابة، كما في شريط عنوان المتصفّح.
          if (typing) break
          event.preventDefault()
          setTab('chat')
          setTimeout(() => document.getElementById('ask-field')?.focus(), 60)
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agent])

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      {/* ------------------------------------------------ الشريط الجانبي */}
      <aside
        style={{
          width: 92, padding: '16px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8,
        }}
      >
        <div
          style={{
            width: 42, height: 42, borderRadius: '50%', background: 'var(--lavender)',
            display: 'grid', placeItems: 'center', fontSize: 19, flexShrink: 0,
          }}
        >
          ✦
        </div>
        {/* التبويبات تسع تسعة، والنافذة قد تُصغَّر إلى ٦٠٠ بكسل، فنجعل
            الشريط نفسه قابلاً للتمرير بدل أن تُقصّ الأزرار الأخيرة. */}
        <nav
          className="col no-scrollbar"
          style={{
            flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex',
            flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0',
            width: '100%',
          }}
        >
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              title={item.label}
              style={{
                width: 62, minHeight: 50, borderRadius: 18, flexShrink: 0,
                background: tab === item.id ? 'var(--ink)' : 'transparent',
                color: tab === item.id ? 'var(--sand)' : 'var(--ink)',
                display: 'grid', placeItems: 'center', gap: 1,
                transition: 'all 0.16s ease',
              }}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>{item.label}</span>
            </button>
          ))}
        </nav>
        {settings && !settings.hasApiKey && (
          <button
            className="pill"
            onClick={() => setTab('settings')}
            title="أضِف المفتاح"
            style={{ background: 'var(--butter)', padding: 10, flexShrink: 0 }}
          >
            🔑
          </button>
        )}
      </aside>

      {/* ------------------------------------------------------- المحتوى */}
      <main style={{ flex: 1, minWidth: 0, padding: '18px 22px 18px 0', overflow: 'hidden' }}>
        <Use24hContext.Provider value={settings?.use24h ?? true}>
        <TimeZoneContext.Provider value={settings?.place?.timezone}>
        {tab === 'chat' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <header className="row" style={{ marginBottom: 14 }}>
              <div className="grow">
                <h1 className="h1">
                  {settings?.userName ? `شو في بالك، ${settings.userName}؟` : 'شو في بالك؟'}
                </h1>
                <p className="muted small" style={{ margin: 0 }}>
                  {toolCount} أداة على جهازك · يشوف شاشتك · يبحث في الإنترنت
                  {platform && !platform.windows && ' · (أدوات ويندوز معطّلة خارج ويندوز)'}
                </p>
              </div>
              <button className="pill" onClick={agent.reset}>محادثة جديدة</button>
            </header>

            <div
              ref={scrollRef}
              className="card grow"
              style={{ overflowY: 'auto', minHeight: 0 }}
            >
              {agent.messages.length === 0 ? (
                <div
                  style={{
                    height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>✨</div>
                    <div className="h2" style={{ marginBottom: 6 }}>كيف أساعدك؟</div>
                    <p className="muted small" style={{ maxWidth: 380, margin: '0 auto 18px' }}>
                      اطلب أي شي على جهازك — أفتح، أرتّب، أبحث، أشوف الشاشة، وأنفّذ.
                    </p>
                    <div
                      className="row wrap"
                      style={{ justifyContent: 'center', gap: 8, maxWidth: 520 }}
                    >
                      {SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          className="chip"
                          onClick={() => void agent.send(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {agent.messages.map((message) => (
                    <Bubble key={message.id} message={message} />
                  ))}
                  {agent.status && <Thinking label={agent.status} />}
                </>
              )}
            </div>

            {agent.error && (
              <div
                className="small"
                style={{
                  color: 'var(--danger)', background: 'var(--rose)',
                  borderRadius: 14, padding: '9px 14px', marginTop: 10,
                }}
              >
                {agent.error}
              </div>
            )}

            <div
              className="row"
              style={{
                marginTop: 12, background: 'var(--surface)', borderRadius: 999,
                boxShadow: 'var(--shadow)', padding: '6px 6px 6px 18px', gap: 10,
              }}
            >
              <input
                id="ask-field"
                className="grow"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit() }}
                placeholder="اكتب أمرك…"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 15, padding: '10px 0',
                }}
              />
              {agent.streaming ? (
                <button className="pill" onClick={agent.stop}>إيقاف</button>
              ) : (
                <button className="pill active" onClick={submit} disabled={!input.trim()}>
                  إرسال
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'home' && (
          <HomeTab
            onGo={(next) => setTab(next as Tab)}
            onAsk={ask}
            userName={settings?.userName ?? ''}
          />
        )}
        {tab === 'day' && <DayTab />}
        {tab === 'prayer' && <PrayerTab />}
        {tab === 'weather' && <WeatherTab />}
        {tab === 'news' && <NewsTab />}
        {tab === 'skills' && <SkillsTab />}
        {tab === 'memory' && <MemoryTab />}
        {tab === 'settings' && settings && (
          <SettingsTab
            settings={settings}
            onPatch={patchSettings}
            onRefresh={refreshSettings}
            version={platform?.version ?? ''}
          />
        )}
        </TimeZoneContext.Provider>
        </Use24hContext.Provider>
      </main>

      {palette && (
        <CommandPalette
          tabs={TABS}
          onClose={() => setPalette(false)}
          onGo={(next) => { setTab(next); setPalette(false) }}
          onAsk={(text) => { ask(text); setPalette(false) }}
        />
      )}

      {agent.confirmRequest && (
        <ConfirmDialog request={agent.confirmRequest} onAnswer={agent.answerConfirm} />
      )}
    </div>
  )
}

// ------------------------------------------------------------- القدرات

const DANGER_LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  safe: { text: 'آمن', bg: 'var(--mint)', fg: 'var(--mint-ink)' },
  confirm: { text: 'يؤكَّد', bg: 'var(--butter)', fg: 'var(--butter-ink)' },
  high: { text: 'خطر', bg: 'var(--rose)', fg: 'var(--rose-ink)' },
}

function SkillsTab() {
  const [groups, setGroups] = useState<
    { group: string; tools: { name: string; description: string; danger: string }[] }[]
  >([])

  useEffect(() => { void window.alcode.tools.list().then(setGroups) }, [])

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <h1 className="h1" style={{ marginBottom: 4 }}>القدرات</h1>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 20 }}>
        كل ما يستطيع المساعد فعله على هذا الجهاز. الأوامر الخطرة تُعرض عليك
        قبل تنفيذها دائمًا، مهما كانت الإعدادات.
      </p>
      {groups.map((group) => (
        <Section key={group.group} title={`${group.group} (${group.tools.length})`}>
          <div className="card" style={{ padding: 8 }}>
            {group.tools.map((tool) => {
              const danger = DANGER_LABEL[tool.danger] ?? DANGER_LABEL.safe
              return (
                <div
                  key={tool.name}
                  style={{ padding: '10px 12px', borderRadius: 16 }}
                >
                  <div className="row" style={{ gap: 8, marginBottom: 2 }}>
                    <code
                      style={{
                        direction: 'ltr', fontSize: 12, fontWeight: 700,
                        background: 'var(--surface-high)', padding: '2px 8px', borderRadius: 8,
                      }}
                    >
                      {tool.name}
                    </code>
                    <span
                      className="small"
                      style={{
                        background: danger.bg, color: danger.fg,
                        borderRadius: 999, padding: '1px 9px', fontWeight: 700,
                      }}
                    >
                      {danger.text}
                    </span>
                  </div>
                  <div className="muted small">{tool.description}</div>
                </div>
              )
            })}
          </div>
        </Section>
      ))}
    </div>
  )
}

// ------------------------------------------------------------- الذاكرة

function MemoryTab() {
  const [memories, setMemories] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [reminders, setReminders] = useState<any[]>([])

  const load = useCallback(async () => {
    setMemories(await window.alcode.data.get('memories'))
    setNotes(await window.alcode.data.get('notes'))
    setReminders(await window.alcode.data.get('reminders'))
  }, [])

  useEffect(() => { void load() }, [load])

  const row = (id: string, primary: string, secondary: string, remove: () => Promise<unknown>) => (
    <div key={id} className="row" style={{ padding: '10px 12px', gap: 10 }}>
      <div className="grow">
        <div>{primary}</div>
        <div className="muted small">{secondary}</div>
      </div>
      <button
        className="chip"
        onClick={async () => { await remove(); void load() }}
      >
        حذف
      </button>
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <h1 className="h1" style={{ marginBottom: 4 }}>الذاكرة</h1>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 20 }}>
        ما يتذكّره عنك بين المحادثات، وما حفظه لك. كله على جهازك وقابل للحذف.
      </p>

      <Section title={`يعرف عنك (${memories.length})`}>
        <div className="card" style={{ padding: 8 }}>
          {memories.length === 0 && (
            <div className="muted small" style={{ padding: 12 }}>
              ما حفظ شيئًا بعد. قل له «تذكّر أني أشتغل على مشروع كذا».
            </div>
          )}
          {memories.map((memory) =>
            row(
              memory.id, memory.text,
              `${memory.category} · ${new Date(memory.createdAt).toLocaleDateString('ar')}`,
              () => window.alcode.data.deleteMemory(memory.id),
            ),
          )}
        </div>
      </Section>

      <Section title={`ملاحظات (${notes.length})`}>
        <div className="card" style={{ padding: 8 }}>
          {notes.length === 0 && (
            <div className="muted small" style={{ padding: 12 }}>ما في ملاحظات.</div>
          )}
          {notes.map((note) =>
            row(
              note.id, note.title || note.body.slice(0, 60),
              note.title ? note.body.slice(0, 80) : new Date(note.createdAt).toLocaleString('ar'),
              () => window.alcode.data.deleteNote(note.id),
            ),
          )}
        </div>
      </Section>

      <Section title={`تذكيرات (${reminders.filter((r) => !r.done).length})`}>
        <div className="card" style={{ padding: 8 }}>
          {reminders.filter((r) => !r.done).length === 0 && (
            <div className="muted small" style={{ padding: 12 }}>ما في تذكيرات قادمة.</div>
          )}
          {reminders.filter((r) => !r.done).map((reminder) =>
            row(
              reminder.id, reminder.text,
              new Date(reminder.at).toLocaleString('ar', { hour12: false }),
              () => window.alcode.data.deleteReminder(reminder.id),
            ),
          )}
        </div>
      </Section>
    </div>
  )
}

// ----------------------------------------------------------- الإعدادات

const MODELS = [
  { id: 'claude-opus-5', label: 'Opus 5 — الأذكى', hint: 'للمهام المعقّدة والتخطيط' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 — متوازن', hint: 'الأفضل للاستخدام اليومي' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — الأسرع', hint: 'للأوامر المباشرة القصيرة' },
]

const DIALECTS = [
  { id: 'emirati', label: 'إماراتي' },
  { id: 'gulf', label: 'خليجي' },
  { id: 'fusha', label: 'فصحى' },
  { id: 'egyptian', label: 'مصري' },
  { id: 'levantine', label: 'شامي' },
  { id: 'english', label: 'English' },
]

const HIGH_LAT = [
  { id: 'ANGLE_BASED' as const, label: 'حسب الزاوية' },
  { id: 'MIDDLE_OF_NIGHT' as const, label: 'منتصف الليل' },
  { id: 'SEVENTH_OF_NIGHT' as const, label: 'سُبع الليل' },
]

// المفاتيح صغيرة الحرف كما في محرّك الحساب — الإزاحة تُخزَّن بها حرفيًا.
const PRAYER_KEYS = [
  { id: 'fajr', label: 'الفجر' },
  { id: 'sunrise', label: 'الشروق' },
  { id: 'dhuhr', label: 'الظهر' },
  { id: 'asr', label: 'العصر' },
  { id: 'maghrib', label: 'المغرب' },
  { id: 'isha', label: 'العشاء' },
]

const CATEGORIES = [
  { id: 'world', label: 'عالمي' },
  { id: 'gulf', label: 'الخليج' },
  { id: 'tech', label: 'تقنية' },
  { id: 'business', label: 'اقتصاد' },
  { id: 'sports', label: 'رياضة' },
  { id: 'science', label: 'علوم' },
]

function SettingsTab({ settings, onPatch, onRefresh, version }: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => Promise<void>
  onRefresh: () => Promise<void>
  version: string
}) {
  const [key, setKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [keyState, setKeyState] = useState('')
  const [usage, setUsage] = useState<any>(null)
  const [methods, setMethods] = useState<{ id: string; arabic: string }[]>([])

  useEffect(() => {
    void window.alcode.data.get('usage').then(setUsage)
    void window.alcode.daily.methods().then(setMethods)
  }, [])

  const saveKey = async () => {
    if (!key.trim()) return
    setTesting(true)
    setKeyState('')
    await window.alcode.settings.setKey(key.trim())
    const result = await window.alcode.settings.testKey()
    setTesting(false)
    setKeyState(result.ok ? '✅ المفتاح يعمل' : `⚠️ ${result.error}`)
    if (result.ok) setKey('')
    await onRefresh()
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <h1 className="h1" style={{ marginBottom: 4 }}>الإعدادات</h1>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 20 }}>
        Alcode Ai {version} · كل بياناتك على هذا الجهاز
      </p>

      <Section title="مفتاح Anthropic">
        <div className="card">
          <p className="muted small" style={{ marginTop: 0 }}>
            المفتاح يُحفظ على جهازك ولا يغادر عملية التطبيق الرئيسية —
            حتى واجهة العرض لا تراه. يُرسل حصريًا إلى api.anthropic.com.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <input
              className="field grow"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={settings.hasApiKey ? 'مضبوط ✓ — الصق مفتاحًا جديدًا لتغييره' : 'sk-ant-...'}
              style={{ direction: 'ltr' }}
            />
            <button className="btn" onClick={saveKey} disabled={testing || !key.trim()}>
              {testing ? 'أتحقّق…' : 'حفظ وتحقّق'}
            </button>
          </div>
          {keyState && <div className="small" style={{ marginTop: 8 }}>{keyState}</div>}
        </div>
      </Section>

      <Section title="المساعد">
        <div className="card col" style={{ gap: 16 }}>
          <Field label="النموذج">
            <div className="row wrap" style={{ gap: 8 }}>
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  className={settings.model === model.id ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ model: model.id })}
                  title={model.hint}
                >
                  {model.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="اللهجة">
            <div className="row wrap" style={{ gap: 8 }}>
              {DIALECTS.map((dialect) => (
                <button
                  key={dialect.id}
                  className={settings.dialect === dialect.id ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ dialect: dialect.id })}
                >
                  {dialect.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="اسمك">
            <input
              className="field"
              value={settings.userName}
              onChange={(e) => void onPatch({ userName: e.target.value })}
              placeholder="ليخاطبك به"
            />
          </Field>

          <Field label="تعليمات شخصية">
            <textarea
              className="field"
              rows={3}
              value={settings.persona}
              onChange={(e) => void onPatch({ persona: e.target.value })}
              placeholder="مثال: اختصر دائمًا، ولا تشرح إلا إذا طلبت."
            />
          </Field>

          <Toggle
            label="البحث في الإنترنت"
            hint="يجيب عن الأسعار والأخبار والأحداث بمعلومة حديثة"
            value={settings.webSearch}
            onChange={(value) => void onPatch({ webSearch: value })}
          />
        </div>
      </Section>

      <Section title="الرفيق اليومي">
        <div className="card col" style={{ gap: 18 }}>
          <PlacePicker settings={settings} onPatch={onPatch} onRefresh={onRefresh} />

          <Field label="طريقة حساب الصلاة">
            <select
              className="field"
              value={settings.prayer.methodId}
              onChange={(e) =>
                void onPatch({ prayer: { ...settings.prayer, methodId: e.target.value } })}
            >
              {methods.map((method) => (
                <option key={method.id} value={method.id}>{method.arabic}</option>
              ))}
            </select>
          </Field>

          <Field label="العصر">
            <div className="row" style={{ gap: 8 }}>
              {([1, 2] as const).map((factor) => (
                <button
                  key={factor}
                  className={settings.prayer.asrFactor === factor ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ prayer: { ...settings.prayer, asrFactor: factor } })}
                >
                  {factor === 1 ? 'الجمهور' : 'الحنفي'}
                </button>
              ))}
            </div>
          </Field>

          <Field label="خطوط العرض العالية">
            <div className="row wrap" style={{ gap: 8 }}>
              {HIGH_LAT.map((rule) => (
                <button
                  key={rule.id}
                  className={settings.prayer.highLatitudeRule === rule.id ? 'pill active' : 'pill'}
                  onClick={() =>
                    void onPatch({ prayer: { ...settings.prayer, highLatitudeRule: rule.id } })}
                >
                  {rule.label}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              تُستخدم حين لا يكتمل الظلام ليلًا، كما في شمال أوروبا صيفًا.
            </p>
          </Field>

          <Field label="تعديل الأوقات (دقائق)">
            <div className="row wrap" style={{ gap: 10 }}>
              {PRAYER_KEYS.map((prayer) => (
                <div key={prayer.id} style={{ width: 96 }}>
                  <div className="muted small" style={{ marginBottom: 4 }}>{prayer.label}</div>
                  <input
                    className="field"
                    type="number"
                    value={settings.prayer.offsets[prayer.id] ?? 0}
                    onChange={(e) => {
                      const offsets = { ...settings.prayer.offsets }
                      const value = Number(e.target.value)
                      if (!value) delete offsets[prayer.id]
                      else offsets[prayer.id] = value
                      void onPatch({ prayer: { ...settings.prayer, offsets } })
                    }}
                    style={{ direction: 'ltr', textAlign: 'center' }}
                  />
                </div>
              ))}
            </div>
          </Field>

          <Field label="تقويم أم القرى">
            <div className="row" style={{ gap: 8 }}>
              {[-2, -1, 0, 1, 2].map((offset) => (
                <button
                  key={offset}
                  className={settings.hijriOffset === offset ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ hijriOffset: offset })}
                >
                  {offset === 0 ? 'بلا تعديل' : `${offset > 0 ? '+' : ''}${offset} يوم`}
                </button>
              ))}
            </div>
          </Field>

          <Toggle
            label="نظام ٢٤ ساعة"
            hint="يطبَّق على أوقات الصلاة والطقس والتذكيرات"
            value={settings.use24h}
            onChange={(value) => void onPatch({ use24h: value })}
          />

          <Toggle
            label="تنبيه عند كل صلاة"
            hint="إشعار من ويندوز عند دخول وقت كل صلاة مفروضة"
            value={settings.prayerAlerts}
            onChange={(value) => void onPatch({ prayerAlerts: value })}
          />

          <Field label="ملخّص الصباح">
            <div className="row wrap" style={{ gap: 8 }}>
              {['', '06:00', '07:00', '08:00', '09:00'].map((time) => (
                <button
                  key={time || 'off'}
                  className={settings.morningBriefAt === time ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ morningBriefAt: time })}
                  style={{ direction: time ? 'ltr' : 'rtl' }}
                >
                  {time || 'بلا ملخّص'}
                </button>
              ))}
            </div>
            <p className="muted small" style={{ margin: '6px 0 0' }}>
              إشعار واحد فيه تاريخك وصلاتك القادمة والطقس ومهامك. إن كان الجهاز
              نائمًا وقتها وصل عند استيقاظه بدل أن يُفقَد.
            </p>
          </Field>
        </div>
      </Section>

      <Section title="الأخبار">
        <NewsSettings settings={settings} onPatch={onPatch} onRefresh={onRefresh} />
      </Section>

      <Section title="الأمان">
        <div className="card col" style={{ gap: 14 }}>
          <Toggle
            label="أكّد قبل الأوامر التي تُغيّر شيئًا"
            hint="الأوامر الخطرة (حذف، إيقاف تشغيل، PowerShell حرّ) تُؤكَّد دائمًا مهما كان هذا الإعداد"
            value={settings.confirmDanger}
            onChange={(value) => void onPatch({ confirmDanger: value })}
          />
          <p className="small muted" style={{ margin: 0 }}>
            الحذف يذهب إلى سلّة المحذوفات لا إلى العدم. مسارات ويندوز والبرامج
            محمية ولا يلمسها المساعد. ما يقرأه من الشاشة والملفات والإنترنت
            يُعامَل بيانات لا أوامر.
          </p>
        </div>
      </Section>

      <Section title="ويندوز">
        <div className="card col" style={{ gap: 16 }}>
          <Field label="اختصار الشريط السريع">
            <div className="row wrap" style={{ gap: 8 }}>
              {['Control+Space', 'Alt+Space', 'Control+Shift+Space', 'Super+Space'].map((combo) => (
                <button
                  key={combo}
                  className={settings.hotkey === combo ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ hotkey: combo })}
                  style={{ direction: 'ltr' }}
                >
                  {combo}
                </button>
              ))}
            </div>
          </Field>

          <Toggle
            label="يبدأ مع ويندوز"
            hint="يعمل في شريط المهام بلا نافذة"
            value={settings.launchAtLogin}
            onChange={(value) => void onPatch({ launchAtLogin: value })}
          />

          <Field label="المظهر">
            <div className="row" style={{ gap: 8 }}>
              {(['system', 'light', 'dark'] as const).map((mode) => (
                <button
                  key={mode}
                  className={settings.theme === mode ? 'pill active' : 'pill'}
                  onClick={() => void onPatch({ theme: mode })}
                >
                  {mode === 'system' ? 'النظام' : mode === 'light' ? 'فاتح' : 'داكن'}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Section>

      <Section title="الاختصارات">
        <div className="card">
          <div
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 8,
            }}
          >
            {SHORTCUTS.map((item) => (
              <div key={item.keys} className="row" style={{ gap: 10 }}>
                <kbd>{item.keys}</kbd>
                <span className="small grow">{item.what}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Diagnostics />

      {usage && (
        <Section title="الاستهلاك">
          <div className="card">
            <div className="row wrap" style={{ gap: 22 }}>
              <Stat label="طلبات" value={usage.requests} />
              <Stat label="رموز مُدخلة" value={usage.input} />
              <Stat label="رموز مُخرجة" value={usage.output} />
              <Stat label="من الذاكرة المؤقتة" value={usage.cached} />
            </div>
            <button
              className="chip"
              style={{ marginTop: 12 }}
              onClick={async () => {
                await window.alcode.data.resetUsage()
                setUsage(await window.alcode.data.get('usage'))
              }}
            >
              تصفير
            </button>
          </div>
        </Section>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="small" style={{ fontWeight: 700, marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}

function Toggle({ label, hint, value, onChange }: {
  label: string; hint?: string; value: boolean; onChange: (value: boolean) => void
}) {
  return (
    <div className="row" style={{ gap: 12 }}>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="muted small">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!value)}
        aria-pressed={value}
        style={{
          width: 48, height: 28, borderRadius: 999, position: 'relative',
          background: value ? 'var(--mint-ink)' : 'var(--surface-high)',
          transition: 'background 0.16s ease', flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute', top: 3, insetInlineEnd: value ? 23 : 3,
            width: 22, height: 22, borderRadius: '50%', background: '#fff',
            transition: 'inset-inline-end 0.16s ease',
          }}
        />
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700, direction: 'ltr' }}>
        {typeof value === 'number' ? value.toLocaleString('en') : value}
      </div>
      <div className="muted small">{label}</div>
    </div>
  )
}

// ------------------------------------------------- اختيار المدينة والأخبار

function PlacePicker({ settings, onPatch, onRefresh }: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateState, setLocateState] = useState('')
  const [locateDenied, setLocateDenied] = useState(false)

  /**
   * يسأل ويندوز عن الموقع. النظام هو من يعرض طلب الصلاحية، فإن رُفض
   * نقول ذلك ونفتح صفحة الخصوصية بدل أن نتركه يبحث عنها.
   */
  const detect = async () => {
    setLocating(true)
    setLocateState('أسأل ويندوز عن موقعك…')
    setLocateDenied(false)
    const result = await window.alcode.daily.detectPlace(false)
    setLocating(false)
    if (result.ok) {
      setLocateState(`✅ ${result.place.name}`)
      await onRefresh()
      return
    }
    setLocateDenied(result.status === 'denied')
    setLocateState(`⚠️ ${result.message}`)
  }

  // بحث متأخّر: ما نطلب من الخادم على كل حرف، بل بعد سكون ثلث ثانية.
  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const timer = setTimeout(async () => {
      const found = await window.alcode.daily.searchPlaces(text)
      if (!cancelled) { setResults(found); setSearching(false) }
    }, 320)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const place = settings.place

  return (
    <Field label="مدينتك">
      {place && (
        <div
          className="row"
          style={{
            gap: 10, background: 'var(--surface-high)', borderRadius: 16,
            padding: '10px 14px', marginBottom: 10,
          }}
        >
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{place.name}</div>
            <div className="muted small">
              {[place.admin, place.country].filter(Boolean).join(' · ')} · {place.timezone}
            </div>
          </div>
          <button className="chip" onClick={() => void onPatch({ place: null })}>إزالة</button>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <input
          className="field grow"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={place ? 'ابحث لتغيير المدينة…' : 'اكتب اسم مدينتك… (دبي، الرياض، لندن)'}
        />
        <button className="btn ghost" onClick={() => void detect()} disabled={locating}>
          {locating ? 'لحظة…' : '📡 موقعي'}
        </button>
      </div>
      {locateState && (
        <div className="small" style={{ marginTop: 8 }}>
          {locateState}
          {locateDenied && (
            <button
              className="chip"
              style={{ marginInlineStart: 8 }}
              onClick={() => window.alcode.daily.openLocationSettings()}
            >
              افتح صلاحية الموقع في ويندوز
            </button>
          )}
        </div>
      )}
      {searching && <div className="muted small" style={{ marginTop: 6 }}>أبحث…</div>}
      {results.length > 0 && (
        <div className="col" style={{ gap: 4, marginTop: 8 }}>
          {results.map((item) => (
            <button
              key={`${item.latitude},${item.longitude}`}
              onClick={async () => {
                await onPatch({ place: item })
                setQuery('')
                setResults([])
              }}
              style={{
                textAlign: 'start', padding: '9px 14px', borderRadius: 14,
                background: 'var(--surface-high)',
              }}
            >
              <div style={{ fontWeight: 600 }}>{item.name}</div>
              <div className="muted small">
                {[item.admin, item.country].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
      )}
      {!place && (
        <p className="muted small" style={{ margin: '8px 0 0' }}>
          بدونها ما أقدر أعطيك صلاة ولا طقس — الحساب كله يتم على جهازك من
          الإحداثيات، ولا يُرسل اسمك ولا مفتاحك لأي خدمة.
        </p>
      )}
    </Field>
  )
}

function NewsSettings({ settings, onPatch, onRefresh }: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => Promise<void>
  onRefresh: () => Promise<void>
}) {
  const [sources, setSources] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('world')
  const [topic, setTopic] = useState('')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setSources(await window.alcode.daily.sources())
  }, [])

  useEffect(() => { void load() }, [load])

  const addSource = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setBusy(true)
    setState('')
    const result = await window.alcode.daily.addSource(trimmed, category)
    setBusy(false)
    setState(result.ok ? `✅ ${result.name} — ${result.count} خبر` : `⚠️ ${result.error}`)
    if (result.ok) setUrl('')
    await load()
  }

  const enabled = sources.filter((source) => source.enabled).length

  return (
    <div className="card col" style={{ gap: 18 }}>
      <Field label={`المصادر (${enabled} من ${sources.length})`}>
        <div className="col" style={{ gap: 4 }}>
          {sources.map((source) => (
            <div
              key={source.id}
              className="row"
              style={{ gap: 10, padding: '7px 12px', borderRadius: 14 }}
            >
              <div className="grow">
                <div style={{ fontWeight: 600 }}>{source.name}</div>
                <div className="muted small" style={{ direction: 'ltr' }}>{source.url}</div>
              </div>
              <span className="chip">
                {CATEGORIES.find((item) => item.id === source.category)?.label ?? source.category}
              </span>
              <button
                className={source.enabled ? 'pill active' : 'pill'}
                onClick={async () => {
                  await window.alcode.daily.toggleSource(source.id, !source.enabled)
                  await load()
                }}
              >
                {source.enabled ? 'مفعّل' : 'موقوف'}
              </button>
              {source.custom && (
                <button
                  className="chip"
                  onClick={async () => {
                    await window.alcode.daily.removeSource(source.id)
                    await load()
                  }}
                >
                  حذف
                </button>
              )}
            </div>
          ))}
        </div>
      </Field>

      <Field label="أضِف مصدرًا (RSS)">
        <div className="row wrap" style={{ gap: 8 }}>
          <input
            className="field grow"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            style={{ direction: 'ltr' }}
          />
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: 130 }}
          >
            {CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <button className="btn" onClick={addSource} disabled={busy || !url.trim()}>
            {busy ? 'أتحقّق…' : 'إضافة'}
          </button>
        </div>
        {state && <div className="small" style={{ marginTop: 8 }}>{state}</div>}
      </Field>

      <Field label={`مواضيع تتابعها (${settings.topics.length})`}>
        <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
          {settings.topics.map((item) => (
            <button
              key={item}
              className="chip"
              title="اضغط للحذف"
              onClick={async () => {
                await window.alcode.daily.removeTopic(item)
                await onRefresh()
                await load()
              }}
            >
              {item} ✕
            </button>
          ))}
          {settings.topics.length === 0 && (
            <span className="muted small">مثلًا: «الذكاء الاصطناعي» أو «أسعار الذهب».</span>
          )}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="field grow"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addTopic() }}
            placeholder="اكتب موضوعًا واضغط Enter"
          />
          <button className="btn" onClick={() => void addTopic()} disabled={!topic.trim()}>
            متابعة
          </button>
        </div>
      </Field>

      <Field label="تحديث الأخبار كل">
        <div className="row wrap" style={{ gap: 8 }}>
          {[15, 30, 60, 180].map((minutes) => (
            <button
              key={minutes}
              className={settings.newsRefreshMinutes === minutes ? 'pill active' : 'pill'}
              onClick={() => void onPatch({ newsRefreshMinutes: minutes })}
            >
              {minutes < 60 ? `${minutes} دقيقة` : `${minutes / 60} ساعة`}
            </button>
          ))}
        </div>
      </Field>
    </div>
  )

  async function addTopic() {
    const trimmed = topic.trim()
    if (!trimmed || settings.topics.includes(trimmed)) return
    // المعالج في العملية الرئيسية يحفظ الموضوع بنفسه، فنكتفي بإعادة القراءة.
    await window.alcode.daily.addTopic(trimmed)
    await onRefresh()
    setTopic('')
    await load()
  }
}

// ------------------------------------------------------- لوحة الأوامر

/**
 * Ctrl+K: مكان واحد للوصول إلى كل شيء — تنقّل، أوامر جاهزة، أو سؤال حرّ
 * يُرسَل للمساعد كما هو. يوفّر على المستخدم تذكّر أي تبويب فيه ماذا.
 */
const PALETTE_ACTIONS = [
  { icon: '🧹', label: 'رتّب مجلد التنزيلات', ask: 'رتّب مجلد التنزيلات' },
  { icon: '👁️', label: 'اقرأ ما في الشاشة', ask: 'شو في الشاشة؟' },
  { icon: '📊', label: 'حالة الجهاز', ask: 'شو حالة الجهاز؟' },
  { icon: '💽', label: 'أكبر الملفات على القرص', ask: 'وين راحت مساحة القرص؟' },
  { icon: '🪟', label: 'صغّر كل النوافذ', ask: 'صغّر كل النوافذ' },
  { icon: '🔇', label: 'اكتم الصوت', ask: 'اكتم الصوت' },
  { icon: '🕌', label: 'كم باقي على الصلاة القادمة؟', ask: 'كم باقي على الصلاة القادمة؟' },
  { icon: '⛅', label: 'كيف الجو بكرة؟', ask: 'كيف الجو بكرة؟' },
  { icon: '📰', label: 'لخّص لي أخبار اليوم', ask: 'لخّص لي أهم أخبار اليوم' },
]

function CommandPalette({ tabs, onClose, onGo, onAsk }: {
  tabs: { id: Tab; label: string; icon: string }[]
  onClose: () => void
  onGo: (tab: Tab) => void
  onAsk: (text: string) => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const trimmed = query.trim()
  const match = (text: string) => text.toLowerCase().includes(trimmed.toLowerCase())

  type Row = { key: string; icon: string; label: string; hint: string; run: () => void }
  const rows: Row[] = [
    ...tabs
      .filter((tab) => !trimmed || match(tab.label))
      .map((tab, index) => ({
        key: `tab:${tab.id}`,
        icon: tab.icon,
        label: tab.label,
        hint: `Ctrl+${index + 1}`,
        run: () => onGo(tab.id),
      })),
    ...PALETTE_ACTIONS
      .filter((action) => !trimmed || match(action.label))
      .map((action) => ({
        key: `ask:${action.label}`,
        icon: action.icon,
        label: action.label,
        hint: 'للمساعد',
        run: () => onAsk(action.ask),
      })),
  ]

  // أي نصّ لا يطابق شيئًا يبقى سؤالًا صالحًا: نرسله كما هو بدل «لا نتائج».
  if (trimmed && rows.length === 0) {
    rows.push({
      key: 'free',
      icon: '✨',
      label: `اسأل: «${trimmed}»`,
      hint: 'Enter',
      run: () => onAsk(trimmed),
    })
  }

  const safeCursor = Math.min(cursor, Math.max(0, rows.length - 1))

  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="card sheet"
        onClick={(event) => event.stopPropagation()}
        style={{ width: 'min(620px, 92vw)', padding: 10, boxShadow: 'var(--shadow-lg)' }}
      >
        <input
          autoFocus
          className="field"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setCursor(0) }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setCursor((c) => Math.min(c + 1, rows.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              rows[safeCursor]?.run()
            }
          }}
          placeholder="انتقل، أو اطلب شيئًا…"
          style={{ background: 'transparent', fontSize: 16, padding: '12px 14px' }}
        />
        <hr className="divider" />
        <div style={{ maxHeight: '48vh', overflowY: 'auto', padding: 4 }}>
          {rows.map((row, index) => (
            <button
              key={row.key}
              onMouseEnter={() => setCursor(index)}
              onClick={row.run}
              className="row"
              style={{
                width: '100%', gap: 12, padding: '10px 12px', borderRadius: 14,
                textAlign: 'start',
                background: index === safeCursor ? 'var(--surface-high)' : 'transparent',
              }}
            >
              <span style={{ fontSize: 16 }}>{row.icon}</span>
              <span className="grow">{row.label}</span>
              <kbd>{row.hint}</kbd>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ التشخيص

const SHORTCUTS = [
  { keys: 'Ctrl + Space', what: 'الشريط السريع من أي مكان في ويندوز' },
  { keys: 'Ctrl + K', what: 'لوحة الأوامر: تنقّل أو اطلب' },
  { keys: 'Ctrl + 1…9', what: 'الانتقال إلى تبويب بالترتيب' },
  { keys: 'Ctrl + N', what: 'محادثة جديدة' },
  { keys: 'Ctrl + L', what: 'التركيز على حقل الكتابة' },
  { keys: 'Ctrl + ,', what: 'الإعدادات' },
  { keys: 'Esc', what: 'إغلاق لوحة الأوامر أو الشريط السريع' },
]

/**
 * شاشة التشخيص.
 *
 * وُجدت لأن المستخدم واجه «التطبيق ما يفتح» بلا أي رسالة: كانت الواجهة تنهار
 * قبل أول رسم فلا تظهر النافذة أبدًا. الآن كل خطوة إقلاع تُسجَّل، وهذه الشاشة
 * تعرض السجل وتفتح مجلده — فيصير التشخيص ممكنًا بدل التخمين.
 */
function Diagnostics() {
  const [info, setInfo] = useState<{
    path: string; tail: string; version: string; electron: string; platform: string
  } | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => setInfo(await window.alcode.diag.log()), [])

  useEffect(() => { void load() }, [load])

  if (!info) return null

  return (
    <Section title="التشخيص">
      <div className="card col" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 18 }}>
          <Stat label="الإصدار" value={info.version} />
          <Stat label="Electron" value={info.electron} />
          <Stat label="النظام" value={info.platform} />
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          كل خطوة إقلاع تُسجَّل هنا. إن لم يفتح التطبيق يومًا، هذا الملف يقول
          أين وقف بالضبط.
        </p>
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="chip" onClick={() => setOpen((value) => !value)}>
            {open ? 'إخفاء السجل' : 'اعرض السجل'}
          </button>
          <button className="chip" onClick={() => window.alcode.diag.openLog()}>
            افتح مجلد السجل
          </button>
          <button className="chip" onClick={() => void load()}>تحديث</button>
        </div>
        {open && (
          <pre
            className="small"
            style={{
              background: 'var(--surface-high)', borderRadius: 14, padding: 12,
              maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', margin: 0,
            }}
          >
            {info.tail || 'السجل فارغ.'}
          </pre>
        )}
      </div>
    </Section>
  )
}
