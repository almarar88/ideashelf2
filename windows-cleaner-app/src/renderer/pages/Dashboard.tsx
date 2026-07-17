import { useEffect, useState } from 'react'
import type { SystemSummary } from '../../shared/types'
import { formatBytes } from '../lib/format'
import type { PageId } from '../App'

export function Dashboard({ onNavigate }: { onNavigate: (id: PageId) => void }): JSX.Element {
  const [summary, setSummary] = useState<SystemSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.system
      .summary()
      .then(setSummary)
      .catch((err) => setError(err.message))
  }, [])

  const mainDisk = summary?.disks[0]

  return (
    <div className="page">
      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="card card-pad stat-tile">
          <span className="label">المعالج</span>
          <span className="value">{summary ? `${summary.cpuLoadPercent}%` : '—'}</span>
          <span className="muted">{summary?.cpuModel || ''}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">الذاكرة المستخدمة</span>
          <span className="value">
            {summary ? formatBytes(summary.usedMemBytes) : '—'}
          </span>
          <span className="muted">من أصل {summary ? formatBytes(summary.totalMemBytes) : '—'}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">مساحة القرص الرئيسي</span>
          <span className="value">{mainDisk ? formatBytes(mainDisk.freeBytes) : '—'}</span>
          <span className="muted">متاحة من {mainDisk ? formatBytes(mainDisk.totalBytes) : '—'}</span>
        </div>
        <div className="card card-pad stat-tile">
          <span className="label">مدة التشغيل</span>
          <span className="value">
            {summary ? `${Math.floor(summary.uptimeSec / 3600)} ساعة` : '—'}
          </span>
          <span className="muted">{summary?.hostname || ''}</span>
        </div>
      </div>

      {error && (
        <div className="card card-pad" style={{ marginBottom: 20, color: 'var(--warning)' }}>
          تعذّر جلب معلومات النظام الحية: {error} (طبيعي إن كنت تعاين التطبيق خارج ويندوز)
        </div>
      )}

      <div className="grid grid-3">
        <QuickAction
          icon="🧹"
          title="تنظيف القرص"
          desc="افحص واحذف الملفات المؤقتة وذاكرة التخزين غير الضرورية"
          onClick={() => onNavigate('cleaner')}
        />
        <QuickAction
          icon="🗑️"
          title="إزالة البرامج"
          desc="استعرض البرامج المثبّتة وأزل ما لا تحتاجه مع مخلّفاته"
          onClick={() => onNavigate('uninstaller')}
        />
        <QuickAction
          icon="🎵"
          title="تحرير وسوم الأغاني"
          desc="عدّل العنوان والفنان والغلاف لملفات MP3 دفعة واحدة"
          onClick={() => onNavigate('tags')}
        />
        <QuickAction
          icon="🧬"
          title="الملفات المكرّرة"
          desc="اعثر على النسخ المكرّرة واسترجع المساحة المهدرة"
          onClick={() => onNavigate('duplicates')}
        />
        <QuickAction
          icon="🚀"
          title="بدء التشغيل"
          desc="تحكّم بالبرامج التي تعمل تلقائيًا عند إقلاع ويندوز"
          onClick={() => onNavigate('startup')}
        />
        <QuickAction
          icon="📁"
          title="مدير الملفات"
          desc="تصفح، أعد تسمية دفعية، وانقل الملفات بسهولة"
          onClick={() => onNavigate('files')}
        />
      </div>
    </div>
  )
}

function QuickAction({
  icon,
  title,
  desc,
  onClick
}: {
  icon: string
  title: string
  desc: string
  onClick: () => void
}): JSX.Element {
  return (
    <div className="card card-pad" style={{ cursor: 'pointer' }} onClick={onClick}>
      <div style={{ fontSize: 26, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <div className="muted" style={{ fontSize: 13 }}>
        {desc}
      </div>
    </div>
  )
}
