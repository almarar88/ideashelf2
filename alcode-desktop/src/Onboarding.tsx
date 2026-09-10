import { useEffect, useState } from 'react'
import { AppSettings, Place } from './types'

/**
 * تهيئة أول تشغيل.
 *
 * بدونها يفتح المستخدم تطبيقًا يطلب منه مدينة ولهجة ومفتاحًا موزّعة على شاشات
 * لا يعرف مكانها، فيغلق قبل أن يرى ما يفعله. أربع خطوات قصيرة، وكل واحدة
 * قابلة للتخطّي — من يريد الدخول فورًا لا يُحبَس.
 */

const DIALECTS = [
  { id: 'emirati', label: 'إماراتي' },
  { id: 'gulf', label: 'خليجي' },
  { id: 'fusha', label: 'فصحى' },
  { id: 'egyptian', label: 'مصري' },
  { id: 'levantine', label: 'شامي' },
  { id: 'english', label: 'English' },
]

export default function Onboarding({ settings, onPatch, onDone }: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => Promise<void>
  onDone: () => void
}) {
  const [step, setStep] = useState(0)
  const steps = ['أهلًا', 'اسمك', 'مدينتك', 'لهجتك', 'مفتاحك']

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 80, background: 'var(--sand)',
        display: 'grid', placeItems: 'center', padding: 24, overflowY: 'auto',
      }}
    >
      <div className="card sheet" style={{ width: 'min(620px, 94vw)', padding: 30 }}>
        {/* مؤشّر التقدّم يقول للمستخدم كم بقي — الخطوات المجهولة العدد تُتعب. */}
        <div className="row" style={{ gap: 6, marginBottom: 22 }}>
          {steps.map((label, index) => (
            <div
              key={label}
              className="grow"
              style={{
                height: 4, borderRadius: 999,
                background: index <= step ? 'var(--ink)' : 'var(--surface-high)',
                transition: 'background 0.2s ease',
              }}
            />
          ))}
        </div>

        {step === 0 && (
          <Step
            emoji="✦"
            title="أهلًا بك في Alcode Ai"
            body={
              <>
                <p style={{ marginTop: 0 }}>
                  رفيقك اليومي على ويندوز: الصلاة والطقس والأخبار ومهامك — كلها
                  <strong> مجّانية للأبد</strong> وتعمل بلا إنترنت وبلا حساب.
                </p>
                <p>
                  ومعها مساعد <strong>ينفّذ</strong> على جهازك بدل أن يشرح لك
                  الخطوات: يفتح، يرتّب، يبحث، ويقرأ شاشتك. جرّبه ١٤ يومًا.
                </p>
              </>
            }
          />
        )}

        {step === 1 && (
          <Step
            emoji="👋"
            title="بماذا أناديك؟"
            body={
              <>
                <input
                  autoFocus
                  className="field"
                  value={settings.userName}
                  onChange={(event) => void onPatch({ userName: event.target.value })}
                  placeholder="اسمك"
                  onKeyDown={(event) => { if (event.key === 'Enter') setStep(2) }}
                />
                <p className="muted small">يبقى على جهازك ولا يُرسل لأي جهة.</p>
              </>
            }
          />
        )}

        {step === 2 && (
          <Step
            emoji="📍"
            title="وين أنت؟"
            body={<CityStep settings={settings} onPatch={onPatch} />}
          />
        )}

        {step === 3 && (
          <Step
            emoji="💬"
            title="بأي لهجة أكلّمك؟"
            body={
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
            }
          />
        )}

        {step === 4 && <ApiKeyStep hasKey={settings.hasApiKey} />}

        <div className="row" style={{ marginTop: 26, gap: 10 }}>
          {step > 0 && (
            <button className="pill" onClick={() => setStep(step - 1)}>رجوع</button>
          )}
          <div className="grow" />
          {step < steps.length - 1 ? (
            <>
              <button className="chip" onClick={onDone}>تخطّي الكل</button>
              <button className="btn" onClick={() => setStep(step + 1)}>التالي</button>
            </>
          ) : (
            <button className="btn" onClick={onDone}>ابدأ</button>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ emoji, title, body }: {
  emoji: string; title: string; body: React.ReactNode
}) {
  return (
    <div>
      <div style={{ fontSize: 40, marginBottom: 10 }}>{emoji}</div>
      <h1 className="h1" style={{ fontSize: 26, marginBottom: 12 }}>{title}</h1>
      <div style={{ lineHeight: 1.8 }}>{body}</div>
    </div>
  )
}

function CityStep({ settings, onPatch }: {
  settings: AppSettings
  onPatch: (patch: Partial<AppSettings>) => Promise<void>
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) { setResults([]); return }
    let cancelled = false
    const timer = setTimeout(async () => {
      const found = await window.alcode.daily.searchPlaces(text)
      if (!cancelled) setResults(found)
    }, 320)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  const detect = async () => {
    setBusy(true)
    setState('أسأل ويندوز عن موقعك…')
    const result = await window.alcode.daily.detectPlace(false)
    setBusy(false)
    setState(result.ok ? `✅ ${result.place.name}` : `⚠️ ${result.message}`)
    if (result.ok) await onPatch({ place: result.place })
  }

  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        الصلاة والطقس يحتاجان موقعك. الحساب فلكي على جهازك، وموقعك لا يُرسل لأحد.
      </p>
      {settings.place && (
        <div
          className="row"
          style={{ gap: 10, background: 'var(--mint)', borderRadius: 16, padding: '10px 14px', marginBottom: 10 }}
        >
          <span>📍</span>
          <span className="grow" style={{ fontWeight: 700 }}>{settings.place.name}</span>
        </div>
      )}
      <div className="row" style={{ gap: 8 }}>
        <input
          className="field grow"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="اكتب اسم مدينتك…"
        />
        <button className="btn ghost" onClick={() => void detect()} disabled={busy}>
          📡 موقعي
        </button>
      </div>
      {state && <div className="small" style={{ marginTop: 8 }}>{state}</div>}
      <div className="col" style={{ gap: 4, marginTop: 8 }}>
        {results.map((place) => (
          <button
            key={`${place.latitude},${place.longitude}`}
            onClick={async () => {
              await onPatch({ place })
              setQuery('')
              setResults([])
            }}
            style={{ textAlign: 'start', padding: '9px 14px', borderRadius: 14, background: 'var(--surface-high)' }}
          >
            <div style={{ fontWeight: 600 }}>{place.name}</div>
            <div className="muted small">
              {[place.admin, place.country].filter(Boolean).join(' · ')}
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function ApiKeyStep({ hasKey }: { hasKey: boolean }) {
  const [key, setKey] = useState('')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!key.trim()) return
    setBusy(true)
    setState('')
    await window.alcode.settings.setKey(key.trim())
    const result = await window.alcode.settings.testKey()
    setBusy(false)
    setState(result.ok ? '✅ المفتاح يعمل' : `⚠️ ${result.error}`)
    if (result.ok) setKey('')
  }

  return (
    <Step
      emoji="🔑"
      title="مفتاح المساعد"
      body={
        <>
          <p style={{ marginTop: 0 }}>
            المساعد يعمل بمفتاح Anthropic الخاصّ بك: تدفع للنموذج مباشرةً بسعر
            التكلفة، ولا يمرّ شيء من محادثاتك بنا. المفتاح لا يغادر جهازك.
          </p>
          <p className="muted small">
            ما عندك مفتاح؟ تخطَّ هذه الخطوة — الرفيق اليومي كله يعمل بدونه،
            وتضيفه متى شئت من الإعدادات.
          </p>
          <div className="row" style={{ gap: 8, marginTop: 12 }}>
            <input
              className="field grow"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={hasKey ? 'مضبوط ✓' : 'sk-ant-...'}
              style={{ direction: 'ltr' }}
            />
            <button className="btn" onClick={save} disabled={busy || !key.trim()}>
              {busy ? 'أتحقّق…' : 'حفظ'}
            </button>
          </div>
          {state && <div className="small" style={{ marginTop: 8 }}>{state}</div>}
          <button
            className="chip"
            style={{ marginTop: 12 }}
            onClick={() => window.alcode.daily.openExternal('https://console.anthropic.com/settings/keys')}
          >
            من وين أجيب مفتاحًا؟ ↗
          </button>
        </>
      }
    />
  )
}
