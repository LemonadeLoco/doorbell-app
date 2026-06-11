import { useRef, useEffect } from 'react'

export function BottomSheet({ onClose, children, footer = null }) {
  const sheetRef    = useRef(null)
  const startY      = useRef(0)
  const isDragging  = useRef(false)
  const dragY       = useRef(0)

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow            = 'hidden'
    document.body.style.position            = 'fixed'
    document.body.style.width               = '100%'
    document.body.style.top                 = `-${scrollY}px`
    document.body.style.overscrollBehavior  = 'none'
    return () => {
      document.body.style.overflow           = ''
      document.body.style.position           = ''
      document.body.style.width              = ''
      document.body.style.top                = ''
      document.body.style.overscrollBehavior = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  const onHandleTouchStart = (e) => {
    startY.current     = e.touches[0].clientY
    isDragging.current = true
    dragY.current      = 0
    if (sheetRef.current) sheetRef.current.style.transition = 'none'
  }

  const onHandleTouchMove = (e) => {
    if (!isDragging.current) return
    e.preventDefault()
    e.stopPropagation()
    const diff = e.touches[0].clientY - startY.current
    dragY.current = diff
    if (diff > 0 && sheetRef.current) sheetRef.current.style.transform = `translateY(${diff}px)`
  }

  const onHandleTouchEnd = () => {
    isDragging.current = false
    if (dragY.current > 80) {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.2s ease-out'
        sheetRef.current.style.transform  = 'translateY(100%)'
      }
      setTimeout(onClose, 200)
    } else if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform 0.2s ease-out'
      sheetRef.current.style.transform  = 'translateY(0)'
    }
    dragY.current = 0
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end" onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet-enter w-full bg-white rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle — touch handlers here only */}
        <div
          className="flex flex-col items-center pb-3 pt-2 cursor-grab select-none flex-shrink-0"
          style={{ touchAction: 'none', minHeight: 44, justifyContent: 'center' }}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto flex-1 px-5"
          style={{ paddingBottom: footer ? '16px' : 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          {children}
        </div>

        {/* Sticky footer with safe-area padding */}
        {footer && (
          <div
            className="px-5 bg-white border-t border-gray-100 flex-shrink-0"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)', paddingTop: '12px' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
