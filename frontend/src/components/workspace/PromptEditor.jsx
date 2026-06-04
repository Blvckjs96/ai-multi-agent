import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'
import ConfirmDialog from '../ui/ConfirmDialog'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const DEFAULT_CONTENT = 'You are a {{role}} assistant.\n\n{{instructions}}\n\nAlways respond in {{language}}.'
const EMPTY_FORM = { name: '', description: '', content: DEFAULT_CONTENT }

function renderPreview(content) {
  return content.replace(/\{\{(\w+)\}\}/g, (_, v) => `[${v}]`)
}

export default function PromptEditor({ workspaceId }) {
  const [prompts, setPrompts]           = useState([])
  const [selected, setSelected]         = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving, setSaving]             = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`${API_ORIGIN}/api/v1/prompts`, { headers: authHeaders() })
    if (r.ok) {
      const d = await r.json()
      setPrompts(d.items ?? d)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectPrompt = (p) => {
    setSelected(p)
    setForm({ name: p.name, description: p.description ?? '', content: p.content ?? '' })
  }

  const resetForm = () => { setSelected(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const method = selected ? 'PATCH' : 'POST'
      const url = selected
        ? `${API_ORIGIN}/api/v1/prompts/${selected.id}`
        : `${API_ORIGIN}/api/v1/prompts`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: form.name, description: form.description, content: form.content }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPrompts((prev) =>
          selected ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev]
        )
        setSelected(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const deletePrompt = async () => {
    if (!selected) return
    await fetch(`${API_ORIGIN}/api/v1/prompts/${selected.id}`, { method: 'DELETE', headers: authHeaders() })
    setPrompts((prev) => prev.filter((p) => p.id !== selected.id))
    resetForm()
    setDeleteConfirm(false)
  }

  const variables = [...new Set([...form.content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-argo-border flex items-center justify-between">
          <span className="text-xs font-semibold text-argo-secondary">Prompts</span>
          <button
            type="button"
            onClick={resetForm}
            aria-label="New prompt"
            className="w-6 h-6 flex items-center justify-center rounded text-argo-muted hover:text-argo-cyan hover:bg-cyan-500/10 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {prompts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => selectPrompt(p)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                  selected?.id === p.id
                    ? 'border-argo-cyan bg-cyan-500/10 text-argo-primary'
                    : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
                }`}
              >
                <span className="block truncate">{p.name}</span>
                {p.description && (
                  <span className="block truncate text-argo-muted text-[10px] mt-0.5">{p.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: editor + preview */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-argo-border flex-shrink-0">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Prompt name"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-secondary outline-none focus:border-argo-cyan transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1.5">
              Template
              {variables.length > 0 && (
                <span className="ml-2 normal-case font-normal text-argo-cyan">
                  vars: {variables.map((v) => `{{${v}}}`).join(', ')}
                </span>
              )}
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={10}
              placeholder="You are a {{role}} assistant…"
              className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary resize-y outline-none focus:border-argo-cyan transition-colors font-mono leading-relaxed"
            />
          </div>

          {/* Live preview */}
          {form.content && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1.5">
                Preview
              </label>
              <div className="bg-argo-elevated border border-argo-border rounded-lg px-3 py-2.5 text-sm text-argo-secondary leading-relaxed whitespace-pre-wrap font-mono">
                {renderPreview(form.content)}
              </div>
            </div>
          )}

          <div className="flex gap-3">
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
      </div>

      <ConfirmDialog
        open={deleteConfirm}
        title="Delete prompt"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        danger
        onConfirm={deletePrompt}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}
