import { useState, useEffect, useCallback } from 'react'
import { Check, X } from 'lucide-react'
import ModelSelector from './ModelSelector'
import { apiFetch } from '../../lib/api'

const PROVIDER_TYPES = [
  { value: 'ollama', label: 'Ollama', needsUrl: true, needsKey: false, placeholder: 'http://localhost:11434', hint: 'Local Ollama server running on your machine' },
  { value: 'anthropic', label: 'Anthropic API', needsUrl: false, needsKey: true, placeholder: 'sk-ant-…', hint: 'Direct Anthropic API access' },
  { value: 'openai_compatible', label: 'OpenAI-compatible', needsUrl: true, needsKey: true, placeholder: 'https://api.openai.com/v1', hint: 'Any OpenAI-compatible endpoint (vLLM, LM Studio, etc.)' },
  { value: 'nim', label: 'NVIDIA NIM', needsUrl: false, needsKey: true, placeholder: 'nvapi-…', hint: 'NVIDIA NIM cloud API' },
]

const EMPTY_FORM = { name: '', provider_type: 'ollama', host_url: '', api_key: '', model_name: '', is_enabled: true, is_default: false }


export default function ProviderConfigTab() {
  const [configs, setConfigs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [error, setError] = useState(null)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/providers/configs')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setConfigs(data.items || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfigs() }, [loadConfigs])

  const providerMeta = (type) => PROVIDER_TYPES.find((p) => p.value === type) || PROVIDER_TYPES[0]

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  const openEdit = (config) => {
    setForm({
      name: config.name,
      provider_type: config.provider_type,
      host_url: config.host_url || '',
      api_key: '',
      model_name: config.model_name || '',
      is_enabled: config.is_enabled,
      is_default: config.is_default,
    })
    setEditId(config.id)
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        provider_type: form.provider_type,
        host_url: form.host_url.trim() || null,
        api_key: form.api_key.trim() || null,
        model_name: form.model_name.trim() || null,
        is_enabled: form.is_enabled,
        is_default: form.is_default,
      }
      const url = editId ? `/api/v1/providers/configs/${editId}` : '/api/v1/providers/configs'
      const method = editId ? 'PATCH' : 'POST'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setShowForm(false)
      await loadConfigs()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this provider?')) return
    try {
      await apiFetch(`/api/v1/providers/configs/${id}`, { method: 'DELETE' })
      await loadConfigs()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleTest = async (id) => {
    setTesting(id)
    try {
      const res = await apiFetch(`/api/v1/providers/configs/${id}/test`, { method: 'POST' })
      const data = await res.json()
      setTestResults((prev) => ({ ...prev, [id]: data }))
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: 'Network error' } }))
    } finally {
      setTesting(null)
    }
  }

  const meta = providerMeta(form.provider_type)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Claude model section */}
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Claude Model
          </h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>like /model in Claude Code</span>
        </div>
        <ModelSelector compact={false} />
      </section>

      {/* Custom providers section */}
      <section>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Custom Providers
          </h3>
          <button
            className="btn btn-ghost"
            onClick={openAdd}
            style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add Provider
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: '8px 12px',
              background: 'rgba(255,77,106,0.08)',
              border: '1px solid rgba(255,77,106,0.2)',
              borderRadius: 'var(--r-md)',
              color: 'var(--status-error)',
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            {error}{' '}
            <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 12 }}>✕</button>
          </div>
        )}

        {loading && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Loading…
          </div>
        )}

        {!loading && configs.length === 0 && !showForm && (
          <div
            style={{
              padding: '20px 16px',
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--r-md)',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 12,
            }}
          >
            No custom providers yet.
            <br />
            <button
              onClick={openAdd}
              style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', fontSize: 12 }}
            >
              + Add your first provider
            </button>
          </div>
        )}

        {!loading && configs.map((config) => {
          const result = testResults[config.id]
          const isTesting = testing === config.id
          return (
            <div
              key={config.id}
              style={{
                padding: '12px 14px',
                background: 'var(--bg-surface)',
                border: `1px solid ${config.is_enabled ? 'var(--border)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: 'var(--r-md)',
                marginBottom: 8,
                opacity: config.is_enabled ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {config.name}
                    </span>
                    {config.is_default && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          color: 'var(--accent-cyan)',
                          padding: '2px 6px',
                          border: '1px solid rgba(0,212,255,0.3)',
                          borderRadius: 999,
                          background: 'rgba(0,212,255,0.08)',
                        }}
                      >
                        Default
                      </span>
                    )}
                    {!config.is_enabled && (
                      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Disabled</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {config.provider_type}
                    {config.host_url && ` · ${config.host_url}`}
                    {config.model_name && ` · ${config.model_name}`}
                    {config.api_key_set && ' · API key set'}
                  </div>
                  {result && (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 11,
                        color: result.ok ? 'var(--status-success)' : 'var(--status-error)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}
                    >
                      {result.ok
                        ? <><Check size={11} strokeWidth={2.5} />Reachable{result.latency_ms != null ? ` (${result.latency_ms}ms)` : ''}</>
                        : <><X size={11} strokeWidth={2.5} />{result.error}</>}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleTest(config.id)}
                    disabled={isTesting}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    {isTesting ? '…' : 'Test'}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => openEdit(config)}
                    style={{ fontSize: 11, padding: '3px 8px' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() => handleDelete(config.id)}
                    style={{ fontSize: 11, padding: '3px 8px', color: 'var(--status-error)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* Add/Edit form */}
        {showForm && (
          <div
            style={{
              padding: '16px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--accent-cyan)',
              borderRadius: 'var(--r-md)',
              marginTop: 8,
            }}
          >
            <h4 style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              {editId ? 'Edit Provider' : 'Add Provider'}
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Provider type */}
              <div>
                <label style={labelStyle}>Provider Type</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {PROVIDER_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      onClick={() => setForm((f) => ({ ...f, provider_type: pt.value }))}
                      style={{
                        padding: '4px 10px',
                        fontSize: 11,
                        border: `1px solid ${form.provider_type === pt.value ? 'var(--accent-cyan)' : 'var(--border)'}`,
                        borderRadius: 999,
                        background: form.provider_type === pt.value ? 'rgba(0,212,255,0.1)' : 'none',
                        color: form.provider_type === pt.value ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: form.provider_type === pt.value ? 600 : 400,
                      }}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{meta.hint}</div>
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>Display Name *</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="My Ollama, Work API…"
                />
              </div>

              {/* URL */}
              {meta.needsUrl && (
                <div>
                  <label style={labelStyle}>Host URL</label>
                  <input
                    style={inputStyle}
                    value={form.host_url}
                    onChange={(e) => setForm((f) => ({ ...f, host_url: e.target.value }))}
                    placeholder={meta.placeholder}
                  />
                </div>
              )}

              {/* API key */}
              {meta.needsKey && (
                <div>
                  <label style={labelStyle}>API Key {editId && '(leave blank to keep existing)'}</label>
                  <input
                    style={inputStyle}
                    type="password"
                    value={form.api_key}
                    onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                    placeholder={meta.placeholder}
                    autoComplete="off"
                  />
                </div>
              )}

              {/* Model name */}
              <div>
                <label style={labelStyle}>Default Model (optional)</label>
                <input
                  style={inputStyle}
                  value={form.model_name}
                  onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                  placeholder="gemma4:31b, gpt-4o, llama3.3…"
                />
              </div>

              {/* Flags */}
              <div style={{ display: 'flex', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_enabled}
                    onChange={(e) => setForm((f) => ({ ...f, is_enabled: e.target.checked }))}
                  />
                  Enabled
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.is_default}
                    onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
                  />
                  Set as default
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowForm(false)}
                style={{ fontSize: 12 }}
              >
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                style={{
                  fontSize: 12,
                  padding: '6px 16px',
                  background: 'var(--accent-cyan)',
                  color: '#000',
                  border: 'none',
                  borderRadius: 'var(--r-sm)',
                  cursor: saving ? 'wait' : 'pointer',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Saving…' : editId ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 5,
}

const inputStyle = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg-base)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text-primary)',
  fontSize: 12,
  fontFamily: 'var(--f-mono)',
  boxSizing: 'border-box',
}
