import { Plus, Zap } from 'lucide-react'
import { useAutomations } from '../../hooks/useAutomations'
import AutomationEditor from './AutomationEditor'

function AutomationItem({ automation, active, onClick }) {
  const nextRun = automation.schedule_cron
    ? automation.schedule_cron
    : 'No schedule'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-left transition-colors border-l-2 ${
        active
          ? 'border-argo-cyan bg-cyan-500/10'
          : 'border-transparent hover:bg-argo-elevated'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            automation.enabled ? 'bg-argo-cyan' : 'bg-argo-border'
          }`}
        />
        <span className="text-xs font-medium text-argo-primary truncate flex-1">
          {automation.name || 'Untitled'}
        </span>
      </div>
      <p className="text-[10px] text-argo-muted mt-0.5 pl-3.5 truncate font-mono">{nextRun}</p>
      {automation.last_run_at && (
        <p className="text-[10px] text-argo-muted pl-3.5 mt-0.5">
          Last: {new Date(automation.last_run_at).toLocaleString()}
        </p>
      )}
    </button>
  )
}

export default function AutomationsPanel({ workspaceId }) {
  const { automations, active, activeId, setActiveId, loading, create, update, remove, trigger } =
    useAutomations(workspaceId)

  const handleNew = async () => {
    await create({
      name: 'New automation',
      schedule_cron: '0 9 * * *',
      prompt: '',
      enabled: false,
    })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left list */}
      <div className="w-64 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden bg-argo-surface">
        {/* Header */}
        <div className="p-3 border-b border-argo-border flex items-center gap-2">
          <Zap size={14} className="text-argo-cyan flex-shrink-0" />
          <span className="text-xs font-bold text-argo-primary flex-1">Automations</span>
          <button
            type="button"
            onClick={handleNew}
            className="w-6 h-6 flex items-center justify-center rounded border border-argo-border text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors"
            title="New automation"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="text-[10px] text-argo-muted text-center pt-6">Loading…</p>
          )}
          {!loading && automations.length === 0 && (
            <div className="flex flex-col items-center gap-2 pt-10 px-4 text-center">
              <Zap size={24} className="text-argo-border" />
              <p className="text-xs text-argo-muted">
                No automations yet.
                <br />
                Click <strong className="text-argo-secondary">+</strong> to create one.
              </p>
            </div>
          )}
          {automations.map((a) => (
            <AutomationItem
              key={a.id}
              automation={a}
              active={a.id === activeId}
              onClick={() => setActiveId(a.id)}
            />
          ))}
        </div>
      </div>

      {/* Right editor */}
      <div className="flex-1 flex flex-col overflow-hidden bg-argo-surface">
        <AutomationEditor
          automation={active}
          onSave={update}
          onDelete={remove}
          onTrigger={trigger}
        />
      </div>
    </div>
  )
}
