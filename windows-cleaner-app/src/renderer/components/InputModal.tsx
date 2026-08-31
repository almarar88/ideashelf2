import { useEffect, useRef, useState } from 'react'

/**
 * حوار إدخال نصي — بديل عن window.prompt الذي لا تدعمه Electron إطلاقًا.
 */
export function InputModal({
  title,
  initialValue,
  confirmLabel = 'تأكيد',
  onConfirm,
  onCancel
}: {
  title: string
  initialValue: string
  confirmLabel?: string
  onConfirm: (value: string) => void
  onCancel: () => void
}): JSX.Element {
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function submit(): void {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
            if (e.key === 'Escape') onCancel()
          }}
          style={{ width: '100%' }}
        />
        <div className="toolbar" style={{ marginTop: 16, marginBottom: 0 }}>
          <div className="spacer" />
          <button className="btn" onClick={onCancel}>
            إلغاء
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
