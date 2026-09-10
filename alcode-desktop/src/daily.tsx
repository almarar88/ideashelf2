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

function useFmtTime() {
  const use24h = useContext(Use24hContext)
  return useCallback(
    (at: number) => new Intl.DateTimeFormat('ar', {
      hour: '2-digit', minute: '2-digit', hour12: !use24h,
    }).format(new Date(at)),
    [use24h],
  )
}

function remaining(at: number) {
  const minutes = Math.max(0, Math.round((at - Date.now()) / 60_000))
  const hours = Math.floor(minutes / 60)
  if (hours === 0) return `${minutes} د`
  return minutes % 60 === 0 ? `${hours} س` : `${hours} س ${minutes % 60} د`
}

// ------------------------------------------------------------ الرئيسية

export function HomeTab({ onGo }: { onGo: (tab: string) => void }) {
  const fmtTime = useFmtTime()
  const [day, setDay] = useState<any>(null)
  const [tick, setTick] = useState(Date.now())

  const load = useCallback(async () => setDay(await window.alcode.daily.day()), [])

  useEffect(() => {
    void load()
    const timer = setInterval(() => setTick(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [load])

  // إعادة الحساب كل نصف دقيقة تبقي العدّاد صادقًا بلا إعادة جلب من الشبكة.
  useMemo(() => tick, [tick])

  if (!day) return <Loading />

  const weather = day.weather
  const next = day.next

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingLeft: 6 }}>
      <header style={{ marginBottom: 18 }}>
        <h1 className="h1" style={{ marginBottom: 2 }}>يومك</h1>
        <p className="muted small" style={{ margin: 0 }}>
          {day.gregorian} · {day.hijri}
          {day.place ? ` · ${day.place}` : ''}
        </p>
      </header>

      {!day.place && (
        <div className="card" style={{ background: 'var(--butter)', marginBottom: 18 }}>
          <strong>حدّد مدينتك أولًا</strong>
          <p className="small" style={{ margin: '6px 0 12px' }}>
            أوقات الصلاة والطقس تحتاج موقعك. تُحسب الصلاة فلكيًا على جهازك بلا إنترنت.
          </p>
          <button className="btn" onClick={() => onGo('settings')}>اختر المدينة</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 14, marginBottom: 18 }}>
        {next && (
          <div className="card" style={{ background: 'var(--peach)' }}>
            <div className="small" style={{ opacity: 0.7 }}>الصلاة القادمة</div>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>{next.arabic}</div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>
              {fmtTime(next.at)} · بعد {remaining(next.at)}
            </div>
            <button
              className="pill"
              style={{ marginTop: 12, width: 'fit-content' }}
              onClick={() => onGo('prayer')}
            >
              كل المواقيت
            </button>
          </div>
        )}

        {weather && (
          <div className="card" style={{ background: 'var(--mint)' }}>
            <div className="small" style={{ opacity: 0.7 }}>الطقس الآن</div>
            <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15 }}>
              {Math.round(weather.now.temperature)}°
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {weather.daily?.[0]
                ? `اليوم ${Math.round(weather.daily[0].max)}° / ${Math.round(weather.daily[0].min)}°`
                : ''}
            </div>
            <div className="small" style={{ opacity: 0.75 }}>
              محسوسة {Math.round(weather.now.feelsLike)}° · رطوبة {weather.now.humidity}%
            </div>
            <button
              className="pill"
              style={{ marginTop: 10, width: 'fit-content' }}
              onClick={() => onGo('weather')}
            >
              تفاصيل الطقس
            </button>
          </div>
        )}
      </div>

      {day.prayers && (
        <Section title="أوقات اليوم" action={<Link onClick={() => onGo('prayer')} />}>
          <div className="row wrap" style={{ gap: 8 }}>
            {day.prayers.map((p: any, i: number) => {
              const isNext = next?.key === p.key
              return (
                <div
                  key={p.key}
                  className="card"
                  style={{
                    flex: '1 1 120px', padding: '12px 14px', textAlign: 'center',
                    background: isNext ? 'var(--ink)' : pastel(i),
                    color: isNext ? 'var(--sand)' : 'var(--ink)',
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Section title="مهامك" action={<Link onClick={() => onGo('day')} />}>
          <div className="card">
            <div className="row" style={{ gap: 20 }}>
              <Stat value={day.tasksOpen} label="مفتوحة" />
              <Stat value={day.tasksDone} label="منجزة" />
            </div>
            {day.tasksOpen === 0 && (
              <p className="muted small" style={{ marginBottom: 0 }}>
                ما في مهام مفتوحة. قل للمساعد «ذكّرني…» ليضيف واحدة.
              </p>
            )}
          </div>
        </Section>

        <Section title="أبرز العناوين" action={<Link onClick={() => onGo('news')} />}>
          <div className="card" style={{ padding: 8 }}>
            {(day.headlines ?? []).slice(0, 5).map((article: any) => (
              <button
                key={article.link}
                onClick={() => window.alcode.daily.openExternal(article.link)}
                style={{
                  display: 'block', textAlign: 'start', width: '100%',
                  padding: '8px 10px', borderRadius: 12, lineHeight: 1.5,
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{article.title}</div>
                <div className="muted small">{article.sourceName}</div>
              </button>
            ))}
            {!day.headlines?.length && (
              <p className="muted small" style={{ padding: 10, margin: 0 }}>
                لا عناوين بعد — تحقّق من الاتصال.
              </p>
            )}
          </div>
        </Section>
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

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div className="muted small">{label}</div>
    </div>
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
  const [showMonth, setShowMonth] = useState(false)
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

      {day.next && (
        <div className="card" style={{ background: 'var(--peach)', marginBottom: 16 }}>
          <div className="small" style={{ opacity: 0.7 }}>الصلاة القادمة</div>
          <div style={{ fontSize: 44, fontWeight: 700 }}>{day.next.arabic}</div>
          <div style={{ fontSize: 17, fontWeight: 600 }}>
            {fmtTime(day.next.at)} · بعد {remaining(day.next.at)}
          </div>
        </div>
      )}

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

      <div className="card" style={{ background: 'var(--mint)', marginBottom: 16 }}>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
          {Math.round(now.temperature)}°
        </div>
        <div className="row wrap" style={{ gap: 18, marginTop: 12 }}>
          <Metric label="محسوسة" value={`${Math.round(now.feelsLike)}°`} />
          <Metric label="الرطوبة" value={`${now.humidity}%`} />
          <Metric label="الرياح" value={`${Math.round(now.windSpeed)} كم/س`} />
          <Metric label="الضغط" value={`${Math.round(now.pressure)}`} />
          <Metric label="الغيوم" value={`${now.cloudCover}%`} />
        </div>
      </div>

      <Section title="الساعات القادمة">
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="row" style={{ gap: 18, minWidth: 'fit-content' }}>
            {upcoming.map((hour: any) => (
              <div key={hour.epochSeconds} style={{ textAlign: 'center', minWidth: 52 }}>
                <div className="muted small">
                  {new Intl.DateTimeFormat('ar', { hour: '2-digit', hour12: !use24h })
                    .format(new Date(hour.epochSeconds * 1000))}
                </div>
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
              <div className="grow" style={{ fontWeight: 600 }}>
                {index === 0 ? 'اليوم' : new Intl.DateTimeFormat('ar', { weekday: 'long' })
                  .format(new Date(day.epochSeconds * 1000))}
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
