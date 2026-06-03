import { useEffect, useRef, useState } from 'react'

/**
 * Dropdown menu triggered by a custom element.
 * Pass `null` as an item to render a divider.
 * @param {{
 *   trigger: React.ReactNode,
 *   items: Array<{ label: string, icon?: React.ReactNode, onClick: () => void, danger?: boolean, disabled?: boolean } | null>,
 *   align?: 'left'|'right',
 *   className?: string
 * }} props
 */
export default function Dropdown({ trigger, items, align = 'left', className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <div onClick={() => setOpen((o) => !o)}>{trigger}</div>
      {open && (
        <div
          className={`absolute z-40 mt-1 min-w-[160px] rounded-lg border border-argo-border bg-argo-surface shadow-xl py-1
            ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ animation: 'fade-up 120ms var(--ease-out) both' }}
        >
          {items.map((item, i) =>
            item === null ? (
              <div key={i} className="my-1 border-t border-argo-border" />
            ) : (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  if (!item.disabled) { item.onClick(); setOpen(false) }
                }}
                className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs font-medium transition-colors
                  ${item.disabled
                    ? 'text-argo-muted cursor-not-allowed opacity-50'
                    : item.danger
                      ? 'text-argo-error hover:bg-red-500/10 cursor-pointer'
                      : 'text-argo-secondary hover:bg-argo-elevated hover:text-argo-primary cursor-pointer'
                  }`}
              >
                {item.icon && <span className="flex-shrink-0 opacity-70">{item.icon}</span>}
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  )
}
