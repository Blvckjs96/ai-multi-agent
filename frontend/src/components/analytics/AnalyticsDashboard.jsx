import { useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { useAnalytics } from '../../hooks/useAnalytics'
import UsageChart from './UsageChart'

const PERIODS = [
  { label: '7d',  value: 7  },
  { label: '14d', value: 14 },
  { label: '30d', value: 30 },
]

const STEP_LABELS = {
  backlog:        'Backlog',
  planning:       'Planning',
  implementation: 'Implementation',
  review:         'Review',
  done:           'Done',
  misc:           'Misc',
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-argo-elevated rounded-xl border border-argo-border p-4 flex flex-col gap-1">
      <p className="text-[10px] font-bold uppercase tracking-wider text-argo-muted">{label}</p>
      <p
        className="text-2xl font-bold tabular-nums"
        style={{ color: accent ? 'var(--accent-cyan)' : 'var(--text-primary)' }}
      >
        {value ?? '–'}
      </p>
      {sub && <p className="text-xs text-argo-muted">{sub}</p>}
    </div>
  )
}

function TaskBar({ label, count, max }) {
  const pct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-argo-secondary w-28 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-argo-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-argo-cyan transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-argo-muted w-6 text-right tabular-nums">{count}</span>
    </div>
  )
}

export default function AnalyticsDashboard({ workspaceId }) {
  const [period, setPeriod] = useState(7)
  const { data, loading } = useAnalytics(workspaceId, period)

  const tasksByStep = data?.tasks_by_step ?? {}
  const taskEntries = Object.entries(tasksByStep)
  const maxTaskCount = Math.max(1, ...taskEntries.map(([, v]) => v))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart2 size={16} className="text-argo-cyan" />
          <h2 className="text-sm font-bold text-argo-primary">Analytics</h2>
        </div>
        {/* Period selector */}
        <div className="flex items-center bg-argo-elevated border border-argo-border rounded-lg p-0.5 gap-0.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-argo-cyan text-[#001218]'
                  : 'text-argo-muted hover:text-argo-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-argo-muted text-xs">
          Loading analytics…
        </div>
      )}

      {!loading && data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Conversations"
              value={data.total_conversations}
              sub={`Last ${period} days`}
              accent
            />
            <StatCard
              label="Messages"
              value={data.total_messages}
              sub="All time"
            />
            <StatCard
              label="Tasks Done"
              value={data.tasks_done}
              sub="Completed tasks"
            />
            <StatCard
              label="Period"
              value={`${period}d`}
              sub={workspaceId ? 'Workspace' : 'All workspaces'}
            />
          </div>

          {/* Usage chart */}
          <div className="bg-argo-elevated rounded-xl border border-argo-border p-4 mb-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-3">
              Conversations per day
            </p>
            <UsageChart data={data.conversations_by_day} />
          </div>

          {/* Task step distribution */}
          {taskEntries.length > 0 && (
            <div className="bg-argo-elevated rounded-xl border border-argo-border p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-4">
                Tasks by step
              </p>
              <div className="flex flex-col gap-3">
                {taskEntries.map(([step, count]) => (
                  <TaskBar
                    key={step}
                    label={STEP_LABELS[step] ?? step}
                    count={count}
                    max={maxTaskCount}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !data && (
        <div className="flex flex-col items-center justify-center gap-2 pt-16 text-argo-muted">
          <BarChart2 size={32} className="text-argo-border" />
          <p className="text-sm">No analytics data available</p>
        </div>
      )}
    </div>
  )
}
