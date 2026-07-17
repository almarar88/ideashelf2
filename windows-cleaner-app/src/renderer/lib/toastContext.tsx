import { createContext, useCallback, useContext, useRef, useState } from 'react'

interface ToastContextValue {
  showToast: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setMessage(msg)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setMessage(null), 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && <div className="toast">{message}</div>}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast يجب أن يُستخدم داخل ToastProvider')
  return ctx
}
