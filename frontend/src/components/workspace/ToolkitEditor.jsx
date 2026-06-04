import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save, Play } from 'lucide-react'
import CodeEditor from '../ui/CodeEditor'
import ConfirmDialog from '../ui/ConfirmDialog'
import { API_ORIGIN } from '../../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const EMPTY_FORM = { name: '', description: '', code: 'def run(**kwargs):\n    print("Hello from tool!")\n    return kwargs\n' }
const EMPTY_ARGS = '{}'

export default function ToolkitEditor({ workspaceId }) {
  const [tools, setTools]         = useState([])
  const [selected, setSelected]   = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [testArgs, setTestArgs]   = useState(EMPTY_ARGS)
  const [testResult, setTestResult] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [testing, setTesting]     = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`${API_ORIGIN}/api/v1/tools`, { headers: authHeaders() })
    if (r.ok) {
      const d = await r.json()
      setTools(d.items ?? d)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selectTool = (t) => {
    setSelected(t)
    setForm({ name: t.name, description: t.description, code: t.code })
    setTestResult(null)
  }

  const resetForm = () => {
    setSelected(null)
    setForm(EMPTY_FORM)
    setTestResult(null)
  }

  const save = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const method = selected ? 'PATCH' : 'POST'
      const url = selected
        ? `${API_ORIGIN}/api/v1/tools/${selected.id}`
        : `${API_ORIGIN}/api/v1/tools`
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ name: form.name, description: form.description, code: form.code }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTools((prev) => selected
          ? prev.map((t) => t.id === updated.id ? updated : t)
          : [updated, ...prev])
        setSelected(updated)
      }
    } finally { setSaving(false) }
  }

  const deleteTool = async () => {
    if (!selected) return
    await fetch(`${API_ORIGIN}/api/v1/tools/${selected.id}`, { method: 'DELETE', headers: authHeaders() })
    setTools((prev) => prev.filter((t) => t.id !== selected.id))
    resetForm()
    setDeleteConfirm(false)
  }

  const runTest = async () => {
    if (!selected) return
    setTesting(true)
    setTestResult(null)
    try {
      let args = {}
      try { args = JSON.parse(testArgs) } catch { /* use empty */ }
      const res = await fetch(`${API_ORIGIN}/api/v1/tools/${selected.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ args }),
      })
      if (res.ok) setTestResult(await res.json())
    } finally { setTesting(false) }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: tool list */}
      <div className="w-56 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-argo-border flex items-center justify-between">
          <span className="text-xs font-semibold text-argo-secondary">Tools</span>
          <button type="button" onClick={resetForm} aria-label="New tool"
            className="w-6 h-6 flex items-center justify-center rounded text-argo-muted hover:text-argo-cyan hover:bg-cyan-500/10 transition-colors">
            <Plus size={13} />
          </button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {tools.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => selectTool(t)}
                className={`w-full px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                  selected?.id === t.id
                    ? 'border-argo-cyan bg-cyan-500/10 text-argo-primary'
                    : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
                }`}>
                <span className="block truncate">{t.name}</span>
                {t.description && (
                  <span className="block truncate text-argo-muted text-[10px] mt-0.5">{t.description}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: editor + test panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Form header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-argo-border flex-shrink-0">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Tool name"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors" />
          <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Short description"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-secondary outline-none focus:border-argo-cyan transition-colors" />
        </div>

        <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-4">
          {/* Code editor */}
          <CodeEditor
            value={form.code}
            onChange={(v) => setForm((f) => ({ ...f, code: v }))}
            language="python"
            height="260px"
          />

          {/* Action buttons */}
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving || !form.name.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
              <Save size={12} />{saving ? 'Saving…' : 'Save'}
            </button>
            {selected && (
              <button type="button" onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-argo-error border border-red-500/20 hover:bg-red-500/10 transition-colors">
                <Trash2 size={12} />Delete
              </button>
            )}
          </div>

          {/* Test panel — only shown when a tool is selected/saved */}
          {selected && (
            <div className="border border-argo-border rounded-xl p-4 flex flex-col gap-3 bg-argo-surface">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-argo-muted">Test runner</span>
                <button type="button" onClick={runTest} disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-50 hover:opacity-90 transition-opacity">
                  <Play size={11} />{testing ? 'Running…' : 'Run'}
                </button>
              </div>
              <div>
                <label className="block text-[10px] text-argo-muted mb-1">Args (JSON)</label>
                <textarea value={testArgs} onChange={(e) => setTestArgs(e.target.value)} rows={3}
                  className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-xs text-argo-primary resize-none outline-none focus:border-argo-cyan transition-colors font-mono" />
              </div>
              {testResult && (
                <div className="bg-[#0d1117] rounded-lg p-3 font-mono text-xs space-y-1">
                  {testResult.stdout && (
                    <pre className="text-green-400 whitespace-pre-wrap">{testResult.stdout}</pre>
                  )}
                  {testResult.stderr && (
                    <pre className="text-yellow-400 whitespace-pre-wrap">{testResult.stderr}</pre>
                  )}
                  {testResult.error && (
                    <pre className="text-argo-error whitespace-pre-wrap">{testResult.error}</pre>
                  )}
                  <div className={`text-[10px] font-bold ${testResult.exit_code === 0 ? 'text-green-400' : 'text-argo-error'}`}>
                    exit {testResult.exit_code}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog open={deleteConfirm} title="Delete tool"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        danger onConfirm={deleteTool} onCancel={() => setDeleteConfirm(false)} />
    </div>
  )
}
