import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Section } from './components'

/**
 * شاشات الرفيق اليومي: الرئيسية، الصلاة، الطقس، الأخبار، يومي.
 * نفس محتوى نسخة الهاتف، معروضًا بعرض سطح المكتب.
 */

const PASTELS = ['peach', 'mint', 'butter', 'lavender', 'rose'] as const
const pastel = (i: number) => `var(--${PASTELS[i % PASTELS.length]})`

/**
 * صيغة الساعة تتبع إعداد المستخدم. نمرّرها بسياق لا بخاصية، لأن كل شاشة
 * تعرض أوقاتًا في مواضع متفرّقة، وتمريرها يدويًا يجعل نسيان موضع أمرًا حتميًا.
 */
export const Use24hContext = createContext(true)

/**
 * منطقة المدينة المختارة.
 *
 * ضرورية لا تحسينًا: المحرّك يحسب لحظات صحيحة بتوقيت المدينة، لكن العرض بلا
 * `timeZone` يترجمها إلى منطقة الجهاز. من يضبط دبي وجهازه على توقيت آخر كان
 * يرى الفجر ٠٠:٤٤ بدل ٠٤:٤٤ — رأيتُ ذلك في لقطة اختبار على جهاز بتوقيت UTC.
 */
export const TimeZoneContext = createContext<string | undefined>(undefined)

function useFmtTime() {
  const use24h = useContext(Use24hContext)
  const timeZone = useZone()
  return useCallback(
    (at: number) => new Intl.DateTimeFormat('ar', {
      hour: '2-digit', minute: '2-digit', hour12: !use24h, timeZone,
    }).format(new Date(at)),
    [use24h, timeZone],
  )
}

/** المنطقة الصالحة للتمرير إلى Intl، أو undefined لتُستعمل منطقة الجهاز. */
function useZone(): string | undefined {
  const zone = useContext(TimeZoneContext)
  return zone && zone !== 'auto' ? zone : undefined
}

function remaining(at: number) {
  const minutes = Math.max(0, Math.round((at - Date.now()) / 60_000))
  const hours = Math.floor(minutes / 60)
  if (hours === 0) return `${minutes} د`
  return minutes % 60 === 0 ? `${hours} س` : `${hours} س ${minutes % 60} د`
}

// ------------------------------------------------------------ الرئيسية

function greeting(zone?: string): string {
  // الساعة بتوقيت المدينة: «صباح الخير» في دبي لا يتبع ساعة جهاز في لندن.
  const hour = Number(
    new Intl.DateTimeFormat('en', { hour: 'numeric', hour12: false, timeZone: zone })
      .format(new Date()),
  )
  if (hour < 5) return 'ليلة هادئة'
  if (hour < 12) return 'صباح الخير'
  if (hour < 15) return 'نهارك سعيد'
  if (hour < 18) return 'مساء الخير'
  return 'مساء النور'
}

/** أوامر جاهزة تُرسل للمساعد بنقرة واحدة. */
const QUICK_ASKS = [
  { icon: '🧹', text: 'رتّب مجلد التنزيلات' },
  { icon: '👁️', text: 'شو في الشاشة؟' },
  { icon: '💽', text: 'وين راحت مساحة القرص؟' },
  { icon: '🪟', text: 'صغّر كل النوافذ' },
  { icon: '📊', text: 'شو حالة الجهاز؟' },
  { icon: '💧', text: 'ذكّرني بعد ٢٠ دقيقة أشرب ماء' },
]

export function HomeTab({ onGo, onAsk, userName }: {
  onGo: (tab: string) => void
  onAsk: (text: string) => void
  userName: string
}) {
  const fmtTime = useFmtTime()
  const zone = useZone()
  const [day, setDay] = useState<any>(null)
  const [, setTick] = useState(Date.now())

  const load = useCallback(async () => setDay(await window.alcode.daily.day()), [])

  useEffect(() => {
    void load()
    // العدّاد يتحدّث كل نصف دقيقة بلا إعادة جلب من الشبكة.
    const timer = setInterval(() => setTick(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [load])

  if (!day) return <Loading />

  const weather = day.weather
  const next = day.next

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }} className="enter">
      <header className="row" style={{ marginBottom: 20, alignItems: 'flex-start' }}>
        <div className="grow">
          <h1 className="h1" style={{ marginBottom: 2 }}>
            {greeting(zone)}{userName ? `، ${userName}` : ''}
          </h1>
          <p className="muted small" style={{ margin: 0 }}>
            {day.gregorian} · {day.hijri}
            {day.place ? ` · ${day.place}` : ''}
          </p>
        </div>
        <button className="pill" onClick={() => void load()} title="تحديث (Ctrl+R)">
          ↻ تحديث
        </button>
      </header>

      {!day.place && <LocationCard onDone={load} onGo={onGo} />}

      {/* ------------------------------------------- البلاطات الكبيرة */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
          gap: 14,
          marginBottom: 20,
        }}
      >
        {next && (
          <button
            className="tile hover-lift"
            onClick={() => onGo('prayer')}
            style={{
              background: 'var(--peach)', color: 'var(--peach-ink)',
              textAlign: 'start', minHeight: 150,
            }}
          >
            <div className="label">الصلاة القادمة</div>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>
              {next.arabic}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{fmtTime(next.at)}</div>
            <div className="small" style={{ opacity: 0.85 }}>بعد {remaining(next.at)}</div>
          </button>
        )}

        {weather && (
          <button
            className="tile hover-lift"
            onClick={() => onGo('weather')}
            style={{
              background: 'var(--sky)', color: 'var(--sky-ink)',
              textAlign: 'start', minHeight: 150,
            }}
          >
            <div className="label">الطقس الآن</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
              <span style={{ fontSize: 34, fontWeight: 700, color: 'var(--ink)' }}>
                {Math.round(weather.now.temperature)}°
              </span>
              <span style={{ fontSize: 22 }}>{day.weatherEmoji}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{day.weatherText}</div>
            <div className="small" style={{ opacity: 0.85 }}>
              {weather.daily?.[0]
                ? `${Math.round(weather.daily[0].max)}° / ${Math.round(weather.daily[0].min)}°`
                : ''}
              {' · محسوسة '}{Math.round(weather.now.feelsLike)}°
            </div>
          </button>
        )}

        <button
          className="tile hover-lift"
          onClick={() => onGo('day')}
          style={{
            background: 'var(--mint)', color: 'var(--mint-ink)',
            textAlign: 'start', minHeight: 150,
          }}
        >
          <div className="label">مهام اليوم</div>
          <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>
            {day.tasksOpen}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {day.tasksOpen === 0 ? 'ما في شي معلّق' : 'مفتوحة'}
          </div>
          <div className="small" style={{ opacity: 0.85 }}>
            أنجزت {day.tasksDone} · عادات {day.habitsDone}/{day.habitsTotal}
          </div>
        </button>

        {day.qibla && (
          <button
            className="tile hover-lift"
            onClick={() => onGo('prayer')}
            style={{
              background: 'var(--lavender)', color: 'var(--lavender-ink)',
              textAlign: 'start', minHeight: 150,
            }}
          >
            <div className="label">القبلة</div>
            <div className="row" style={{ gap: 10 }}>
              <span
                style={{
                  fontSize: 30, display: 'inline-block',
                  transform: `rotate(${day.qibla.bearing}deg)`,
                }}
              >
                🧭
              </span>
              <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>
                {Math.round(day.qibla.bearing)}°
              </span>
            </div>
            <div className="small" style={{ opacity: 0.85 }}>
              {Math.round(day.qibla.distanceKm).toLocaleString('ar')} كم إلى الكعبة
            </div>
          </button>
        )}
      </div>

      {/* -------------------------------------------- اسأل المساعد */}
      <Section title="اسأل المساعد" action={<Link onClick={() => onGo('chat')} />}>
        <div className="row wrap" style={{ gap: 8 }}>
          {QUICK_ASKS.map((ask) => (
            <button
              key={ask.text}
              className="pill"
              onClick={() => onAsk(ask.text)}
            >
              <span style={{ marginInlineEnd: 6 }}>{ask.icon}</span>{ask.text}
            </button>
          ))}
        </div>
      </Section>

      {/* ---------------------------------------------- مواقيت اليوم */}
      {day.prayers && (
        <Section title="مواقيت اليوم" action={<Link onClick={() => onGo('prayer')} />}>
          <div className="row wrap" style={{ gap: 8 }}>
            {day.prayers.map((p: any, i: number) => {
              const isNext = next?.key === p.key
              const passed = p.at < Date.now() && !isNext
              return (
                <div
                  key={p.key}
                  className="tile plain"
                  style={{
                    flex: '1 1 118px', padding: '13px 15px', textAlign: 'center',
                    background: isNext ? 'var(--ink)' : pastel(i),
                    color: isNext ? 'var(--sand)' : 'var(--ink)',
                    opacity: passed ? 0.55 : 1,
                  }}
                >
                  <div className="small" style={{ opacity: 0.75 }}>{p.arabic}</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{fmtTime(p.at)}</div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* ------------------------------------------ المهام والعادات */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Section title="مهامك" action={<Link onClick={() => onGo('day')} />}>
          <div className="card" style={{ padding: 10 }}>
            {day.topTasks.length === 0 ? (
              <p className="muted small" style={{ padding: 10, margin: 0 }}>
                ما في مهام مفتوحة. قل للمساعد «ذكّرني…» أو أضِف واحدة من «يومي».
              </p>
            ) : (
              day.topTasks.map((task: any) => (
                <div key={task.id} className="row" style={{ gap: 10, padding: '7px 10px' }}>
                  <button
                    onClick={async () => {
                      await window.alcode.daily.saveTask({ ...task, done: true })
                      void load()
                    }}
                    title="أنجزتها"
                    style={{
                      width: 20, height: 20, borderRadius: 7, flexShrink: 0,
                      border: '2px solid var(--outline)',
                    }}
                  />
                  <span className="grow">{task.title}</span>
                  {task.dueDate && <span className="chip small">{task.dueDate}</span>}
                </div>
              ))
            )}
          </div>
        </Section>

        <Section title="عاداتك" action={<Link onClick={() => onGo('day')} />}>
          <div className="card" style={{ padding: 10 }}>
            {day.topHabits.length === 0 ? (
              <p className="muted small" style={{ padding: 10, margin: 0 }}>
                ما في عادات بعد. أضِف واحدة من «يومي» وتابع سلسلتك.
              </p>
            ) : (
              day.topHabits.map((habit: any) => (
                <div key={habit.id} style={{ padding: '7px 10px' }}>
                  <div className="row" style={{ gap: 8, marginBottom: 5 }}>
                    <span>{habit.emoji || '🔁'}</span>
                    <span className="grow">{habit.title}</span>
                    <span className="muted small">{habit.today}/{habit.target}</span>
                  </div>
                  <div className="meter">
                    <span
                      style={{
                        width: `${Math.min(100, (habit.today / Math.max(1, habit.target)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Section>
      </div>

      {/* ------------------------------------------------ العناوين */}
      <Section title="أبرز العناوين" action={<Link onClick={() => onGo('news')} />}>
        <div
          className="card"
          style={{
            padding: 8, display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2,
          }}
        >
          {(day.headlines ?? []).slice(0, 6).map((article: any) => (
            <button
              key={article.link}
              onClick={() => window.alcode.daily.openExternal(article.link)}
              style={{
                display: 'block', textAlign: 'start', width: '100%',
                padding: '9px 11px', borderRadius: 14, lineHeight: 1.55,
              }}
              className="hover-lift"
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{article.title}</div>
              <div className="muted small">{article.sourceName}</div>
            </button>
          ))}
          {!day.headlines?.length && (
            <p className="muted small" style={{ padding: 10, margin: 0 }}>
              لا عناوين بعد — تحقّق من الاتصال أو أضِف مصدرًا من الإعدادات.
            </p>
          )}
        </div>
      </Section>

      <div style={{ height: 20 }} />
    </div>
  )
}

/**
 * بطاقة الموقع: تظهر ما دامت المدينة غير محدّدة.
 *
 * زر واحد يطلب الموقع من ويندوز نفسه — وهو ما يُظهر طلب الصلاحية في النظام.
 * إن رُفض نفتح صفحة الخصوصية مباشرة بدل أن نقول «مرفوض» ونترك المستخدم يبحث.
 */
function LocationCard({ onDone, onGo }: { onDone: () => void; onGo: (tab: string) => void }) {
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(false)
  const [offerIp, setOfferIp] = useState(false)

  const detect = async (allowIp: boolean) => {
    setBusy(true)
    setState(allowIp ? 'أقدّر موقعك من الشبكة…' : 'أسأل ويندوز عن موقعك…')
    setDenied(false)
    const result = await window.alcode.daily.detectPlace(allowIp)
    setBusy(false)
    if (result.ok) {
      const how = result.source === 'ip' ? 'تقديرًا من الشبكة' : 'من خدمة ويندوز'
      setState(`✅ ${result.place.name} — ${how}`)
      onDone()
      return
    }
    setDenied(result.status === 'denied')
    setOfferIp(true)
    setState(`⚠️ ${result.message}`)
  }

  return (
    <div
      className="tile"
      style={{ background: 'var(--butter)', color: 'var(--butter-ink)', marginBottom: 20 }}
    >
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 30 }}>📍</div>
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>
            وين أنت؟
          </div>
          <p className="small" style={{ margin: '4px 0 12px', opacity: 0.9 }}>
            الصلاة والطقس يحتاجان موقعك. أوقات الصلاة تُحسب فلكيًا على جهازك
            بلا إنترنت، وموقعك لا يُرسل إلى أي جهة.
          </p>
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn" onClick={() => void detect(false)} disabled={busy}>
              {busy ? 'لحظة…' : '📡 استعمل موقعي'}
            </button>
            <button className="btn ghost" onClick={() => onGo('settings')}>
              ✍️ أكتب المدينة بنفسي
            </button>
            {denied && (
              <button
                className="btn ghost"
                onClick={() => window.alcode.daily.openLocationSettings()}
              >
                ⚙️ افتح صلاحية الموقع
              </button>
            )}
            {offerIp && !denied && (
              <button className="btn ghost" onClick={() => void detect(true)} disabled={busy}>
                🌐 قدّره من الشبكة
              </button>
            )}
          </div>
          {state && <div className="small" style={{ marginTop: 10 }}>{state}</div>}
          {offerIp && !denied && (
            <p className="small" style={{ margin: '8px 0 0', opacity: 0.8 }}>
              التقدير من الشبكة يكشف عنوان IP لخدمة خارجية ويخطئ بعشرات الكيلومترات.
              خدمة ويندوز أدقّ وأخصّ.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function Link({ onClick }: { onClick: () => void }) {
  return (
    <button className="small" style={{ color: 'var(--amber)', fontWeight: 700 }} onClick={onClick}>
      الكل
    </button>
  )
}

/** وقت صلاة بعينها من قائمة اليوم. */
function timeOf(prayers: any[], key: string): number {
  return prayers.find((p) => p.key === key)?.at ?? 0
}

/** الصلاة التي قبل الوقت المعطى — بداية القوس في العدّاد الدائري. */
function previousAt(prayers: any[], at: number): number {
  const before = prayers.filter((p) => p.at < at)
  return before.length ? before[before.length - 1].at : at - 4 * 3_600_000
}

function spanOf(from: number, to: number): string {
  const minutes = Math.max(0, Math.round((to - from) / 60_000))
  return `${Math.floor(minutes / 60)} س ${minutes % 60} د`
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 19, fontWeight: 700 }}>{value}</div>
      <div className="muted small">{label}</div>
    </div>
  )
}

/**
 * عدّاد دائري: القوس يمتلئ بما مضى من المدّة بين الصلاتين.
 * SVG خالص بلا مكتبة — دائرتان وخاصية stroke-dasharray.
 */
function Ring({ from, to }: { from: number; to: number }) {
  const total = Math.max(1, to - from)
  const done = Math.min(1, Math.max(0, (Date.now() - from) / total))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  return (
    <svg width="86" height="86" viewBox="0 0 86 86" style={{ flexShrink: 0 }}>
      <circle
        cx="43" cy="43" r={radius} fill="none"
        stroke="currentColor" strokeWidth="7" opacity="0.22"
      />
      <circle
        cx="43" cy="43" r={radius} fill="none"
        stroke="currentColor" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${circumference * done} ${circumference}`}
        transform="rotate(-90 43 43)"
      />
      <text
        x="43" y="48" textAnchor="middle"
        style={{ fontSize: 16, fontWeight: 700, fill: 'var(--ink)' }}
      >
        {Math.round(done * 100)}%
      </text>
    </svg>
  )
}

function Loading() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
      <span className="muted">لحظة…</span>
    </div>
  )
}

// -------------------------------------------------------------- الصلاة

export function PrayerTab() {
  const fmtTime = useFmtTime()
  const [day, setDay] = useState<any>(null)
  const [month, setMonth] = useState<any[]>([])
  const [showMonth, setShowMonth] = useState(true)
  const [cursor, setCursor] = useState(() => new Date())

  useEffect(() => { void window.alcode.daily.day().then(setDay) }, [])

  useEffect(() => {
    if (!showMonth) return
    void window.alcode.daily
      .prayerMonth(cursor.getFullYear(), cursor.getMonth() + 1)
      .then(setMonth)
  }, [showMonth, cursor])

  if (!day) return <Loading />
  if (!day.prayers) {
    return <Empty text="حدّد مدينتك من الإعدادات ليُحسب وقتك بدقّة." />
  }

  const shift = (delta: number) => {
    const next = new Date(cursor)
    next.setMonth(next.getMonth() + delta)
    setCursor(next)
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <h1 className="h1" style={{ marginBottom: 2 }}>الصلاة</h1>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
        {day.place} · {day.hijri} · حساب فلكي محلّي بلا إنترنت
      </p>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'minmax(260px, 1.1fr) 1fr', gap: 14,
          marginBottom: 18,
        }}
      >
        {day.next && (
          <div
            className="tile"
            style={{ background: 'var(--peach)', color: 'var(--peach-ink)' }}
          >
            <div className="row" style={{ gap: 18 }}>
              <Ring from={previousAt(day.prayers, day.next.at)} to={day.next.at} />
              <div>
                <div className="label">الصلاة القادمة</div>
                <div style={{ fontSize: 38, fontWeight: 700, lineHeight: 1.2, color: 'var(--ink)' }}>
                  {day.next.arabic}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{fmtTime(day.next.at)}</div>
                <div className="small" style={{ opacity: 0.85 }}>
                  بعد {remaining(day.next.at)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="stack">
          {day.qibla && (
            <div
              className="tile"
              style={{ background: 'var(--lavender)', color: 'var(--lavender-ink)' }}
            >
              <div className="label">القبلة</div>
              <div className="row" style={{ gap: 12 }}>
                <span
                  style={{
                    fontSize: 26, display: 'inline-block',
                    transform: `rotate(${day.qibla.bearing}deg)`,
                  }}
                >
                  🧭
                </span>
                <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
                  {Math.round(day.qibla.bearing)}°
                </span>
                <span className="small grow" style={{ opacity: 0.85 }}>
                  {Math.round(day.qibla.distanceKm).toLocaleString('ar')} كم إلى الكعبة
                </span>
              </div>
            </div>
          )}

          <div className="card" style={{ padding: 14 }}>
            <div className="row wrap" style={{ gap: 20 }}>
              <Fact label="الشروق" value={fmtTime(timeOf(day.prayers, 'sunrise'))} />
              <Fact label="الغروب" value={fmtTime(timeOf(day.prayers, 'maghrib'))} />
              <Fact
                label="طول النهار"
                value={spanOf(
                  timeOf(day.prayers, 'sunrise'),
                  timeOf(day.prayers, 'maghrib'),
                )}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="row wrap" style={{ gap: 10, marginBottom: 18 }}>
        {day.prayers.map((p: any, i: number) => (
          <div
            key={p.key}
            className="card"
            style={{ flex: '1 1 150px', textAlign: 'center', background: pastel(i) }}
          >
            <div className="small" style={{ opacity: 0.75 }}>{p.arabic}</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{fmtTime(p.at)}</div>
          </div>
        ))}
      </div>

      <button className="btn ghost" onClick={() => setShowMonth((v) => !v)}>
        {showMonth ? 'إخفاء جدول الشهر' : 'جدول الشهر كاملًا'}
      </button>

      {showMonth && (
        <div className="card" style={{ marginTop: 14, padding: 12 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="pill" onClick={() => shift(-1)}>‹ السابق</button>
            <div className="grow" style={{ textAlign: 'center', fontWeight: 700 }}>
              {new Intl.DateTimeFormat('ar', { month: 'long', year: 'numeric' }).format(cursor)}
            </div>
            <button className="pill" onClick={() => shift(1)}>التالي ›</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={cell}>اليوم</th>
                  {day.prayers.map((p: any) => <th key={p.key} style={cell}>{p.arabic}</th>)}
                </tr>
              </thead>
              <tbody>
                {month.map((row) => (
                  <tr key={row.day}>
                    <td style={{ ...cell, fontWeight: 700 }}>{row.day}</td>
                    {row.times.map((t: any) => (
                      <td key={t.key} style={cell}>{fmtTime(t.at)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const cell: React.CSSProperties = {
  padding: '6px 8px', textAlign: 'center',
  borderBottom: '1px solid var(--outline)', whiteSpace: 'nowrap',
}

// --------------------------------------------------------------- الطقس

export function WeatherTab() {
  const use24h = useContext(Use24hContext)
  const zone = useZone()
  const [bundle, setBundle] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (force = false) => {
    setBusy(true)
    setBundle(await window.alcode.daily.weather(force))
    setBusy(false)
  }, [])

  useEffect(() => { void load() }, [load])

  if (!bundle) return <Empty text="حدّد مدينتك من الإعدادات ليظهر الطقس." />

  const now = bundle.now
  const today = bundle.daily?.[0]
  const hourText = (epochSeconds: number) => new Intl.DateTimeFormat('ar', {
    hour: '2-digit', minute: '2-digit', hour12: !use24h, timeZone: zone,
  }).format(new Date(epochSeconds * 1000))
  const upcoming = (bundle.hourly ?? []).filter(
    (h: any) => h.epochSeconds * 1000 > Date.now() - 1_800_000,
  ).slice(0, 14)

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <div className="row" style={{ marginBottom: 18 }}>
        <div className="grow">
          <h1 className="h1" style={{ marginBottom: 2 }}>الطقس</h1>
          <p className="muted small" style={{ margin: 0 }}>{bundle.place.name}</p>
        </div>
        <button className="pill" onClick={() => load(true)} disabled={busy}>
          {busy ? 'أحدّث…' : 'تحديث'}
        </button>
      </div>

      <div
        className="tile"
        style={{ background: 'var(--sky)', color: 'var(--sky-ink)', marginBottom: 16 }}
      >
        <div className="row wrap" style={{ gap: 22 }}>
          <div className="row" style={{ gap: 14 }}>
            <span style={{ fontSize: 52, lineHeight: 1 }}>{today?.emoji ?? ''}</span>
            <div>
              <div style={{ fontSize: 54, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
                {Math.round(now.temperature)}°
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{today?.text ?? ''}</div>
            </div>
          </div>
          <div className="grow" />
          {today && (
            <div style={{ textAlign: 'start' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
                {Math.round(today.max)}° / {Math.round(today.min)}°
              </div>
              <div className="small" style={{ opacity: 0.85 }}>
                الأشعة فوق البنفسجية {Math.round(today.uvIndex)} · مطر{' '}
                {today.precipitationProbability}%
              </div>
            </div>
          )}
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 16 }}>
          <Metric label="محسوسة" value={`${Math.round(now.feelsLike)}°`} />
          <Metric label="الرطوبة" value={`${now.humidity}%`} />
          <Metric label="الرياح" value={`${Math.round(now.windSpeed)} كم/س`} />
          <Metric label="الضغط" value={`${Math.round(now.pressure)}`} />
          <Metric label="الغيوم" value={`${now.cloudCover}%`} />
          {today && <Metric label="الشروق" value={hourText(today.sunriseEpoch)} />}
          {today && <Metric label="الغروب" value={hourText(today.sunsetEpoch)} />}
        </div>
      </div>

      <Section title="الساعات القادمة">
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="row" style={{ gap: 18, minWidth: 'fit-content' }}>
            {upcoming.map((hour: any) => (
              <div key={hour.epochSeconds} style={{ textAlign: 'center', minWidth: 52 }}>
                <div className="muted small">
                  {new Intl.DateTimeFormat('ar', { hour: '2-digit', hour12: !use24h, timeZone: zone })
                    .format(new Date(hour.epochSeconds * 1000))}
                </div>
                <div style={{ fontSize: 17 }}>{hour.emoji}</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>
                  {Math.round(hour.temperature)}°
                </div>
                <div className="muted small">{hour.precipitationProbability}%</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section title="سبعة أيام">
        <div className="card" style={{ padding: 8 }}>
          {(bundle.daily ?? []).map((day: any, index: number) => (
            <div key={day.epochSeconds} className="row" style={{ padding: '9px 10px', gap: 12 }}>
              <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{day.emoji}</span>
              <div className="grow" style={{ fontWeight: 600 }}>
                {index === 0 ? 'اليوم' : new Intl.DateTimeFormat('ar', { weekday: 'long', timeZone: zone })
                  .format(new Date(day.epochSeconds * 1000))}
                <span className="muted small" style={{ marginInlineStart: 8 }}>{day.text}</span>
              </div>
              <div className="muted small">مطر {day.precipitationProbability}%</div>
              <div style={{ fontWeight: 700, minWidth: 80, textAlign: 'end' }}>
                {Math.round(day.max)}° / {Math.round(day.min)}°
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700 }}>{value}</div>
      <div className="small" style={{ opacity: 0.7 }}>{label}</div>
    </div>
  )
}

// -------------------------------------------------------------- الأخبار

export function NewsTab() {
  const [articles, setArticles] = useState<any[]>([])
  const [category, setCategory] = useState('الكل')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async (force = false) => {
    setBusy(true)
    setArticles(await window.alcode.daily.news(force))
    setBusy(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const categories = useMemo(
    () => ['الكل', ...new Set(articles.map((a) => a.category))],
    [articles],
  )

  const shown = articles.filter((a) => {
    if (category !== 'الكل' && a.category !== category) return false
    if (!query.trim()) return true
    const q = query.trim()
    return a.title.includes(q) || a.summary.includes(q)
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', paddingLeft: 6 }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow">
          <h1 className="h1" style={{ marginBottom: 2 }}>الأخبار</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {articles.length} خبر من مصادرك
          </p>
        </div>
        <button className="pill" onClick={() => load(true)} disabled={busy}>
          {busy ? 'أجلب…' : 'تحديث'}
        </button>
      </div>

      <input
        className="field"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحث في العناوين…"
        style={{ marginBottom: 10 }}
      />

      <div className="row wrap" style={{ gap: 7, marginBottom: 12 }}>
        {categories.map((name) => (
          <button
            key={name}
            className={category === name ? 'pill active' : 'pill'}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {shown.map((article) => (
          <button
            key={article.link}
            className="card"
            onClick={() => window.alcode.daily.openExternal(article.link)}
            style={{
              display: 'block', textAlign: 'start', width: '100%',
              marginBottom: 10, padding: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{article.title}</div>
            {article.summary && (
              <div className="muted small" style={{ marginBottom: 6 }}>
                {article.summary.slice(0, 180)}
              </div>
            )}
            <div className="small" style={{ color: 'var(--amber)', fontWeight: 600 }}>
              {article.sourceName} · {article.category}
            </div>
          </button>
        ))}
        {!shown.length && !busy && (
          <p className="muted">لا نتائج. جرّب تحديثًا أو تصنيفًا آخر.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- يومي

export function DayTab() {
  const [tasks, setTasks] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [title, setTitle] = useState('')

  const load = useCallback(async () => {
    setTasks(await window.alcode.daily.tasks())
    setHabits(await window.alcode.daily.habits())
  }, [])

  useEffect(() => { void load() }, [load])

  const add = async () => {
    const text = title.trim()
    if (!text) return
    setTitle('')
    await window.alcode.daily.saveTask({
      id: crypto.randomUUID(), title: text, note: '',
      dueDate: null, dueTime: null, priority: 1,
      done: false, createdAt: Date.now(), repeat: null,
    })
    void load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <h1 className="h1" style={{ marginBottom: 2 }}>يومي</h1>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 18 }}>
        {open.length} مهمة مفتوحة · {habits.length} عادة
      </p>

      <div className="row" style={{ gap: 8, marginBottom: 16 }}>
        <input
          className="field grow"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder="مهمة جديدة…"
        />
        <button className="btn" onClick={add} disabled={!title.trim()}>إضافة</button>
      </div>

      <Section title={`مفتوحة (${open.length})`}>
        <div className="card" style={{ padding: 8 }}>
          {!open.length && <p className="muted small" style={{ padding: 10, margin: 0 }}>
            ما في مهام مفتوحة.
          </p>}
          {open.map((task) => (
            <TaskRow key={task.id} task={task} onChange={load} />
          ))}
        </div>
      </Section>

      {habits.length > 0 && (
        <Section title="عاداتك">
          <div className="row wrap" style={{ gap: 12 }}>
            {habits.map((habit, index) => {
              const count = habit.log?.[today] ?? 0
              const percent = Math.min(100, Math.round((count / Math.max(1, habit.targetPerDay)) * 100))
              return (
                <div
                  key={habit.id}
                  className="card"
                  style={{ flex: '1 1 200px', background: pastel(index), padding: 14 }}
                >
                  <div style={{ fontWeight: 700 }}>{habit.emoji} {habit.title}</div>
                  <div className="small" style={{ opacity: 0.75 }}>
                    {count} من {habit.targetPerDay} اليوم
                  </div>
                  <div style={{
                    height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.6)',
                    marginTop: 10, overflow: 'hidden',
                  }}>
                    <div style={{ width: `${percent}%`, height: '100%', background: 'var(--ink)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {done.length > 0 && (
        <Section title={`منجزة (${done.length})`}>
          <div className="card" style={{ padding: 8 }}>
            {done.slice(0, 20).map((task) => (
              <TaskRow key={task.id} task={task} onChange={load} />
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

function TaskRow({ task, onChange }: { task: any; onChange: () => void }) {
  return (
    <div className="row" style={{ padding: '9px 10px', gap: 10 }}>
      <button
        onClick={async () => {
          await window.alcode.daily.saveTask({ ...task, done: !task.done })
          onChange()
        }}
        style={{ fontSize: 17 }}
        title={task.done ? 'إرجاع' : 'إنجاز'}
      >
        {task.done ? '✅' : '⚪'}
      </button>
      <div className="grow" style={{
        textDecoration: task.done ? 'line-through' : 'none',
        opacity: task.done ? 0.55 : 1,
      }}>
        <div>{task.title}</div>
        {(task.dueDate || task.repeat) && (
          <div className="muted small">
            {task.dueDate ?? ''} {task.dueTime ?? ''} {task.repeat ? `🔁 ${task.repeat}` : ''}
          </div>
        )}
      </div>
      <button
        className="chip"
        onClick={async () => {
          await window.alcode.daily.deleteTask(task.id)
          onChange()
        }}
      >
        حذف
      </button>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100%', textAlign: 'center' }}>
      <p className="muted" style={{ maxWidth: 340 }}>{text}</p>
    </div>
  )
}
