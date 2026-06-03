import { useState } from 'react'

/**
 * Simple tooltip on hover.
 * @param {{ content: string, side?: 'top'|'bottom'|'left'|'right',
 *           children: React.ReactNode }} props
 */
export default function Tooltip({ content, side = 'top', children }) {
  const [visible, setVisible] = useState(false)

  const positions = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left:   'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right:  'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <div
          className={`absolute z-50 whitespace-nowrap px-2 py-1 rounded-md text-[11px] font-medium
            bg-argo-overlay border border-argo-border text-argo-secondary shadow-lg pointer-events-none
            ${positions[side]}`}
        >
          {content}
        </div>
      )}
    </div>
  )
}
