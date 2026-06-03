import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/**
 * Slide-in drawer panel.
 * @param {{ open: boolean, onClose: () => void, title?: string,
 *           side?: 'left'|'right', width?: string, children: React.ReactNode }} props
 */
export default function Drawer({ open, onClose, title, side = 'right', width = '360px', children }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className={`absolute top-0 bottom-0 ${side === 'right' ? 'right-0' : 'left-0'}
          flex flex-col bg-argo-surface border-${side === 'right' ? 'l' : 'r'} border-argo-border shadow-2xl`}
        style={{
          width,
          transform: open ? 'none' : `translateX(${side === 'right' ? '100%' : '-100%'})`,
          transition: 'transform 220ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-argo-border flex-shrink-0">
          {title && <h3 className="text-sm font-semibold text-argo-primary">{title}</h3>}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors"
            aria-label="Close drawer"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  )
}
