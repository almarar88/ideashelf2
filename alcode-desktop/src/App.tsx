import { useCallback, useEffect, useState } from 'react'
import { Bubble, ConfirmDialog, Section, Thinking, useAutoScroll } from './components'
import { useAgent } from './useAgent'
import { AppSettings } from './types'

type Tab = 'chat' | 'skills' | 'memory' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'chat', label: 'المساعد', icon: '✨' },
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
  const [tab, setTab] = useState<Tab>('chat')
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

  return (
    <div style={{ height: '100vh', display: 'flex' }}>
      {/* ------------------------------------------------ الشريط الجانبي */}
      <aside
        style={{
          width: 88, padding: '18px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 10,
        }}
      >
        <div
          style={{
            width: 46, height: 46, borderRadius: '50%', background: 'var(--lavender)',
            display: 'grid', placeItems: 'center', fontSize: 20, marginBottom: 8,
          }}
        >
          ✦
        </div>
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            title={item.label}
            style={{
              width: 52, height: 52, borderRadius: '50%',
              background: tab === item.id ? 'var(--ink)' : 'var(--surface)',
              color: tab === item.id ? 'var(--sand)' : 'var(--ink)',
              boxShadow: tab === item.id ? 'none' : 'var(--shadow)',
              fontSize: 19, transition: 'all 0.16s ease',
            }}
          >
            {item.icon}
          </button>
        ))}
        <div className="grow" />
        {settings && !settings.hasApiKey && (
          <button
            className="pill"
            onClick={() => setTab('settings')}
            title="أضِف المفتاح"
            style={{ background: 'var(--butter)', padding: 10 }}
          >
            🔑
          </button>
        )}
      </aside>

      {/* ------------------------------------------------------- المحتوى */}
      <main style={{ flex: 1, minWidth: 0, padding: '18px 22px 18px 0', overflow: 'hidden' }}>
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
      </main>

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

  useEffect(() => { void window.alcode.data.get('usage').then(setUsage) }, [])

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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value.toLocaleString('en')}</div>
      <div className="muted small">{label}</div>
    </div>
  )
}
