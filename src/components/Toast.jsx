import { useState, useCallback } from 'react'

let toastFn = null

export function useToast() {
  const [toast, setToast] = useState(null)

  const show = useCallback((msg) => {
    setToast({ msg, key: Date.now() })
    setTimeout(() => setToast(null), 1900)
  }, [])

  return { toast, show }
}

export function Toast({ toast }) {
  if (!toast) return null
  return (
    <div
      key={toast.key}
      className="toast-enter fixed bottom-24 left-1/2 z-50 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg pointer-events-none"
    >
      {toast.msg}
    </div>
  )
}
