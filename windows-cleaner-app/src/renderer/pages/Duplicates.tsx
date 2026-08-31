import { useEffect, useState } from 'react'
import type { DuplicateGroup, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes } from '../lib/format'
import { basename } from '../lib/pathUtils'
import { useToast } from '../lib/toastContext'

export function Duplicates(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function runScan(root: string, announceEmpty = true): Promise<void> {
    setScanning(true)
    setGroups([])
    setChecked(new Set())
    setProgress(null)
    try {
      const result = await window.api.fm.findDuplicates(root, 4096)
      setGroups(result)
      if (announceEmpty && result.length === 0) showToast('لم يُعثر على ملفات مكرّرة')
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل البحث: ' + message)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    await runScan(picked)
  }

  async function cancelScan(): Promise<void> {
    await window.api.fm.cancelScan()
  }

  function toggle(p: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  function selectAllButFirst(): void {
    const next = new Set<string>()
    for (const g of groups) {
      g.files.slice(1).forEach((f) => next.add(f))
    }
    setChecked(next)
  }

  const wastedBytes = groups.reduce((sum, g) => sum + g.sizeBytes * (g.files.length - 1), 0)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      `نقل ${checked.size} ملف إلى سلة المحذوفات؟`,
      'سيتم الإبقاء على نسخة واحدة من كل مجموعة تكرار على الأقل إن لم تختر غير ذلك.'
    )
    if (!confirmed) return
    const results = await window.api.fm.delete([...checked])
    showToast(`تم حذف ${results.filter((r) => r.success).length} ملف`)
    if (folder) await runScan(folder, false)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          📂 اختر مجلدًا وابحث عن التكرارات
        </button>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {groups.length > 0 && (
          <>
            <span className="muted">هدر تقديري: {formatBytes(wastedBytes)}</span>
            <button className="btn" onClick={selectAllButFirst}>
              تحديد الكل عدا الأولى بكل مجموعة
            </button>
            <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
              حذف المحدَّد ({checked.size})
            </button>
          </>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={cancelScan} />
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🧬</div>
          <div>اختر مجلدًا لبدء البحث عن الملفات المكرّرة</div>
        </div>
      ) : (
        <div className="grid" style={{ gap: 12 }}>
          {groups.map((g) => (
            <div key={g.hash} className="card card-pad">
              <div className="muted" style={{ marginBottom: 8, fontSize: 12.5 }}>
                {g.files.length} نسخ × {formatBytes(g.sizeBytes)}
              </div>
              {g.files.map((f) => (
                <div key={f} className="checkbox-row" style={{ marginBottom: 4 }}>
                  <input type="checkbox" checked={checked.has(f)} onChange={() => toggle(f)} />
                  <span style={{ fontSize: 13 }}>{basename(f)}</span>
                  <span className="muted" style={{ fontSize: 11.5 }}>{f}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
