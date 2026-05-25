import { useCallback, useEffect, useState } from 'react'
import { LayoutDashboard } from 'lucide-react'
import { TerminalTab } from '../terminal/TerminalTab'
import { ChatView } from '../chat/ChatView'
import { useChat, STATUS } from '../../hooks/useChat'
import { useTaskSession } from '../../hooks/useTaskSession'

const TABS = [
  { id: 'terminal',    label: 'Terminal' },
  { id: 'chat',        label: 'Chat' },
  { id: 'description', label: 'Description' },
  { id: 'git',         label: 'Git Changes' },
  { id: 'history',     label: 'History' },
  { id: 'meta',        label: 'Meta' },
]

const STEP_LABELS = {
  backlog:        'Backlog',
  planning:       'Planning',
  implementation: 'Implementation',
  review:         'Review',
  done:           'Done',
  misc:           'Misc',
}

const PRIORITY_COLORS = {
  high:   '#ff4d6a',
  medium: '#ffb800',
  low:    '#8b8b95',
}

// ── Description tab ───────────────────────────────────────────────────────────

function DescriptionTab({ task, workspaceId, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [desc, setDesc] = useState(task.description || '')
  const [step, setStep] = useState(task.step || 'backlog')

  useEffect(() => {
    setTitle(task.title)
    setDesc(task.description || '')
    setStep(task.step || 'backlog')
  }, [task.id, task.title, task.description, task.step])

  const save = async () => {
    await fetch(`/api/v1/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description: desc, step }),
    })
    setEditing(false)
    onRefresh?.()
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="scroll-thin">
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ fontSize: 16, fontWeight: 600, background: 'var(--bg-overlay)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
          />
          <select
            value={step}
            onChange={(e) => setStep(e.target.value)}
            style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit' }}
          >
            {Object.entries(STEP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            rows={8}
            placeholder="Describe this issue…"
            style={{ resize: 'vertical', background: 'var(--bg-overlay)', border: '1px solid var(--border-active)', borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={save} style={{ background: 'var(--accent-grad)', color: '#001218', border: 'none', borderRadius: 8, padding: '7px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 18px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: 'var(--text-primary)', lineHeight: 1.3 }}>{task.title}</h2>
            <button onClick={() => setEditing(true)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              {STEP_LABELS[task.step] || task.step}
            </span>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, color: PRIORITY_COLORS[task.priority] || '#8b8b95', border: `1px solid ${PRIORITY_COLORS[task.priority] || '#4a4a55'}30` }}>
              {task.priority}
            </span>
          </div>
          {task.description ? (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{task.description}</p>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No description yet. Click Edit to add one.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Git Changes tab ───────────────────────────────────────────────────────────

function GitChangesTab({ task, workspaceId }) {
  const [diff, setDiff] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/workspaces/${workspaceId}/git-diff`)
      if (res.ok) setDiff(await res.text())
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Workspace diff</span>
        <button onClick={load} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>Refresh</button>
      </div>
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading diff…</span>}
        {!loading && !diff && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No uncommitted changes</span>}
        {!loading && diff && (
          <pre style={{ fontSize: 11, fontFamily: 'var(--f-mono)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
            {diff}
          </pre>
        )}
      </div>
    </div>
  )
}

// ── History tab ───────────────────────────────────────────────────────────────

function HistoryTab({ task, workspaceId }) {
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!workspaceId) return
    fetch(`/api/v1/change-log?workspace_id=${workspaceId}&limit=30`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setEntries(data?.items ?? []))
      .catch(() => {})
  }, [workspaceId])

  return (
    <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No history yet</span>}
      {entries.map((e) => (
        <div key={e.id} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{new Date(e.created_at).toLocaleString()}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{e.summary || e.description}</div>
        </div>
      ))}
    </div>
  )
}

// ── Meta tab ─────────────────────────────────────────────────────────────────

function MetaTab({ task }) {
  const fields = [
    ['ID',              task.id?.slice(0, 8)],
    ['Step',            STEP_LABELS[task.step] || task.step],
    ['Priority',        task.priority],
    ['Worktree',        task.worktree_path || '—'],
    ['Branch',          task.worktree_name || '—'],
    ['Base branch',     task.base_branch || '—'],
    ['External key',    task.external_key || '—'],
    ['External URL',    task.external_url || '—'],
    ['Created',         task.created_at ? new Date(task.created_at).toLocaleString() : '—'],
  ]

  return (
    <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <tbody>
          {fields.map(([k, v]) => (
            <tr key={k} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '7px 0', color: 'var(--text-muted)', width: 130, fontWeight: 500 }}>{k}</td>
              <td style={{ padding: '7px 0', color: 'var(--text-secondary)', fontFamily: v && v.startsWith('/') ? 'var(--f-mono)' : 'inherit', fontSize: v && v.length > 30 ? 11 : 12, wordBreak: 'break-all' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── IssueWorkspace root ───────────────────────────────────────────────────────

export function IssueWorkspace({ task, workspaceId, onTaskRefresh }) {
  const [tab, setTab] = useState('terminal')
  const chat = useChat()
  const { session } = useTaskSession(task?.id, workspaceId)

  const sendWithContext = useCallback(
    (msg) => chat.send(msg, workspaceId),
    [chat.send, workspaceId],
  )

  if (!task) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: 'var(--text-muted)' }}>
        <LayoutDashboard size={32} style={{ opacity: 0.4 }} />
        <span style={{ fontSize: 12 }}>Select an issue to get started</span>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Tab bar */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          flexShrink: 0,
          gap: 2,
        }}
      >
        {/* Issue title in tab bar */}
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginRight: 12,
            paddingRight: 12,
            borderRight: '1px solid var(--border)',
          }}
        >
          {task.title}
        </span>

        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              padding: '10px 12px 8px',
              fontSize: 12,
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? 'var(--accent-cyan)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 120ms',
              flexShrink: 0,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {tab === 'terminal' && (
          <TerminalTab key={task.id} taskId={task.id} cwd={task.cwd} />
        )}
        {tab === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatView
              messages={chat.messages}
              status={chat.status}
              error={chat.error}
              activeTools={chat.activeTools}
              stats={chat.stats}
              onSend={sendWithContext}
              onConfirm={chat.confirm}
              onCancel={chat.cancel}
              onReset={chat.reset}
              workspaceId={workspaceId}
            />
          </div>
        )}
        {tab === 'description' && (
          <DescriptionTab task={task} workspaceId={workspaceId} onRefresh={onTaskRefresh} />
        )}
        {tab === 'git' && (
          <GitChangesTab task={task} workspaceId={workspaceId} />
        )}
        {tab === 'history' && (
          <HistoryTab task={task} workspaceId={workspaceId} />
        )}
        {tab === 'meta' && (
          <MetaTab task={task} />
        )}
      </div>
    </div>
  )
}
