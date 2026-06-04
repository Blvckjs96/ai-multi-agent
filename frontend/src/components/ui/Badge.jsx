const VARIANTS = {
  default:  'bg-white/5 text-argo-secondary border-argo-border',
  cyan:     'bg-cyan-500/10 text-argo-cyan border-cyan-500/20',
  green:    'bg-green-500/10 text-argo-green border-green-500/20',
  red:      'bg-red-500/10 text-red-400 border-red-500/20',
  yellow:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  purple:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

/**
 * Small status/label badge.
 * @param {{ variant?: 'default'|'cyan'|'green'|'red'|'yellow'|'purple',
 *           children: React.ReactNode, className?: string }} props
 */
export default function Badge({ variant = 'default', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border
        ${VARIANTS[variant] ?? VARIANTS.default} ${className}`}
    >
      {children}
    </span>
  )
}
