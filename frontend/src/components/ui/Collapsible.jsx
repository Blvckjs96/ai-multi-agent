import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

/**
 * Collapsible section with header and body.
 * @param {{ title: string, defaultOpen?: boolean,
 *           headerClassName?: string, children: React.ReactNode }} props
 */
export default function Collapsible({ title, defaultOpen = false, headerClassName = '', children }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 w-full text-left text-xs font-semibold text-argo-secondary
          hover:text-argo-primary transition-colors py-1 ${headerClassName}`}
      >
        {open
          ? <ChevronDown size={12} className="flex-shrink-0" />
          : <ChevronRight size={12} className="flex-shrink-0" />
        }
        {title}
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}
