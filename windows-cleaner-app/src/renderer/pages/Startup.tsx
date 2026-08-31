import { useEffect, useState } from 'react'
import type { StartupItem } from '../../shared/types'
import { useToast } from '../lib/toastContext'

const LOCATION_LABEL: Record<StartupItem['location'], string> = {
  'HKCU-Run': 'المستخدم الحالي (Run)',
  'HKLM-Run': 'كل المستخدمين (Run)',
  'StartupFolder-User': 'مجلد بدء التشغيل (المستخدم)',
  'StartupFolder-Common': 'مجلد بدء التشغيل (مشترك)'
}

export function Startup(): JSX.Element {
  const { showToast } = useToast()
  const [items, setItems] = useState<StartupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load(): Promise<void> {
    setLoading(true)
    try {
      setItems(await window.api.startup.list())
    } catch (err) {
      showToast('فشل جلب برامج بدء التشغيل: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggleEnabled(item: StartupItem): Promise<void> {
    setBusyId(item.id)
    try {
      await window.api.startup.setEnabled(item, !item.enabled)
      await load()
    } catch (err) {
      showToast('فشلت العملية: ' + (err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: StartupItem): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(`حذف "${item.name}" نهائيًا من بدء التشغيل؟`)
    if (!confirmed) return
    setBusyId(item.id)
    try {
      await window.api.startup.remove(item)
      await load()
    } catch (err) {
      showToast('فشل الحذف: ' + (err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <div className="toolbar">
        <span className="muted">{loading ? 'جارٍ التحميل…' : `${items.length} عنصر`}</span>
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
              <th>الأمر / المسار</th>
              <th>الموقع</th>
              <th>الحالة</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td className="muted" style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 320 }}>
                  {item.command}
                </td>
                <td className="muted">{LOCATION_LABEL[item.location]}</td>
                <td>
                  <span className={`badge ${item.enabled ? 'badge-safe' : 'badge-caution'}`}>
                    {item.enabled ? 'مفعّل' : 'معطّل'}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-sm"
                    disabled={busyId === item.id}
                    onClick={() => toggleEnabled(item)}
                  >
                    {item.enabled ? 'تعطيل' : 'تفعيل'}
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    style={{ marginRight: 6 }}
                    disabled={busyId === item.id}
                    onClick={() => remove(item)}
                  >
                    حذف
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
