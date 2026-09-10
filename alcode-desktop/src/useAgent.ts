import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatMessage, ConfirmRequest, ToolRun } from './types'

/**
 * حالة المحادثة مع المساعد.
 *
 * سجلّ الواجهة (للعرض) منفصل عن سجلّ الواجهة البرمجية (للنموذج): الأول
 * نصوص مقروءة، والثاني كتل محتوى تشمل استدعاءات الأدوات ونتائجها. خلطهما
 * يكسر إعادة الإرسال في الأدوار التالية.
 */
export function useAgent(fromQuick = false, persist = false) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)

  const apiHistory = useRef<unknown[]>([])
  const buffer = useRef('')
  const runs = useRef<ToolRun[]>([])
  const activeId = useRef('')

  // هوية المحادثة الجارية — تُنشأ عند أول رسالة وتثبت حتى «محادثة جديدة».
  const conversationId = useRef('')
  const createdAt = useRef(0)

  useEffect(() => {
    const offEvent = window.alcode.agent.onEvent((event: any) => {
      switch (event.type) {
        case 'text':
          buffer.current += event.delta
          setStatus('')
          patch()
          break
        case 'tool_start':
          setStatus(`أنفّذ ${event.call.name}…`)
          break
        case 'searching':
          setStatus('أبحث في الإنترنت…')
          runs.current = [...runs.current, {
            name: 'web_search', label: `🔎 بحث: ${event.query}`, ok: true,
          }]
          patch()
          break
        case 'tool_end':
          setStatus('')
          runs.current = [...runs.current, {
            name: event.call.name, label: event.result.display, ok: event.result.ok,
          }]
          patch()
          break
        case 'tool_denied':
          runs.current = [...runs.current, {
            name: event.call.name, label: 'أُلغي بطلبك', ok: false, denied: true,
          }]
          patch()
          break
        case 'failed':
          setError(event.message)
          break
        case 'done':
          setStatus('')
          break
      }
    })

    const offConfirm = window.alcode.agent.onConfirm((request: ConfirmRequest) => {
      setConfirmRequest(request)
    })

    return () => { offEvent(); offConfirm() }
  }, [])

  const patch = () => {
    const id = activeId.current
    setMessages((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, content: buffer.current, runs: runs.current }
          : message,
      ),
    )
  }

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || streaming) return

    setError('')
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: trimmed, runs: [],
    }
    const placeholder: ChatMessage = {
      id: crypto.randomUUID(), role: 'assistant', content: '', runs: [],
    }
    activeId.current = placeholder.id
    buffer.current = ''
    runs.current = []

    if (!conversationId.current) {
      conversationId.current = crypto.randomUUID()
      createdAt.current = Date.now()
    }

    setMessages((current) => [...current, userMessage, placeholder])
    setStreaming(true)
    setStatus('يفكّر…')

    apiHistory.current = [...apiHistory.current, { role: 'user', content: trimmed }]

    const result = await window.alcode.agent.send({
      history: apiHistory.current,
      fromQuick,
    })

    if (result.history) apiHistory.current = result.history
    if (!result.ok && result.error) setError(result.error)

    setStreaming(false)
    setStatus('')

    // رد فارغ بلا أدوات يعني أن شيئًا انكسر — نقول ذلك بدل ترك فقاعة خالية.
    if (!buffer.current.trim() && !runs.current.length) {
      const message = result.error || 'ما وصل رد. جرّب مرة ثانية.'
      buffer.current = message
      setMessages((current) =>
        current.map((m) => (m.id === activeId.current
          ? { ...m, content: message, error: true } : m)),
      )
    }

    // الحفظ بعد اكتمال الدور لا مع كل رمز: الكتابة على القرص مع كل حرف
    // تُثقل الجهاز بلا فائدة، والدور المكتمل هو أصغر وحدة تستحقّ الحفظ.
    if (persist && result.ok) {
      setMessages((current) => {
        void window.alcode.chat.save({
          id: conversationId.current,
          createdAt: createdAt.current,
          messages: current,
          apiHistory: apiHistory.current,
        })
        return current
      })
    }
  }, [fromQuick, streaming, persist])

  const stop = useCallback(() => {
    window.alcode.agent.stop()
    setStreaming(false)
    setStatus('')
  }, [])

  const reset = useCallback(() => {
    apiHistory.current = []
    conversationId.current = ''
    createdAt.current = 0
    setMessages([])
    setError('')
  }, [])

  /** يستأنف محادثة محفوظة بحالتها الكاملة — عرضًا وسجلًّا برمجيًّا. */
  const resume = useCallback(async (id: string) => {
    const saved = await window.alcode.chat.load(id)
    if (!saved) return
    conversationId.current = saved.id
    createdAt.current = saved.createdAt
    apiHistory.current = saved.apiHistory ?? []
    setMessages(saved.messages ?? [])
    setError('')
  }, [])

  const answerConfirm = useCallback((allowed: boolean) => {
    if (!confirmRequest) return
    window.alcode.agent.confirm(confirmRequest.id, allowed)
    setConfirmRequest(null)
  }, [confirmRequest])

  return {
    messages, streaming, status, error,
    confirmRequest, answerConfirm,
    send, stop, reset, resume,
    conversationId: conversationId.current,
  }
}
