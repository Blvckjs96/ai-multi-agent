import { useCallback, useEffect, useState } from 'react'
import { ThumbsUp, ThumbsDown, RefreshCw } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function useEvaluations(filter) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (filter && filter !== 'all') params.set('rating', filter)
      const r = await fetch(`${API_ORIGIN}/api/v1/feedback?${params}`, { headers: authHeaders() })
      if (r.ok) setData(await r.json())
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])
  return { data, loading, reload: load }
}

function RatingBadge({ rating }) {
  if (rating === 'up') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 text-[10px] font-semibold">
        <ThumbsUp size={9} /> Up
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold">
      <ThumbsDown size={9} /> Down
    </span>
  )
}

const FILTERS = [
  { label: 'All',   value: 'all'  },
  { label: '👍 Up', value: 'up'   },
  { label: '👎 Down', value: 'down' },
]

export default function EvaluationsPanel() {
  const [filter, setFilter] = useState('all')
  const { data, loading, reload } = useEvaluations(filter)

  const items    = data?.items ?? []
  const total    = data?.total ?? 0
  const positive = items.filter((fb) => fb.rating === 'up').length
  const negative = items.filter((fb) => fb.rating === 'down').length
  const positivePct = total > 0 ? Math.round((positive / total) * 100) : 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-argo-border flex-shrink-0">
        <ThumbsUp size={15} className="text-argo-cyan flex-shrink-0" />
        <h2 className="text-sm font-bold text-argo-primary flex-1">Evaluations</h2>
        <button
          type="button"
          onClick={reload}
          className="w-6 h-6 flex items-center justify-center rounded border border-argo-border text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors"
          title="Refresh"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {/* Stats row */}
      {data && (
        <div className="flex items-center gap-4 px-5 py-3 border-b border-argo-border bg-argo-elevated/40 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-argo-muted">Total:</span>
            <span className="text-xs font-bold text-argo-primary tabular-nums">{total}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThumbsUp size={11} className="text-green-400" />
            <span className="text-xs font-semibold text-green-400 tabular-nums">{positive}</span>
            <span className="text-[10px] text-argo-muted">({positivePct}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ThumbsDown size={11} className="text-red-400" />
            <span className="text-xs font-semibold text-red-400 tabular-nums">{negative}</span>
          </div>
          {/* Filter pills */}
          <div className="ml-auto flex items-center bg-argo-elevated border border-argo-border rounded-lg p-0.5 gap-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                  filter === f.value
                    ? 'bg-argo-cyan text-[#001218]'
                    : 'text-argo-muted hover:text-argo-primary'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-[10px] text-argo-muted text-center pt-8">Loading…</p>
        )}

        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 pt-16 text-argo-muted">
            <ThumbsUp size={28} className="text-argo-border" />
            <p className="text-sm">No evaluations yet</p>
            <p className="text-xs">Rate AI responses with 👍/👎 to see them here</p>
          </div>
        )}

        {items.map((fb) => (
          <div
            key={fb.id}
            className="px-5 py-3 border-b border-argo-border hover:bg-argo-elevated/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <RatingBadge rating={fb.rating} />
                  <span className="text-[10px] text-argo-muted">
                    {fb.created_at ? new Date(fb.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-xs text-argo-secondary font-mono truncate">
                  msg: {fb.message_id?.slice(0, 16)}…
                </p>
                {fb.comment && (
                  <p className="text-xs text-argo-primary mt-1 leading-relaxed">{fb.comment}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
