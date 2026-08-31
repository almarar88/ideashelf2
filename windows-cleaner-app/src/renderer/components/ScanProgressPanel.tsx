import type { ScanProgress } from '../../shared/types'

export function ScanProgressPanel({
  progress,
  onCancel
}: {
  progress: ScanProgress | null
  onCancel: () => void
}): JSX.Element {
  const percent =
    progress && progress.phase === 'hashing' && progress.total > 0
      ? Math.min(100, Math.round((progress.processed / progress.total) * 100))
      : null

  return (
    <div className="card card-pad">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <strong>
          {progress?.phase === 'hashing'
            ? `مقارنة محتوى الملفات… ${progress.processed} من ${progress.total}`
            : `جارٍ فحص المجلدات… ${progress?.filesSeen?.toLocaleString('ar') ?? 0} ملف`}
        </strong>
        <div className="spacer" />
        <button className="btn btn-sm" onClick={onCancel}>
          إيقاف الفحص
        </button>
      </div>

      {percent === null ? (
        <div className="progress-bar indeterminate">
          <div style={{ width: '100%' }} />
        </div>
      ) : (
        <div className="progress-bar">
          <div style={{ width: `${percent}%` }} />
        </div>
      )}

      <div
        className="muted"
        style={{
          fontSize: 11.5,
          marginTop: 8,
          direction: 'ltr',
          textAlign: 'left',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}
      >
        {progress?.currentPath || ''}
      </div>
    </div>
  )
}
