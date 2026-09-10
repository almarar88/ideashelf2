import { useEffect, useRef, useState } from 'react'
import { Bubble, ConfirmDialog, Thinking, useAutoScroll } from './components'
import { useAgent } from './useAgent'

/**
 * الشريط السريع: ينزل بضغطة اختصار من أي مكان في ويندوز، تكتب أمرك، ينفّذ.
 * هذا مقابل «الضغط المطوّل على زر التشغيل» في نسخة الهاتف.
 */
export default function Quick() {
  const agent = useAgent(true)
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const scrollRef = useAutoScroll(agent.messages.map((m) => m.content).join('|'))

  useEffect(() => {
    inputRef.current?.focus()
    return window.alcode.quick.onFocus(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Esc يخفي الشريط إلا أثناء حوار الموافقة، فهو يتكفّل بنفسه.
      if (event.key === 'Escape' && !agent.confirmRequest) window.alcode.quick.hide()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [agent.confirmRequest])

  /**
   * النافذة تتبع ارتفاع محتواها.
   *
   * كانت ثابتة ٤٦٠ بكسل: حين لا محادثة، ثلاثة أرباعها شفّاف — يبدو فارغًا
   * لكنه يلتقط نقرات الفأرة، فيصير حاجزًا غير مرئي فوق سطح المكتب.
   */
  useEffect(() => {
    const element = shellRef.current
    if (!element) return
    const report = () => window.alcode.quick.resize(
      Math.ceil(element.getBoundingClientRect().height),
    )
    report()
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const submit = () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    void agent.send(text)
  }

  const hasChat = agent.messages.length > 0

  return (
    <div
      ref={shellRef}
      style={{
        display: 'flex', flexDirection: 'column',
        padding: 10, gap: 10,
        // بلا ارتفاع ثابت: القياس أعلاه يبلّغ النافذة بما يحتاجه المحتوى فعلًا.
        maxHeight: '100vh',
      }}
    >
      <div
        className="row"
        style={{
          background: 'var(--surface)', borderRadius: 999,
          boxShadow: 'var(--shadow-lg)', padding: '6px 6px 6px 18px', gap: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>✨</span>
        <input
          ref={inputRef}
          className="grow"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="شو تبي أسوي؟"
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            fontSize: 16, padding: '10px 0',
          }}
        />
        {agent.streaming ? (
          <button className="pill" onClick={agent.stop}>إيقاف</button>
        ) : (
          <button className="pill active" onClick={submit} disabled={!input.trim()}>
            نفّذ
          </button>
        )}
      </div>

      {(hasChat || agent.status || agent.error) && (
        <div
          ref={scrollRef}
          className="card"
          style={{ maxHeight: 420, overflowY: 'auto', padding: 16, borderRadius: 22 }}
        >
          {agent.messages.map((message) => (
            <Bubble key={message.id} message={message} />
          ))}
          {agent.status && <Thinking label={agent.status} />}
          {agent.error && (
            <div className="small" style={{ color: 'var(--danger)' }}>{agent.error}</div>
          )}
        </div>
      )}

      {/* التلميحات على خلفية شفّافة فوق خلفية سطح مكتب مجهولة اللون:
          بلا وعاء معتم قد تكون غير مقروءة تمامًا. */}
      <div className="row" style={{ justifyContent: 'center' }}>
        <div
          className="row small"
          style={{
            gap: 14, background: 'var(--surface)', color: 'var(--muted)',
            borderRadius: 999, padding: '5px 14px', boxShadow: 'var(--shadow)',
          }}
        >
          <span><kbd>Esc</kbd> للإخفاء</span>
          <button className="small muted" onClick={() => window.alcode.quick.expand()}>
            فتح النافذة الكاملة ↗
          </button>
        </div>
      </div>

      {agent.confirmRequest && (
        <ConfirmDialog request={agent.confirmRequest} onAnswer={agent.answerConfirm} />
      )}
    </div>
  )
}
