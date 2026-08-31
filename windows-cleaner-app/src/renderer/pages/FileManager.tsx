import { useEffect, useState } from 'react'
import type { DirListing, FileEntry, LargeFileEntry, ScanProgress } from '../../shared/types'
import { ScanProgressPanel } from '../components/ScanProgressPanel'
import { formatBytes, formatDate } from '../lib/format'
import { useToast } from '../lib/toastContext'
import { BatchRenameModal } from '../components/BatchRenameModal'
import { InputModal } from '../components/InputModal'

function extIcon(entry: FileEntry): string {
  if (entry.isDirectory) return '📁'
  const audio = ['mp3', 'flac', 'wav', 'm4a', 'ogg', 'aac', 'wma']
  const image = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']
  const archive = ['zip', 'rar', '7z']
  const ext = entry.extension.toLowerCase()
  if (audio.includes(ext)) return '🎵'
  if (image.includes(ext)) return '🖼️'
  if (archive.includes(ext)) return '🗜️'
  if (ext === 'exe' || ext === 'msi') return '⚙️'
  return '📄'
}

export function FileManager(): JSX.Element {
  const { showToast } = useToast()
  const [listing, setListing] = useState<DirListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBatchRename, setShowBatchRename] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<LargeFileEntry[] | null>(null)
  const [searchProgress, setSearchProgress] = useState<ScanProgress | null>(null)

  useEffect(() => window.api.fm.onScanProgress(setSearchProgress), [])

  async function runSearch(): Promise<void> {
    const query = searchQuery.trim()
    if (!query || !listing?.path) return
    setSearching(true)
    setSearchProgress(null)
    try {
      setSearchResults(await window.api.fm.search(listing.path, query))
    } catch (err) {
      const message = (err as Error).message
      showToast(message.includes('أُلغي') ? 'أُوقف البحث' : 'فشل البحث: ' + message)
    } finally {
      setSearching(false)
      setSearchProgress(null)
    }
  }

  async function open(targetPath: string | null): Promise<void> {
    setLoading(true)
    setSelected(new Set())
    try {
      setListing(await window.api.fm.list(targetPath))
    } catch (err) {
      showToast('تعذّر فتح المسار: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    open(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  async function handleDelete(): Promise<void> {
    if (selected.size === 0) return
    const confirmed = await window.api.dialogs.confirm(
      `نقل ${selected.size} عنصر إلى سلة المحذوفات؟`,
      'يمكنك استعادتها لاحقًا من سلة المحذوفات.'
    )
    if (!confirmed) return
    const results = await window.api.fm.delete([...selected])
    const failed = results.filter((r) => !r.success)
    showToast(failed.length ? `تم الحذف مع ${failed.length} فشل` : 'تم النقل إلى سلة المحذوفات')
    if (listing) open(listing.path)
  }

  async function handleRename(entry: FileEntry, newName: string): Promise<void> {
    setRenameTarget(null)
    if (newName === entry.name) return
    try {
      await window.api.fm.rename(entry.path, newName)
      if (listing) open(listing.path)
    } catch (err) {
      showToast('فشل إعادة التسمية: ' + (err as Error).message)
    }
  }

  async function handleNewFolder(name: string): Promise<void> {
    setShowNewFolder(false)
    if (!listing?.path) return
    try {
      await window.api.fm.createFolder(listing.path, name)
      open(listing.path)
    } catch (err) {
      showToast('فشل إنشاء المجلد: ' + (err as Error).message)
    }
  }

  const crumbs = listing?.path
    ? listing.path.split(/[\\/]/).filter(Boolean)
    : []

  const selectedFileEntries = (listing?.entries || []).filter(
    (e) => selected.has(e.path) && !e.isDirectory
  )

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn" disabled={!listing?.parent} onClick={() => open(listing!.parent)}>
          ⬆️ للأعلى
        </button>
        <button className="btn" disabled={!listing?.path} onClick={() => setShowNewFolder(true)}>
          ➕ مجلد جديد
        </button>
        <button className="btn" disabled={selected.size === 0} onClick={handleDelete}>
          🗑️ نقل إلى سلة المحذوفات
        </button>
        <button
          className="btn"
          disabled={selectedFileEntries.length === 0}
          onClick={() => setShowBatchRename(true)}
        >
          🔤 إعادة تسمية دفعية
        </button>
        <div className="spacer" />
        <input
          type="search"
          placeholder="ابحث داخل هذا المجلد وما تحته…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          disabled={!listing?.path}
          style={{ width: 240 }}
        />
        <button
          className="btn"
          onClick={runSearch}
          disabled={!listing?.path || !searchQuery.trim() || searching}
        >
          🔍 بحث
        </button>
        {searchResults && (
          <button className="btn btn-sm btn-ghost" onClick={() => setSearchResults(null)}>
            ✕ إلغاء نتائج البحث
          </button>
        )}
        <span className="muted">{selected.size > 0 ? `محدَّد: ${selected.size}` : ''}</span>
      </div>

      {listing?.path && (
        <div className="breadcrumbs">
          <span className="crumb" onClick={() => open(null)}>
            الأقراص
          </span>
          {crumbs.map((c, i) => {
            const partial = crumbs.slice(0, i + 1).join('\\')
            // "C:" وحده يعني "المجلد الحالي للقرص" في ويندوز وليس جذره — لذا نضيف الفاصل
            const withRoot = i === 0 ? partial + '\\' : partial
            const full = listing.path.startsWith('\\\\') ? '\\\\' + withRoot : withRoot
            return (
              <span key={i}>
                {' / '}
                <span className="crumb" onClick={() => open(full)}>
                  {c}
                </span>
              </span>
            )
          })}
        </div>
      )}

      {searching ? (
        <ScanProgressPanel progress={searchProgress} onCancel={() => window.api.fm.cancelScan()} />
      ) : searchResults ? (
        <div className="card">
          {searchResults.length === 0 ? (
            <div className="empty-state">لا نتائج مطابقة</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>نتائج البحث ({searchResults.length})</th>
                  <th>الحجم</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r) => (
                  <tr key={r.path}>
                    <td style={{ direction: 'ltr', textAlign: 'right', fontSize: 12.5 }}>{r.path}</td>
                    <td>{formatBytes(r.sizeBytes)}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => window.api.fm.reveal(r.path)}>
                        إظهار
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
      <div className="card">
        {loading ? (
          <div className="empty-state">جارٍ التحميل…</div>
        ) : !listing?.path ? (
          <div style={{ padding: 16 }} className="grid grid-4">
            {(listing?.drives || []).map((d) => (
              <div key={d} className="card card-pad" style={{ cursor: 'pointer' }} onClick={() => open(d)}>
                💽 {d}
              </div>
            ))}
          </div>
        ) : listing.entries.length === 0 ? (
          <div className="empty-state">المجلد فارغ</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>الاسم</th>
                <th>الحجم</th>
                <th>آخر تعديل</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {listing.entries.map((entry) => (
                <tr key={entry.path}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(entry.path)}
                      onChange={() => toggle(entry.path)}
                    />
                  </td>
                  <td
                    style={{ cursor: 'pointer' }}
                    onDoubleClick={() =>
                      entry.isDirectory ? open(entry.path) : window.api.fm.openPath(entry.path)
                    }
                  >
                    {extIcon(entry)} {entry.name}
                  </td>
                  <td>{entry.isDirectory ? '—' : formatBytes(entry.sizeBytes)}</td>
                  <td className="muted">{formatDate(entry.modifiedAt)}</td>
                  <td>
                    <button className="btn btn-sm" onClick={() => setRenameTarget(entry)}>
                      إعادة تسمية
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ marginRight: 6 }}
                      onClick={() => window.api.fm.reveal(entry.path)}
                    >
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

      {renameTarget && (
        <InputModal
          title="إعادة تسمية"
          initialValue={renameTarget.name}
          confirmLabel="إعادة تسمية"
          onConfirm={(name) => handleRename(renameTarget, name)}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {showNewFolder && (
        <InputModal
          title="اسم المجلد الجديد"
          initialValue="مجلد جديد"
          confirmLabel="إنشاء"
          onConfirm={handleNewFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}

      {showBatchRename && (
        <BatchRenameModal
          files={selectedFileEntries.map((e) => e.path)}
          onClose={() => setShowBatchRename(false)}
          onDone={() => {
            setShowBatchRename(false)
            if (listing) open(listing.path)
          }}
        />
      )}
    </div>
  )
}
