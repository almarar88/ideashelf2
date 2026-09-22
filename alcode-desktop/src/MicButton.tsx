import { useEffect, useRef, useState } from 'react'
import { Recorder, startRecording } from './voice'

/**
 * زرّ الأمر الصوتي.
 *
 * ضغط للتحدّث لا كشف تلقائي للصمت: العتبة التلقائية تقطع المتحدّث في منتصف
 * جملته، والمستخدم يعرف متى انتهى. حلقة النبض تُظهر مستوى الصوت فعليًا —
 * بدونها لا يعرف المستخدم إن كان الميكروفون يسمعه أصلًا.
 */
export default function MicButton({ onText, disabled }: {
  onText: (text: string) => void
  disabled?: boolean
}) {
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle')
  const [level, setLevel] = useState(0)
  const [error, setError] = useState('')
  const recorder = useRef<Recorder | null>(null)
  const frame = useRef(0)

  useEffect(() => () => {
    recorder.current?.cancel()
    cancelAnimationFrame(frame.current)
  }, [])

  const begin = async () => {
    setError('')
    try {
      recorder.current = await startRecording()
      setState('recording')
      const tick = () => {
        if (!recorder.current) return
        setLevel(recorder.current.level())
        frame.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (problem) {
      // أشهر سببين: الصلاحية مرفوضة، أو لا ميكروفون موصول.
      const message = problem instanceof Error ? problem.message : String(problem)
      setError(/denied|NotAllowed/i.test(message)
        ? 'صلاحية الميكروفون مرفوضة — فعّلها من إعدادات ويندوز.'
        : /NotFound/i.test(message)
          ? 'ما في ميكروفون موصول.'
          : message)
      setState('idle')
    }
  }

  const finish = async () => {
    const active = recorder.current
    if (!active) return
    cancelAnimationFrame(frame.current)
    setState('working')
    setLevel(0)
    const audio = await active.stop()
    recorder.current = null

    const result = await window.alcode.voice.transcribe(audio)
    setState('idle')
    if (!result.ok) { setError(result.error); return }
    if (!result.text) { setError('ما سمعت شيئًا — جرّب مرّة ثانية.'); return }
    onText(result.text)
  }

  const label = state === 'recording' ? 'أسمعك… اترك للإرسال'
    : state === 'working' ? 'أفرّغ…'
      : 'اضغط مطوّلًا وتكلّم'

  return (
    <div style={{ position: 'relative' }}>
      <button
        title={label}
        disabled={disabled || state === 'working'}
        onMouseDown={() => { if (state === 'idle') void begin() }}
        onMouseUp={() => { if (state === 'recording') void finish() }}
        onMouseLeave={() => { if (state === 'recording') void finish() }}
        style={{
          width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center', fontSize: 17,
          background: state === 'recording' ? 'var(--danger)' : 'var(--surface-high)',
          color: state === 'recording' ? '#fff' : 'var(--ink)',
          // الحلقة تكبر مع صوتك: دليل مرئي أن الميكروفون يعمل فعلًا.
          boxShadow: state === 'recording'
            ? `0 0 0 ${Math.round(4 + level * 14)}px rgba(212, 87, 79, 0.18)`
            : 'none',
          transition: 'background 0.15s ease, box-shadow 0.08s linear',
          opacity: disabled ? 0.45 : 1,
        }}
      >
        {state === 'working' ? '…' : '🎙️'}
      </button>

      {error && (
        <div
          className="small"
          style={{
            position: 'absolute', bottom: 50, insetInlineEnd: 0, width: 240,
            background: 'var(--rose)', color: 'var(--rose-ink)',
            borderRadius: 14, padding: '8px 12px', zIndex: 20, lineHeight: 1.6,
          }}
          onClick={() => setError('')}
        >
          {error}
        </div>
      )}
    </div>
  )
}
