import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') ?? 'text'
  const code = String(children).replace(/\n$/, '')

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [code])

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-argo-border bg-[#0d0d0f]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-argo-border bg-argo-surface">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-argo-muted">
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-argo-muted hover:text-argo-primary transition-colors"
        >
          {copied ? (
            <>
              <Check size={12} className="text-argo-green" />
              <span className="text-argo-green">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed m-0">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}
