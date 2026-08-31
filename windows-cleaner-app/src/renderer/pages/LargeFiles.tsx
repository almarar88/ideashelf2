import { useEffect, useState } from 'react'
import type { LargeFileEntry, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes } from '../lib/format'
import { basename } from '../lib/pathUtils'
import { useToast } from '../lib/toastContext'

const THRESHOLDS = [
  { label: '100 ميغابايت', bytes: 100 * 1024 * 1024 },
  { label: '500 ميغابايت', bytes: 500 * 1024 * 1024 },
  { label: '1 غيغابايت', bytes: 1024 * 1024 * 1024 },
  { label: '5 غيغابايت', bytes: 5 * 1024 * 1024 * 1024 }
]

export function LargeFiles(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [threshold, setThreshold] = useState(THRESHOLDS[0].bytes)
  const [files, setFiles] = useState<LargeFileEntry[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    await runScan(picked, threshold)
  }

  async function runScan(root: string, minSize: number): Promise<void> {
    setFolder(root)
    setScanning(true)
    setChecked(new Set())
    setProgress(null)
    try {
      setFiles(await window.api.fm.findLargeFiles(root, minSize))
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل البحث: ' + message)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  function toggle(p: string): void {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(`نقل ${checked.size} ملف إلى سلة المحذوفات؟`)
    if (!confirmed) return
    const results = await window.api.fm.delete([...checked])
    showToast(`تم حذف ${results.filter((r) => r.success).length} ملف`)
    if (folder) runScan(folder, threshold)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          📂 اختر مجلدًا
        </button>
        <select
          value={threshold}
          onChange={(e) => {
            const v = Number(e.target.value)
            setThreshold(v)
            if (folder) runScan(folder, v)
          }}
        >
          {THRESHOLDS.map((t) => (
            <option key={t.bytes} value={t.bytes}>
              أكبر من {t.label}
            </option>
          ))}
        </select>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {files.length > 0 && (
          <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
            حذف المحدَّد ({checked.size})
          </button>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : (
      <div className="card">
        {files.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 32 }}>📦</div>
            <div>اختر مجلدًا لعرض أكبر الملفات فيه</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>الملف</th>
                <th>الحجم</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.path}>
                  <td>
                    <input type="checkbox" checked={checked.has(f.path)} onChange={() => toggle(f.path)} />
                  </td>
                  <td>
                    <div>{basename(f.path)}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>
                      {f.path}
                    </div>
                  </td>
                  <td>{formatBytes(f.sizeBytes)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => window.api.fm.reveal(f.path)}>
                      إظهار
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  )
}
