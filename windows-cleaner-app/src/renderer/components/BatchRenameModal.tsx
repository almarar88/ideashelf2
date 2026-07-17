import { useEffect, useState } from 'react'
import { useToast } from '../lib/toastContext'
import { basename } from '../lib/pathUtils'

interface Plan {
  from: string
  to: string
}

export function BatchRenameModal({
  files,
  onClose,
  onDone
}: {
  files: string[]
  onClose: () => void
  onDone: () => void
}): JSX.Element {
  const { showToast } = useToast()
  const [pattern, setPattern] = useState('%name%')
  const [startNumber, setStartNumber] = useState(1)
  const [plan, setPlan] = useState<Plan[]>([])
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    window.api.fm.batchRenamePreview(files, pattern, startNumber).then(setPlan)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pattern, startNumber])

  async function apply(): Promise<void> {
    setApplying(true)
    try {
      const applied = await window.api.fm.batchRenameApply(plan)
      showToast(`تمت إعادة تسمية ${applied.length} ملف`)
      onDone()
    } catch (err) {
      showToast('فشل بعض العمليات: ' + (err as Error).message)
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
        <h3>إعادة تسمية دفعية ({files.length} ملف)</h3>
        <p className="muted" style={{ fontSize: 12.5 }}>
          استخدم %name% للاسم الأصلي، %n% للترقيم التسلسلي، %ext% للامتداد
        </p>
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            value={startNumber}
            onChange={(e) => setStartNumber(Number(e.target.value))}
            style={{ width: 90 }}
            title="رقم البداية"
          />
        </div>
        <div className="scroll-list" style={{ maxHeight: 260 }}>
          {plan.map((p) => (
            <div key={p.from} style={{ fontSize: 12.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="muted">{basename(p.from)}</span> ← <strong>{basename(p.to)}</strong>
            </div>
          ))}
        </div>
        <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button className="btn btn-primary" disabled={applying} onClick={apply}>
            {applying ? 'جارٍ التنفيذ…' : 'تطبيق'}
          </button>
        </div>
      </div>
    </div>
  )
}
