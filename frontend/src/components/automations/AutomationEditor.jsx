import { useEffect, useState } from 'react'
import { Play, Trash2, Save } from 'lucide-react'

const SCHEDULE_PRESETS = [
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every hour',       cron: '0 * * * *'   },
  { label: 'Daily at 9am',     cron: '0 9 * * *'   },
  { label: 'Daily midnight',   cron: '0 0 * * *'   },
  { label: 'Weekdays 9am',     cron: '0 9 * * 1-5' },
  { label: 'Custom cron…',     cron: '__custom__'   },
]

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-argo-muted">{label}</label>
      {children}
    </div>
  )
}

export default function AutomationEditor({ automation, onSave, onDelete, onTrigger }) {
  const [name, setName]     = useState('')
  const [cron, setCron]     = useState('0 9 * * *')
  const [customCron, setCustomCron] = useState('')
  const [prompt, setPrompt] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [saving, setSaving] = useState(false)
  const [justTriggered, setJustTriggered] = useState(false)

  useEffect(() => {
    if (!automation) return
    setName(automation.name ?? '')
    const preset = SCHEDULE_PRESETS.find((p) => p.cron === automation.schedule_cron)
    if (preset) {
      setCron(preset.cron)
    } else if (automation.schedule_cron) {
      setCron('__custom__')
      setCustomCron(automation.schedule_cron)
    } else {
      setCron('0 9 * * *')
    }
    setPrompt(automation.prompt ?? '')
    setEnabled(automation.enabled ?? true)
  }, [automation?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!automation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-argo-muted">
        <p className="text-sm">Select an automation or create a new one</p>
      </div>
    )
  }

  const resolvedCron = cron === '__custom__' ? customCron : cron

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(automation.id, { name, schedule_cron: resolvedCron || null, prompt, enabled })
    } finally {
      setSaving(false)
    }
  }

  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await onTrigger(automation.id)
      setJustTriggered(true)
      setTimeout(() => setJustTriggered(false), 2000)
    } finally {
      setTriggering(false)
    }
  }

  const inputCls = 'w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-xs text-argo-primary outline-none focus:border-argo-cyan transition-colors'
  const selectCls = inputCls + ' cursor-pointer'

  return (
    <div className="flex-1 flex flex-col gap-5 p-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-argo-primary truncate">{name || 'Untitled automation'}</h2>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <span className="text-xs text-argo-muted">Enabled</span>
          <div
            onClick={() => setEnabled((v) => !v)}
            className={`relative w-8 h-4 rounded-full transition-colors ${enabled ? 'bg-argo-cyan' : 'bg-argo-border'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>

      {/* Fields */}
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Daily standup summary…"
          className={inputCls}
        />
      </Field>

      <Field label="Schedule">
        <select value={cron} onChange={(e) => setCron(e.target.value)} className={selectCls}>
          {SCHEDULE_PRESETS.map((p) => (
            <option key={p.cron} value={p.cron}>{p.label}</option>
          ))}
        </select>
        {cron === '__custom__' && (
          <input
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            placeholder="*/30 * * * *"
            className={`${inputCls} mt-1.5 font-mono`}
          />
        )}
      </Field>

      <Field label="Prompt">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          placeholder="Summarize recent activity in this workspace and list any blockers…"
          className={`${inputCls} resize-none`}
        />
      </Field>

      {/* Last run info */}
      {automation.last_run_at && (
        <div className="rounded-lg border border-argo-border bg-argo-elevated/60 px-3 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1">Last run</p>
          <p className="text-xs text-argo-secondary">{new Date(automation.last_run_at).toLocaleString()}</p>
          {automation.last_result && (
            <p className="text-[11px] text-argo-muted mt-1 leading-relaxed line-clamp-2">{automation.last_result}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-argo-cyan text-[#001218] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Save size={12} />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleTrigger}
          disabled={triggering}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-argo-border text-argo-secondary text-xs font-medium hover:bg-argo-elevated hover:text-argo-primary transition-colors disabled:opacity-50"
        >
          <Play size={12} />
          {triggering ? 'Running…' : justTriggered ? 'Done!' : 'Run now'}
        </button>
        <button
          type="button"
          onClick={() => onDelete(automation.id)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors"
        >
          <Trash2 size={12} />
          Delete
        </button>
      </div>
    </div>
  )
}
