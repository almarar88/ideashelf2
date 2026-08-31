import { useEffect, useState } from 'react'
import type { DiskUsageResult, ScanProgress, FolderUsage } from '../../shared/types'
import { formatBytes } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { ScanProgressPanel } from '../components/ScanProgressPanel'

export function DiskAnalyzer(): JSX.Element {
  const { showToast } = useToast()
  const [result, setResult] = useState<DiskUsageResult | null>(null)
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setProgress), [])

  async function analyze(rootPath: string): Promise<void> {
    setScanning(true)
    setProgress(null)
    try {
      setResult(await window.api.fm.analyzeFolder(rootPath))
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف التحليل' : 'فشل التحليل: ' + message)
    } finally {
      setScanning(false)
      setProgress(null)
    }
  }

  async function pickAndAnalyze(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (picked) await analyze(picked)
  }

  async function openItem(item: FolderUsage): Promise<void> {
    if (item.isDirectory) await analyze(item.path)
    else await window.api.fm.reveal(item.path)
  }

  async function trashItem(item: FolderUsage): Promise<void> {
    const confirmed = await window.api.dialogs.confirm(
      `نقل "${item.name}" إلى سلة المحذوفات؟`,
      `${item.path}\nالحجم: ${formatBytes(item.sizeBytes)}`
    )
    if (!confirmed) return
    const [res] = await window.api.fm.trashPaths([item.path])
    showToast(res.success ? 'تم النقل إلى سلة المحذوفات' : 'فشل الحذف: ' + res.error)
    if (res.success && result) await analyze(result.root)
  }

  const maxSize = result?.children[0]?.sizeBytes ?? 0

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickAndAnalyze} disabled={scanning}>
          📂 اختر مجلدًا أو قرصًا
        </button>
        {result && (
          <>
            <button
              className="btn"
              disabled={!result.parent || scanning}
              onClick={() => result.parent && analyze(result.parent)}
            >
              ⬆️ للأعلى
            </button>
            <span className="muted" style={{ direction: 'ltr' }}>
              {result.root}
            </span>
          </>
        )}
        <div className="spacer" />
        {result && <strong>الإجمالي: {formatBytes(result.totalBytes)}</strong>}
      </div>

      {scanning ? (
        <ScanProgressPanel progress={progress} onCancel={() => window.api.fm.cancelScan()} />
      ) : !result ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>📊</div>
          <div>اختر مجلدًا لترى أين تذهب مساحة القرص بالضبط</div>
        </div>
      ) : result.children.length === 0 ? (
        <div className="empty-state">المجلد فارغ</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>العنصر</th>
                <th style={{ width: '30%' }}>النسبة</th>
                <th>الحجم</th>
                <th>الملفات</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.children.slice(0, 200).map((item) => {
                const percent = result.totalBytes
                  ? Math.round((item.sizeBytes / result.totalBytes) * 100)
                  : 0
                const barWidth = maxSize ? Math.max(2, (item.sizeBytes / maxSize) * 100) : 0
                return (
                  <tr key={item.path}>
                    <td
                      style={{ cursor: item.isDirectory ? 'pointer' : 'default', fontWeight: 600 }}
                      onClick={() => item.isDirectory && analyze(item.path)}
                    >
                      {item.isDirectory ? '📁' : '📄'} {item.name}
                    </td>
                    <td>
                      <div className="progress-bar" style={{ minWidth: 100 }}>
                        <div style={{ width: `${barWidth}%` }} />
                      </div>
                      <span className="muted" style={{ fontSize: 11.5 }}>
                        {percent}%
                      </span>
                    </td>
                    <td>{formatBytes(item.sizeBytes)}</td>
                    <td className="muted">{item.fileCount.toLocaleString('ar')}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => openItem(item)}>
                        {item.isDirectory ? 'افتح' : 'إظهار'}
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        style={{ marginRight: 6 }}
                        onClick={() => trashItem(item)}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
