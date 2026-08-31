import { useEffect, useMemo, useState } from 'react'
import type { ProcessEntry } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'

type SortKey = 'memoryBytes' | 'cpuPercent' | 'name'

export function Processes(): JSX.Element {
  const { showToast } = useToast()
  const [processes, setProcesses] = useState<ProcessEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('memoryBytes')
  const [autoRefresh, setAutoRefresh] = useState(false)

  async function load(): Promise<void> {
    try {
      setProcesses(await window.api.proc.list())
    } catch (err) {
      showToast('تعذّر جلب العمليات: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(load, 3000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = q ? processes.filter((p) => p.name.toLowerCase().includes(q)) : processes
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name)
      return b[sortKey] - a[sortKey]
    })
  }, [processes, query, sortKey])

  const totalMemory = visible.reduce((sum, p) => sum + p.memoryBytes, 0)

  async function kill(p: ProcessEntry): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      `إنهاء العملية "${p.name}"؟`,
      'قد تفقد أي عمل غير محفوظ في هذا البرنامج. لا تُنهِ عمليات النظام إن لم تكن متأكدًا.'
    )
    if (!confirmed) return
    const result = await window.api.proc.kill(p.pid)
    showToast(result.message)
    if (result.success) load()
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder="ابحث باسم العملية…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 240 }}
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="memoryBytes">ترتيب حسب الذاكرة</option>
          <option value="cpuPercent">ترتيب حسب المعالج</option>
          <option value="name">ترتيب حسب الاسم</option>
        </select>
        <label className="checkbox-row" style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          تحديث تلقائي
        </label>
        <div className="spacer" />
        <span className="muted">
          {loading ? 'جارٍ التحميل…' : `${visible.length} عملية — ${formatBytes(totalMemory)}`}
        </span>
        <button className="btn btn-sm" onClick={load}>
          🔄 تحديث
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>المعرّف</th>
              <th>المعالج</th>
              <th>الذاكرة</th>
              <th>المستخدم</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.slice(0, 300).map((p) => (
              <tr key={p.pid}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="muted">{p.pid}</td>
                <td>{p.cpuPercent}%</td>
                <td>{formatBytes(p.memoryBytes)}</td>
                <td className="muted">{p.user || '—'}</td>
                <td>
                  <button className="btn btn-sm btn-danger" onClick={() => kill(p)}>
                    إنهاء
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
