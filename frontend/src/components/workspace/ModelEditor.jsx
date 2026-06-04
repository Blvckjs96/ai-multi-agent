import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'
import ConfirmDialog from '../ui/ConfirmDialog'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const EMPTY_FORM = { name: '', model_name: '', system_prompt: '', role: 'assistant' }

export default function ModelEditor({ workspaceId }) {
  const [coworkers, setCoworkers] = useState([])
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [models, setModels]       = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/coworkers`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setCoworkers(Array.isArray(d) ? d : (d.items ?? [])))
      .catch(() => {})
    fetch(`${API_ORIGIN}/api/v1/providers/llm/models`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setModels(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const selectCoworker = useCallback((cw) => {
    setSelected(cw)
    setForm({ name: cw.name, model_name: cw.model ?? '', system_prompt: cw.system_prompt ?? '', role: cw.role ?? 'assistant' })
  }, [])

  const resetForm = useCallback(() => {
    setSelected(null)
    setForm(EMPTY_FORM)
  }, [])

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const method = selected ? 'PATCH' : 'POST'
      const url    = selected
        ? `${API_ORIGIN}/api/v1/coworkers/${selected.id}`
        : `${API_ORIGIN}/api/v1/coworkers`
      const payload = { name: form.name, system_prompt: form.system_prompt, role: form.role }
      if (form.model_name) payload.model = form.model_name
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const updated = await res.json()
        setCoworkers((prev) => selected
          ? prev.map((c) => c.id === updated.id ? updated : c)
          : [updated, ...prev])
        setSelected(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteCoworker = async () => {
    if (!selected) return
    await fetch(`${API_ORIGIN}/api/v1/coworkers/${selected.id}`, {
      method: 'DELETE', headers: authHeaders(),
    })
    setCoworkers((prev) => prev.filter((c) => c.id !== selected.id))
    resetForm()
    setDeleteConfirm(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar: list */}
      <div className="w-56 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-argo-border flex items-center justify-between">
          <span className="text-xs font-semibold text-argo-secondary">Coworkers</span>
          <button
            type="button"
            onClick={resetForm}
            aria-label="New coworker"
            className="w-6 h-6 flex items-center justify-center rounded text-argo-muted hover:text-argo-cyan hover:bg-cyan-500/10 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto" role="listbox" aria-label="Coworkers">
          {coworkers.map((cw) => (
            <li key={cw.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected?.id === cw.id}
                onClick={() => selectCoworker(cw)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                  selected?.id === cw.id
                    ? 'border-argo-cyan bg-cyan-500/10 text-argo-primary'
                    : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
                }`}
              >
                {cw.name}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: form */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Coworker name"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors"
          />
          <select
            value={form.model_name}
            onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
            className="bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-secondary outline-none focus:border-argo-cyan"
          >
            <option value="">Auto model</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name ?? m.id}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1.5">
            Role
          </label>
          <input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="assistant"
            className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1.5">
            System Prompt
          </label>
          <textarea
            value={form.system_prompt}
            onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            rows={8}
            placeholder="You are a helpful AI assistant…"
            className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary resize-y outline-none focus:border-argo-cyan transition-colors font-mono leading-relaxed"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Save size={12} />
            {saving ? 'Saving…' : 'Save'}
          </button>
          {selected && (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-argo-error border border-red-500/20 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={12} />
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete coworker"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        danger
        onConfirm={deleteCoworker}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}
