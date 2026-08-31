import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { Dashboard } from './pages/Dashboard'
import { Cleaner } from './pages/Cleaner'
import { Uninstaller } from './pages/Uninstaller'
import { FileManager } from './pages/FileManager'
import { TagEditor } from './pages/TagEditor'
import { Duplicates } from './pages/Duplicates'
import { LargeFiles } from './pages/LargeFiles'
import { Startup } from './pages/Startup'
import { SystemInfo } from './pages/SystemInfo'
import { Processes } from './pages/Processes'
import { Services } from './pages/Services'
import { Network } from './pages/Network'
import { DiskAnalyzer } from './pages/DiskAnalyzer'
import { CleanupExtras } from './pages/CleanupExtras'
import { History } from './pages/History'
import { ToastProvider } from './lib/toastContext'
import { applyTheme, loadTheme, nextTheme, THEME_LABEL, type ThemeMode } from './lib/theme'

export type PageId =
  | 'dashboard'
  | 'cleaner'
  | 'uninstaller'
  | 'files'
  | 'tags'
  | 'duplicates'
  | 'largefiles'
  | 'startup'
  | 'system'
  | 'processes'
  | 'services'
  | 'network'
  | 'diskanalyzer'
  | 'extras'
  | 'history'

const PAGE_TITLES: Record<PageId, { title: string; sub: string }> = {
  dashboard: { title: 'الرئيسية', sub: 'نظرة عامة على حالة جهازك' },
  cleaner: { title: 'منظّف القرص', sub: 'حرّر المساحة بحذف الملفات غير الضرورية' },
  uninstaller: { title: 'إزالة البرامج', sub: 'أزل البرامج المثبَّتة مع مخلّفاتها' },
  files: { title: 'مدير الملفات', sub: 'تصفّح وأعد تسمية ونظّم ملفاتك' },
  tags: { title: 'محرر وسوم الأغاني', sub: 'حرّر معلومات وأغلفة ملفات MP3 كما في Mp3tag' },
  duplicates: { title: 'الملفات المكرّرة', sub: 'اعثر على النسخ المكرّرة واسترجع المساحة' },
  largefiles: { title: 'أكبر الملفات', sub: 'حدّد أكبر الملفات المستهلكة للمساحة' },
  startup: { title: 'برامج بدء التشغيل', sub: 'تحكّم بما يعمل تلقائيًا عند إقلاع ويندوز' },
  system: { title: 'معلومات النظام', sub: 'حالة المعالج والذاكرة والأقراص' },
  processes: { title: 'العمليات', sub: 'ما يعمل الآن على جهازك، وإنهاء ما تريد' },
  services: { title: 'خدمات ويندوز', sub: 'تشغيل وإيقاف خدمات النظام' },
  network: { title: 'الشبكة', sub: 'المحوّلات والاتصالات النشطة وأدوات التشخيص' },
  diskanalyzer: { title: 'محلّل المساحة', sub: 'اعرف أين تذهب مساحة قرصك بالضبط' },
  extras: { title: 'مجلدات واختصارات', sub: 'المجلدات الفارغة والاختصارات المعطوبة' },
  history: { title: 'سجل التنظيف', sub: 'ما نُظّف سابقًا وكم مساحة تحرّرت' }
}

function renderPage(page: PageId, onNavigate: (id: PageId) => void): JSX.Element {
  switch (page) {
    case 'dashboard':
      return <Dashboard onNavigate={onNavigate} />
    case 'cleaner':
      return <Cleaner />
    case 'uninstaller':
      return <Uninstaller />
    case 'files':
      return <FileManager />
    case 'tags':
      return <TagEditor />
    case 'duplicates':
      return <Duplicates />
    case 'largefiles':
      return <LargeFiles />
    case 'startup':
      return <Startup />
    case 'system':
      return <SystemInfo />
    case 'processes':
      return <Processes />
    case 'services':
      return <Services />
    case 'network':
      return <Network />
    case 'diskanalyzer':
      return <DiskAnalyzer />
    case 'extras':
      return <CleanupExtras />
    case 'history':
      return <History />
  }
}

export function App(): JSX.Element {
  const [page, setPage] = useState<PageId>('dashboard')
  const [theme, setTheme] = useState<ThemeMode>(loadTheme)
  const meta = PAGE_TITLES[page]

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return (
    <ToastProvider>
      <div className="app-shell">
        <Sidebar active={page} onNavigate={setPage} />
        <div className="main-area">
          <div className="topbar">
            <div>
              <h1>{meta.title}</h1>
              <div className="sub">{meta.sub}</div>
            </div>
            <button
              className="btn btn-sm"
              onClick={() => setTheme(nextTheme(theme))}
              title="تبديل مظهر التطبيق"
            >
              {THEME_LABEL[theme]}
            </button>
          </div>
          {renderPage(page, setPage)}
        </div>
      </div>
    </ToastProvider>
  )
}
