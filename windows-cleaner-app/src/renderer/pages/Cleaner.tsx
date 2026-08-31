import { useEffect, useMemo, useState } from 'react'
import type { CleanerCategory, CleanProgress } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { categoryLabel } from '../lib/labels'
import { useToast } from '../lib/toastContext'

export function Cleaner(): JSX.Element {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState<CleanerCategory[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [cleaning, setCleaning] = useState(false)
  const [progress, setProgress] = useState<Record<string, CleanProgress>>({})
  const [showConfirm, setShowConfirm] = useState(false)
  const [isAdmin, setIsAdmin] = useState(true)
  const [makeRestorePoint, setMakeRestorePoint] = useState(false)

  const scan = async (): Promise<void> => {
    setLoading(true)
    setProgress({})
    try {
      const result = await window.api.cleaner.scan()
      setCategories(result.categories)
      setSelected(new Set(result.categories.filter((c) => c.risk === 'safe' && c.sizeBytes > 0).map((c) => c.id)))
    } catch (err) {
      showToast('فشل الفحص: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    scan()
    window.api.system.isAdmin().then(setIsAdmin).catch(() => setIsAdmin(true))
    const off = window.api.cleaner.onProgress((p) => {
      setProgress((prev) => ({ ...prev, [p.categoryId]: p }))
    })
    return off
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedSizeBytes = useMemo(
    () => categories.filter((c) => selected.has(c.id)).reduce((sum, c) => sum + c.sizeBytes, 0),
    [categories, selected]
  )

  function toggle(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runClean(): Promise<void> {
    setShowConfirm(false)
    setCleaning(true)
    try {
      if (makeRestorePoint) {
        showToast('جارٍ إنشاء نقطة استعادة… قد يستغرق دقيقة')
        const rp = await window.api.history.restorePoint()
        if (!rp.success) {
          showToast('تعذّر إنشاء نقطة الاستعادة: ' + rp.message)
        }
      }
      const ids = [...selected]
      const { totalFreedBytes } = await window.api.cleaner.clean(ids)
      showToast(`تم تحرير ${formatBytes(totalFreedBytes)} من المساحة`)
      await scan()
    } catch (err) {
      showToast('حدث خطأ أثناء التنظيف: ' + (err as Error).message)
    } finally {
      setCleaning(false)
    }
  }

  const hasCautionSelected = categories.some((c) => selected.has(c.id) && c.risk === 'caution')

  // فئات محمية فيها بيانات فعلًا — لا فائدة من تنبيه المستخدم لفئات فارغة أصلًا
  const adminCategoriesWithData = categories.filter((c) => c.requiresAdmin && c.sizeBytes > 0)

  async function relaunchAsAdmin(): Promise<void> {
    const result = await window.api.system.relaunchAsAdmin()
    if (!result.started) showToast(result.message)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" onClick={scan} disabled={loading || cleaning}>
          🔄 إعادة الفحص
        </button>
        <span className="muted">
          {loading ? 'جارٍ الفحص…' : `${categories.length} فئة، الإجمالي القابل للتنظيف ${formatBytes(
            categories.reduce((s, c) => s + c.sizeBytes, 0)
          )}`}
        </span>
        <div className="spacer" />
        <div className="card-pad" style={{ padding: '6px 14px' }}>
          محدَّد: <strong>{formatBytes(selectedSizeBytes)}</strong>
        </div>
        <button
          className="btn btn-primary"
          disabled={selected.size === 0 || cleaning || loading}
          onClick={() => setShowConfirm(true)}
        >
          {cleaning ? 'جارٍ التنظيف…' : '🧹 تنظيف المحدَّد'}
        </button>
      </div>

      {!isAdmin && adminCategoriesWithData.length > 0 && (
        <div
          className="card card-pad"
          style={{ marginBottom: 16, borderRight: '3px solid var(--warning)' }}
        >
          <strong>🛡️ بعض الفئات تحتاج صلاحيات المدير</strong>
          <div className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
            الفئات التالية موجودة داخل مجلدات ويندوز المحمية، ولن يُحذف منها شيء دون رفع الصلاحيات:{' '}
            {adminCategoriesWithData.map((c) => categoryLabel(c.labelKey).title).join('، ')}.
          </div>
          <button className="btn btn-sm" onClick={relaunchAsAdmin}>
            إعادة تشغيل التطبيق كمسؤول
          </button>
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: 36 }} />
              <th>الفئة</th>
              <th>الحجم</th>
              <th>عدد الملفات</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const label = categoryLabel(cat.labelKey)
              const prog = progress[cat.id]
              return (
                <tr key={cat.id} className={cat.risk === 'caution' ? 'risk-caution-row' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(cat.id)}
                      onChange={() => toggle(cat.id)}
                      disabled={cleaning}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>
                      {label.title}{' '}
                      {cat.risk === 'caution' && <span className="badge badge-caution">انتبه</span>}{' '}
                      {cat.requiresAdmin && !isAdmin && (
                        <span className="badge badge-caution" title="يحتاج تشغيل التطبيق كمسؤول">
                          🛡️ مدير
                        </span>
                      )}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {label.desc}
                    </div>
                  </td>
                  <td>{formatBytes(cat.sizeBytes)}</td>
                  <td>{cat.fileCount.toLocaleString('ar')}</td>
                  <td>
                    {prog?.done ? (
                      prog.error ? (
                        <span className="badge badge-danger">فشل</span>
                      ) : (
                        <span className="badge badge-safe">تم تحرير {formatBytes(prog.freedBytes)}</span>
                      )
                    ) : prog ? (
                      <span className="muted">جارٍ…</span>
                    ) : cat.error ? (
                      <span className="badge badge-danger" title={cat.error}>
                        خطأ
                      </span>
                    ) : (
                      <span className="badge badge-safe">جاهز</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>تأكيد التنظيف</h3>
            <p>
              سيتم حذف <strong>{formatBytes(selectedSizeBytes)}</strong> من {selected.size} فئة بشكل
              نهائي (باستثناء سلة المحذوفات التي تُفرَّغ نهائيًا أيضًا).
            </p>
            {hasCautionSelected && (
              <p style={{ color: 'var(--warning)' }}>
                ⚠️ اخترت فئات مُعلَّمة "انتبه" — تأكد من فهم تأثيرها قبل المتابعة.
              </p>
            )}
            <label className="checkbox-row" style={{ fontSize: 13, marginTop: 10 }}>
              <input
                type="checkbox"
                checked={makeRestorePoint}
                onChange={(e) => setMakeRestorePoint(e.target.checked)}
              />
              أنشئ نقطة استعادة نظام أولًا (تحتاج صلاحيات مدير، وقد تستغرق دقيقة)
            </label>
            <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
              <div className="spacer" />
              <button className="btn" onClick={() => setShowConfirm(false)}>
                إلغاء
              </button>
              <button className="btn btn-primary" onClick={runClean}>
                تأكيد التنظيف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
