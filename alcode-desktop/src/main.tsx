import { Component, ErrorInfo, ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Quick from './Quick'
import './theme.css'

/**
 * حرس الواجهة.
 *
 * السبب: النافذة تُنشأ مخفيّة وتُظهَر عند أول رسم. فإن انهار React قبل أن يرسم
 * شيئًا لا يُطلق الحدث ولا تظهر النافذة أبدًا — يبقى التطبيق حيًّا في مدير
 * المهام والمستخدم يرى «ما يفتح» بلا رسالة. أُعيد إنتاج هذا فعلًا: خطأ واحد
 * في قراءة الجسر كان يكفي.
 *
 * الحلّ من طرفين: العملية الرئيسية تُظهر النافذة بمهلة مهما جرى، وهنا نضمن
 * أن يُرسَم شيء مقروء دائمًا بدل شاشة فارغة.
 */
class Guard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // نطبعه ليظهر في السجل وفي أدوات المطوّر معًا.
    console.error('انهيار في الواجهة:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{ padding: 36, maxWidth: 680, margin: '0 auto', lineHeight: 1.8 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>😕</div>
        <h1 style={{ fontSize: 26, margin: '0 0 6px' }}>توقّفت الواجهة</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          التطبيق يعمل، لكن هذه الشاشة أخفقت. أعِد التحميل، أو أرسل نصّ الخطأ
          التالي ليُصلَح سببه بدقة.
        </p>
        <pre
          className="small"
          style={{
            background: 'var(--surface-high)', borderRadius: 14, padding: 14,
            whiteSpace: 'pre-wrap', direction: 'ltr', textAlign: 'left', overflowX: 'auto',
          }}
        >
          {this.state.error.message}
          {'\n\n'}
          {this.state.error.stack?.slice(0, 1200)}
        </pre>
        <button className="btn" onClick={() => window.location.reload()}>
          إعادة التحميل
        </button>
      </div>
    )
  }
}

/**
 * الجسر مفقود = الواجهة منفصلة عن الجهاز. يحدث إن أخفق تحميل preload.
 * نقولها صريحة بدل أن ينهار أول نداء ويختفي كل شيء.
 */
function MissingBridge() {
  return (
    <div style={{ padding: 36, maxWidth: 620, margin: '0 auto', lineHeight: 1.8 }}>
      <div style={{ fontSize: 44, marginBottom: 8 }}>🔌</div>
      <h1 style={{ fontSize: 26, margin: '0 0 6px' }}>الجسر غير محمَّل</h1>
      <p className="muted">
        تعذّر تحميل الوسيط بين الواجهة والنظام، فلا يستطيع التطبيق الوصول إلى
        جهازك. أغلقه وأعِد تشغيله؛ إن تكرّر فالنسخة ناقصة الملفات — أعِد التثبيت.
      </p>
      <button className="btn" onClick={() => window.location.reload()}>
        إعادة المحاولة
      </button>
    </div>
  )
}

const isQuick = window.location.hash.startsWith('#/quick')
const hasBridge = typeof window.alcode === 'object' && window.alcode !== null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Guard>
      {!hasBridge ? <MissingBridge /> : isQuick ? <Quick /> : <App />}
    </Guard>
  </StrictMode>,
)
