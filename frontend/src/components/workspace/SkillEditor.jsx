import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'
import ConfirmDialog from '../ui/ConfirmDialog'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const EMPTY_FORM = { name: '', description: '', content: '# Skill name\n\n## When to use\n\n## Steps\n\n' }

export default function SkillEditor({ workspaceId }) {
  const [skills, setSkills]             = useState([])
  const [selected, setSelected]         = useState(null)
  const [form, setForm]                 = useState(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving, setSaving]             = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`${API_ORIGIN}/api/v1/skills`, { headers: authHeaders() })
    if (r.ok) {
      const d = await r.json()
      setSkills(d.items ?? d)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectSkill = (s) => {
    setSelected(s)
    setForm({ name: s.name, description: s.description ?? '', content: s.content ?? '' })
  }

  const resetForm = () => { setSelected(null); setForm(EMPTY_FORM) }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const method = selected ? 'PATCH' : 'POST'
      const url = selected
        ? `${API_ORIGIN}/api/v1/skills/${selected.id}`
        : `${API_ORIGIN}/api/v1/skills`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: form.name, description: form.description, content: form.content }),
      })
      if (res.ok) {
        const updated = await res.json()
        setSkills((prev) =>
          selected ? prev.map((s) => (s.id === updated.id ? updated : s)) : [updated, ...prev]
        )
        setSelected(updated)
      }
    } finally {
      setSaving(false)
    }
  }

  const deleteSkill = async () => {
    if (!selected) return
    await fetch(`${API_ORIGIN}/api/v1/skills/${selected.id}`, { method: 'DELETE', headers: authHeaders() })
    setSkills((prev) => prev.filter((s) => s.id !== selected.id))
    resetForm()
    setDeleteConfirm(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <div className="w-56 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-argo-border flex items-center justify-between">
          <span className="text-xs font-semibold text-argo-secondary">Skills</span>
          <button
            type="button"
            onClick={resetForm}
            aria-label="New skill"
            className="w-6 h-6 flex items-center justify-center rounded text-argo-muted hover:text-argo-cyan hover:bg-cyan-500/10 transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {skills.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => selectSkill(s)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                  selected?.id === s.id
                    ? 'border-argo-cyan bg-cyan-500/10 text-argo-primary'
                    : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
                }`}
              >
                <span className="block truncate">{s.name}</span>
                {s.description && (
                  <span className="block truncate text-argo-muted text-[10px] mt-0.5">{s.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 border-b border-argo-border flex-shrink-0">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Skill name"
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
              Content (Markdown)
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={16}
              placeholder="# Skill name&#10;&#10;## When to use&#10;..."
              className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary resize-y outline-none focus:border-argo-cyan transition-colors font-mono leading-relaxed"
            />
          </div>
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
        title="Delete skill"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        danger
        onConfirm={deleteSkill}
        onCancel={() => setDeleteConfirm(false)}
      />
    </div>
  )
}
