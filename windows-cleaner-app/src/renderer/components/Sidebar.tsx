import type { PageId } from '../App'

interface NavItem {
  id: PageId
  label: string
  icon: string
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
  { id: 'cleaner', label: 'منظّف القرص', icon: '🧹' },
  { id: 'uninstaller', label: 'إزالة البرامج', icon: '🗑️' },
  { id: 'files', label: 'مدير الملفات', icon: '📁' },
  { id: 'tags', label: 'محرر وسوم الأغاني', icon: '🎵' }
]

const ADVANCED_ITEMS: NavItem[] = [
  { id: 'duplicates', label: 'الملفات المكرّرة', icon: '🧬' },
  { id: 'largefiles', label: 'أكبر الملفات', icon: '📦' },
  { id: 'startup', label: 'برامج بدء التشغيل', icon: '🚀' },
  { id: 'system', label: 'معلومات النظام', icon: '📊' }
]

export function Sidebar({
  active,
  onNavigate
}: {
  active: PageId
  onNavigate: (id: PageId) => void
}): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-badge">🧼</div>
        <span>CleanShelf</span>
      </div>

      {MAIN_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}

      <div className="nav-section-label">أدوات متقدّمة</div>
      {ADVANCED_ITEMS.map((item) => (
        <div
          key={item.id}
          className={`nav-item ${active === item.id ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}
    </aside>
  )
}
