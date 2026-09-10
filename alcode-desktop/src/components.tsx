import { ReactNode, useEffect, useRef } from 'react'
import { ChatMessage, ConfirmRequest } from './types'

/** فقاعة رسالة واحدة، بأسطر الأدوات التي نُفِّذت ضمنها. */
export function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className="enter"
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-start' : 'flex-end',
        marginBottom: 14,
      }}
    >
      <div style={{ maxWidth: '78%' }}>
        {message.runs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 7 }}>
            {message.runs.map((run, index) => (
              <div
                key={index}
                className="small"
                style={{
                  background: run.denied
                    ? 'var(--rose)'
                    : run.ok ? 'var(--mint)' : 'var(--rose)',
                  color: run.denied || !run.ok ? 'var(--rose-ink)' : 'var(--mint-ink)',
                  borderRadius: 12,
                  padding: '6px 12px',
                  fontWeight: 600,
                  width: 'fit-content',
                }}
              >
                {run.denied ? '🚫' : run.ok ? '✅' : '⚠️'} {run.label}
              </div>
            ))}
          </div>
        )}
        {message.content && (
          <div
            style={{
              background: isUser ? 'var(--lavender)' : 'var(--surface)',
              color: message.error ? 'var(--danger)' : 'var(--ink)',
              borderRadius: isUser ? '22px 22px 22px 6px' : '22px 22px 6px 22px',
              padding: '12px 16px',
              boxShadow: isUser ? 'none' : 'var(--shadow)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {message.content}
          </div>
        )}
      </div>
    </div>
  )
}

/** مؤشّر «يفكّر / ينفّذ / يبحث». */
export function Thinking({ label }: { label: string }) {
  return (
    <div className="row enter" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
      <div
        className="row"
        style={{
          background: 'var(--surface)', borderRadius: 20,
          padding: '10px 16px', boxShadow: 'var(--shadow)', gap: 8,
        }}
      >
        <span className="muted small">{label}</span>
        <span className="row" style={{ gap: 4 }}>
          <i className="dot" /><i className="dot" /><i className="dot" />
        </span>
      </div>
    </div>
  )
}

/**
 * حوار الموافقة على أمر خطر.
 *
 * يعرض اسم الأداة ومدخلاتها كاملة: الموافقة على شيء لا تراه ليست موافقة.
 */
export function ConfirmDialog({
  request, onAnswer,
}: { request: ConfirmRequest; onAnswer: (allowed: boolean) => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // التركيز على الرفض: الضغط العفوي على Enter يجب ألّا ينفّذ أمرًا خطرًا.
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onAnswer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onAnswer])

  const high = request.danger === 'high'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)',
        display: 'grid', placeItems: 'center', zIndex: 90, padding: 20,
      }}
    >
      <div className="card enter" style={{ maxWidth: 480, width: '100%' }}>
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>{high ? '⚠️' : '❓'}</span>
          <div className="grow">
            <div className="h2">{high ? 'أمر خطر' : 'تأكيد'}</div>
            <div className="muted small">{request.title} · {request.tool}</div>
          </div>
        </div>
        <pre
          className="small"
          style={{
            background: 'var(--surface-high)', borderRadius: 14, padding: 12,
            maxHeight: 200, overflow: 'auto', margin: '0 0 14px', direction: 'ltr',
            textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}
        >
          {request.details || '(بلا مدخلات)'}
        </pre>
        {high && (
          <p className="small" style={{ color: 'var(--danger)', margin: '0 0 12px' }}>
            هذا الأمر قد يفقد بيانات أو يوقف الجهاز. اقرأه قبل الموافقة.
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button ref={cancelRef} className="btn ghost" onClick={() => onAnswer(false)}>
            إلغاء
          </button>
          <button className={high ? 'btn danger' : 'btn'} onClick={() => onAnswer(true)}>
            نفّذ
          </button>
        </div>
      </div>
    </div>
  )
}

export function Section({ title, action, children }: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section style={{ marginBottom: 22 }}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 className="h2 grow">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** يمرّر إلى آخر رسالة كلما وصل نصّ جديد. */
export function useAutoScroll(dependency: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (node) node.scrollTop = node.scrollHeight
  }, [dependency])
  return ref
}
