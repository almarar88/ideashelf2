import { useEffect, useMemo, useState } from 'react'
import type { ServiceEntry } from '../../shared/types'
import { useToast } from '../lib/toastContext'

const STATUS_LABEL: Record<ServiceEntry['status'], string> = {
  running: 'يعمل',
  stopped: 'متوقف',
  paused: 'موقوف مؤقتًا',
  unknown: 'غير معروف'
}

const START_TYPE_LABEL: Record<ServiceEntry['startType'], string> = {
  boot: 'عند الإقلاع',
  system: 'نظام',
  automatic: 'تلقائي',
  manual: 'يدوي',
  disabled: 'معطّل',
  unknown: '—'
}

export function Services(): JSX.Element {
  const { showToast } = useToast()
  const [services, setServices] = useState<ServiceEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [onlyRunning, setOnlyRunning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setServices(await window.api.svc.list())
    } catch (err) {
      showToast('تعذّر جلب الخدمات: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return services.filter((s) => {
      if (onlyRunning && s.status !== 'running') return false
      if (!q) return true
      return s.displayName.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    })
  }, [services, query, onlyRunning])

  async function control(
    service: ServiceEntry,
    action: 'start' | 'stop' | 'restart'
  ): Promise<void> {
    if (action === 'stop') {
      const confirmed = await window.api.dialogs.confirm(
        `إيقاف الخدمة "${service.displayName}"؟`,
        'إيقاف خدمات النظام قد يعطّل ميزات في ويندوز حتى إعادة تشغيلها.'
      )
      if (!confirmed) return
    }
    setBusy(service.name)
    try {
      const result = await window.api.svc.control(service.name, action)
      showToast(result.message)
      if (result.success) await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder="ابحث باسم الخدمة…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 260 }}
        />
        <label className="checkbox-row" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={onlyRunning}
            onChange={(e) => setOnlyRunning(e.target.checked)}
          />
          العاملة فقط
        </label>
        <div className="spacer" />
        <span className="muted">{loading ? 'جارٍ التحميل…' : `${visible.length} خدمة`}</span>
        <button className="btn btn-sm" onClick={load}>
          🔄 تحديث
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16, fontSize: 13 }}>
        ⚠️ تشغيل الخدمات وإيقافها يتطلب صلاحيات المدير. الخدمات جزء من عمل ويندوز الداخلي،
        فلا توقف خدمة لا تعرف وظيفتها.
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الخدمة</th>
              <th>الحالة</th>
              <th>نوع البدء</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 400).map((s) => (
              <tr key={s.name}>
                <td>
                  <div style={{ fontWeight: 600 }}>{s.displayName}</div>
                  <div className="muted" style={{ fontSize: 11.5 }}>
                    {s.name}
                  </div>
                </td>
                <td>
                  <span className={`badge ${s.status === 'running' ? 'badge-safe' : 'badge-caution'}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </td>
                <td className="muted">{START_TYPE_LABEL[s.startType]}</td>
                <td>
                  {s.status === 'running' ? (
                    <>
                      <button
                        className="btn btn-sm"
                        disabled={busy === s.name}
                        onClick={() => control(s, 'stop')}
                      >
                        إيقاف
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ marginRight: 6 }}
                        disabled={busy === s.name}
                        onClick={() => control(s, 'restart')}
                      >
                        إعادة تشغيل
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-sm"
                      disabled={busy === s.name || s.startType === 'disabled'}
                      onClick={() => control(s, 'start')}
                    >
                      تشغيل
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
