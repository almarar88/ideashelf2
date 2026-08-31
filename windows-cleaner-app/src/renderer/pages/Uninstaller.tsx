import { useEffect, useMemo, useState } from 'react'
import type { InstalledApp, LeftoverItem } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'

export function Uninstaller(): JSX.Element {
  const { showToast } = useToast()
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [leftoverTarget, setLeftoverTarget] = useState<InstalledApp | null>(null)
  const [leftovers, setLeftovers] = useState<LeftoverItem[]>([])
  const [scanningLeftovers, setScanningLeftovers] = useState(false)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setApps(await window.api.uninstaller.list())
    } catch (err) {
      showToast('فشل جلب قائمة البرامج: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apps
    return apps.filter(
      (a) => a.name.toLowerCase().includes(q) || a.publisher.toLowerCase().includes(q)
    )
  }, [apps, query])

  async function handleUninstall(app: InstalledApp): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      `إزالة "${app.name}"؟`,
      'سيتم تشغيل أداة إزالة البرنامج الرسمية الخاصة به. قد تظهر نافذة تأكيد إضافية منها.'
    )
    if (!confirmed) return
    setBusyKey(app.key)
    try {
      const result = await window.api.uninstaller.uninstall(app)
      showToast(result.success ? `تمت إزالة ${app.name}` : `تعذّرت الإزالة: ${result.message}`)
      if (result.success) {
        await load()
        openLeftoverScan(app)
      }
    } finally {
      setBusyKey(null)
    }
  }

  async function openLeftoverScan(app: InstalledApp): Promise<void> {
    setLeftoverTarget(app)
    setLeftovers([])
    setScanningLeftovers(true)
    try {
      const result = await window.api.uninstaller.findLeftovers(app.name, app.publisher)
      setLeftovers(result)
    } finally {
      setScanningLeftovers(false)
    }
  }

  async function removeLeftover(item: LeftoverItem): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      `حذف المجلد المتبقّي؟`,
      `${item.path}\nسيُحذف نهائيًا (${formatBytes(item.sizeBytes)}).`
    )
    if (!confirmed) return
    try {
      await window.api.uninstaller.removeLeftover(item.path)
      setLeftovers((prev) => prev.filter((l) => l.path !== item.path))
      showToast('تم حذف المخلّفات')
    } catch (err) {
      showToast('فشل الحذف: ' + (err as Error).message)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <input
          type="search"
          placeholder="ابحث باسم البرنامج أو الناشر…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ width: 280 }}
        />
        <span className="muted">{loading ? 'جارٍ التحميل…' : `${filtered.length} برنامج`}</span>
        <div className="spacer" />
        <button className="btn" onClick={load} disabled={loading}>
          🔄 تحديث
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الناشر</th>
              <th>الإصدار</th>
              <th>الحجم التقديري</th>
              <th>تاريخ التثبيت</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => (
              <tr key={app.key}>
                <td style={{ fontWeight: 600 }}>{app.name}</td>
                <td className="muted">{app.publisher || '—'}</td>
                <td className="muted">{app.version || '—'}</td>
                <td>{app.estimatedSizeKb ? formatBytes(app.estimatedSizeKb * 1024) : '—'}</td>
                <td className="muted">{app.installDate || '—'}</td>
                <td>
                  <button
                    className="btn btn-sm btn-danger"
                    disabled={busyKey === app.key}
                    onClick={() => handleUninstall(app)}
                  >
                    {busyKey === app.key ? 'جارٍ…' : 'إزالة'}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ marginRight: 6 }}
                    onClick={() => openLeftoverScan(app)}
                  >
                    مخلّفات
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {leftoverTarget && (
        <div className="modal-backdrop" onClick={() => setLeftoverTarget(null)}>
          <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
            <h3>مخلّفات "{leftoverTarget.name}"</h3>
            {scanningLeftovers ? (
              <p className="muted">جارٍ البحث عن مجلدات متبقّية…</p>
            ) : leftovers.length === 0 ? (
              <p className="muted">لا توجد مخلّفات ظاهرة لهذا البرنامج.</p>
            ) : (
              <div className="scroll-list" style={{ maxHeight: 300 }}>
                {leftovers.map((item) => (
                  <div
                    key={item.path}
                    className="toolbar"
                    style={{ marginBottom: 6, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}
                  >
                    <div style={{ overflow: 'hidden' }}>
                      <div style={{ fontSize: 13, wordBreak: 'break-all' }}>{item.path}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{formatBytes(item.sizeBytes)}</div>
                    </div>
                    <div className="spacer" />
                    <button className="btn btn-sm btn-danger" onClick={() => removeLeftover(item)}>
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
              <div className="spacer" />
              <button className="btn" onClick={() => setLeftoverTarget(null)}>
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
