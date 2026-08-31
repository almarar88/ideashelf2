import { useEffect, useState } from 'react'
import type { CleanHistoryEntry } from '../../shared/types'
import { formatBytes, formatDate } from '../lib/format'
import { categoryTitleById } from '../lib/labels'
import { useToast } from '../lib/toastContext'

export function History(): JSX.Element {
  const { showToast } = useToast()
  const [entries, setEntries] = useState<CleanHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setEntries(await window.api.history.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const totalFreed = entries.reduce((sum, e) => sum + e.freedBytes, 0)

  async function clear(): Promise<void> {
    const confirmed = await window.api.dialogs.confirm('مسح سجل التنظيف بالكامل؟')
    if (!confirmed) return
    await window.api.history.clear()
    showToast('مُسح السجل')
    load()
  }

  return (
    <div className="page">
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card card-pad stat-tile">
          <span className="label">إجمالي ما حُرِّر</span>
          <span className="value">{formatBytes(totalFreed)}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">عدد عمليات التنظيف</span>
          <span className="value">{entries.length}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">آخر تنظيف</span>
          <span className="value" style={{ fontSize: 16 }}>
            {entries[0] ? formatDate(entries[0].timestamp) : '—'}
          </span>
        </div>
      </div>

      <div className="toolbar">
        <span className="muted">{loading ? 'جارٍ التحميل…' : 'سجل عمليات التنظيف السابقة'}</span>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={clear} disabled={entries.length === 0}>
          مسح السجل
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🧾</div>
          <div>لم تُنفَّذ أي عملية تنظيف بعد</div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>المساحة المحرَّرة</th>
                <th>الفئات</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.timestamp}-${i}`}>
                  <td>{formatDate(e.timestamp)}</td>
                  <td style={{ fontWeight: 600 }}>{formatBytes(e.freedBytes)}</td>
                  <td className="muted" style={{ fontSize: 12.5 }}>
                    {e.categories.map(categoryTitleById).join('، ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
