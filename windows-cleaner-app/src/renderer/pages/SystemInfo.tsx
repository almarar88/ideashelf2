import { useEffect, useState } from 'react'
import type { SystemSummary } from '../../shared/types'
import { formatBytes } from '../lib/format'

export function SystemInfo(): JSX.Element {
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.system
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">تعذّر جلب معلومات النظام: {error}</div>
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="page">
        <div className="empty-state">جارٍ التحميل…</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>النظام</h3>
          <InfoRow label="الجهاز" value={summary.hostname} />
          <InfoRow label="نظام التشغيل" value={summary.osName} />
          <InfoRow label="الإصدار" value={summary.osVersion} />
          <InfoRow label="مدة التشغيل" value={`${Math.floor(summary.uptimeSec / 3600)} ساعة`} />
        </div>
        <div className="card card-pad">
          <h3 style={{ marginTop: 0 }}>المعالج والذاكرة</h3>
          <InfoRow label="المعالج" value={summary.cpuModel} />
          <InfoRow label="نسبة الاستخدام" value={`${summary.cpuLoadPercent}%`} />
          <InfoRow label="الذاكرة المستخدمة" value={formatBytes(summary.usedMemBytes)} />
          <InfoRow label="إجمالي الذاكرة" value={formatBytes(summary.totalMemBytes)} />
        </div>
      </div>

      <div className="card card-pad">
        <h3 style={{ marginTop: 0 }}>الأقراص</h3>
        <table>
          <thead>
            <tr>
              <th>القرص</th>
              <th>المستخدم</th>
              <th>الحر</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {summary.disks.map((d) => (
              <tr key={d.mount}>
                <td>{d.mount}</td>
                <td>{formatBytes(d.usedBytes)}</td>
                <td>{formatBytes(d.freeBytes)}</td>
                <td>{formatBytes(d.totalBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13.5 }}>
      <span className="muted">{label}</span>
      <span>{value || '—'}</span>
    </div>
  )
}
