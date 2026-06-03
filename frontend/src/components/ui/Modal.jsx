import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Portal-based modal dialog.
 * @param {{ open: boolean, onClose: () => void, title?: string,
 *           size?: 'sm'|'md'|'lg'|'xl', children: React.ReactNode }} props
 */
export default function Modal({ open, onClose, title, size = 'md', children }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const widths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative flex flex-col w-full ${widths[size]} mx-4 rounded-xl border border-argo-border bg-argo-surface shadow-2xl`}
        style={{ animation: 'scale-in 160ms var(--ease-out) both' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-argo-border flex-shrink-0">
          {title && (
            <h2 className="text-sm font-semibold text-argo-primary">{title}</h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
