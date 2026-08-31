import { useEffect, useState } from 'react'
import type { BrokenShortcut, ScanProgress } from '../../shared/types'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { basename } from '../lib/pathUtils'

type Mode = 'empty' | 'shortcuts'

export function CleanupExtras(): JSX.Element {
  const { showToast } = useToast()
  const [mode, setMode] = useState<Mode>('empty')
  const [folder, setFolder] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [emptyFolders, setEmptyFolders] = useState<string[]>([])
  const [broken, setBroken] = useState<BrokenShortcut[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function pickAndScan(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    await runScan(picked, mode)
  }

  async function runScan(root: string, which: Mode): Promise<void> {
    setScanning(true)
    setProgress(null)
    setChecked(new Set())
    setEmptyFolders([])
    setBroken([])
    try {
      if (which === 'empty') {
        const result = await window.api.fm.findEmptyFolders(root)
        setEmptyFolders(result)
        if (result.length === 0) showToast('لا توجد مجلدات فارغة')
      } else {
        const result = await window.api.fm.findBrokenShortcuts(root)
        setBroken(result)
        if (result.length === 0) showToast('لا توجد اختصارات معطوبة')
      }
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف الفحص' : 'فشل الفحص: ' + message)
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

  const items = mode === 'empty' ? emptyFolders : broken.map((b) => b.shortcutPath)

  async function deleteChecked(): Promise<void> {
    if (checked.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      `نقل ${checked.size} عنصر إلى سلة المحذوفات؟`,
      'يمكنك استرجاعها من سلة المحذوفات إن غيّرت رأيك.'
    )
    if (!confirmed) return
    const results = await window.api.fm.trashPaths([...checked])
    showToast(`تم حذف ${results.filter((r) => r.success).length} عنصر`)
    if (folder) await runScan(folder, mode)
  }

  return (
    <div className="page">
      <div className="toolbar">
        <select
          value={mode}
          onChange={(e) => {
            const next = e.target.value as Mode
            setMode(next)
            setEmptyFolders([])
            setBroken([])
            setChecked(new Set())
            if (folder) runScan(folder, next)
          }}
        >
          <option value="empty">المجلدات الفارغة</option>
          <option value="shortcuts">الاختصارات المعطوبة</option>
        </select>
        <button className="btn btn-primary" onClick={pickAndScan} disabled={scanning}>
          📂 اختر مجلدًا وافحص
        </button>
        {folder && (
          <span className="muted" style={{ direction: 'ltr' }}>
            {folder}
          </span>
        )}
        <div className="spacer" />
        {items.length > 0 && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setChecked(new Set(checked.size === items.length ? [] : items))}
            >
              {checked.size === items.length ? 'إلغاء التحديد' : 'تحديد الكل'}
            </button>
            <button className="btn btn-danger" disabled={checked.size === 0} onClick={deleteChecked}>
              حذف المحدَّد ({checked.size})
            </button>
          </>
        )}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : items.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>{mode === 'empty' ? '🗂️' : '🔗'}</div>
          <div>
            {mode === 'empty'
              ? 'اختر مجلدًا للبحث عن المجلدات الفارغة تمامًا'
              : 'اختر مجلدًا للبحث عن اختصارات اختفى هدفها'}
          </div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>{mode === 'empty' ? 'المجلد' : 'الاختصار'}</th>
                {mode === 'shortcuts' && <th>الهدف المفقود</th>}
              </tr>
            </thead>
            <tbody>
              {mode === 'empty'
                ? emptyFolders.map((p) => (
                    <tr key={p}>
                      <td>
                        <input type="checkbox" checked={checked.has(p)} onChange={() => toggle(p)} />
                      </td>
                      <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12.5 }}>{p}</td>
                    </tr>
                  ))
                : broken.map((b) => (
                    <tr key={b.shortcutPath}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked.has(b.shortcutPath)}
                          onChange={() => toggle(b.shortcutPath)}
                        />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{basename(b.shortcutPath)}</div>
                        <div
                          className="muted"
                          style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                        >
                          {b.shortcutPath}
                        </div>
                      </td>
                      <td
                        className="muted"
                        style={{ fontSize: 11.5, direction: 'ltr', textAlign: 'right' }}
                      >
                        {b.targetPath}
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
