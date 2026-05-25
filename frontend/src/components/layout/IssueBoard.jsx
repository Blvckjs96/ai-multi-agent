import { useCallback, useEffect, useState } from 'react'
import { Plus, FolderOpen } from 'lucide-react'
import { IssueRow } from './IssueRow'

const API = '/api/v1/tasks'

const STEPS = [
  { id: 'backlog',        label: 'Backlog',         color: '#4a4a55' },
  { id: 'planning',       label: 'Planning',        color: '#c084fc' },
  { id: 'implementation', label: 'Implementation',  color: 'var(--accent-cyan)' },
  { id: 'review',         label: 'Review',          color: 'var(--status-warning)' },
  { id: 'done',           label: 'Done',            color: 'var(--accent-green)' },
  { id: 'misc',           label: 'Misc',            color: '#4a4a55' },
]

function AddIssueInline({ step, workspaceId, onAdd }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, title, step }),
    })
    setTitle('')
    setOpen(false)
    onAdd()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '4px 10px',
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          color: 'var(--text-muted)',
          fontSize: 11,
          cursor: 'pointer',
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> Add issue
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{ padding: '4px 8px', display: 'flex', gap: 4 }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Issue title…"
        style={{
          flex: 1,
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-active)',
          borderRadius: 6,
          padding: '4px 8px',
          fontSize: 12,
          color: 'var(--text-primary)',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      />
      <button
        type="submit"
        style={{ background: 'var(--accent-grad)', color: '#001218', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
      >
        Add
      </button>
    </form>
  )
}

function StepSection({ step, tasks, workspaceId, selectedId, onSelect, onDelete, onRefresh }) {
  const [collapsed, setCollapsed] = useState(step.id === 'done' || step.id === 'misc')

  return (
    <div>
      {/* Section header */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((c) => !c)}
        onKeyDown={(e) => e.key === 'Enter' && setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 10px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            transform: collapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 150ms',
            display: 'inline-block',
          }}
        >
          ▾
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: step.color }}>
          {step.label}
        </span>
        <span
          style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 999,
            padding: '1px 6px',
            fontFamily: 'var(--f-mono)',
          }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Issues list */}
      {!collapsed && (
        <div style={{ paddingBottom: 4 }}>
          {tasks.map((t) => (
            <IssueRow
              key={t.id}
              task={t}
              isSelected={t.id === selectedId}
              onClick={() => onSelect(t)}
              onDelete={onDelete}
            />
          ))}
          <AddIssueInline step={step.id} workspaceId={workspaceId} onAdd={onRefresh} />
        </div>
      )}
    </div>
  )
}

export function IssueBoard({ workspaceId, selectedId, onSelect }) {
  const [tasks, setTasks] = useState([])

  const load = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}`)
      .then((r) => r.json())
      .then((data) => setTasks(Array.isArray(data) ? data : data?.items ?? []))
      .catch(() => {})
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const handleDelete = useCallback(async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' }).catch(() => {})
    load()
    if (selectedId === id) onSelect(null)
  }, [load, selectedId, onSelect])

  const byStep = (stepId) =>
    tasks
      .filter((t) => (t.step ?? 'backlog') === stepId)
      .sort((a, b) => (a.sort_order ?? a.position ?? 0) - (b.sort_order ?? b.position ?? 0))

  if (!workspaceId) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <FolderOpen size={32} color="var(--text-muted)" strokeWidth={1.5} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
          No repository folder selected
        </span>
        <button
          onClick={() => {}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid var(--accent-cyan)',
            color: 'var(--accent-cyan)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Repository Folder
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Board header */}
      <div
        style={{
          padding: '10px 12px 8px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>Issues</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)' }}>{tasks.length}</span>
      </div>

      {/* Sections */}
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
        {STEPS.map((step) => (
          <StepSection
            key={step.id}
            step={step}
            tasks={byStep(step.id)}
            workspaceId={workspaceId}
            selectedId={selectedId}
            onSelect={onSelect}
            onDelete={handleDelete}
            onRefresh={load}
          />
        ))}
      </div>

      {/* FAB Button */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
        <button
          onClick={() => {}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 16px',
            borderRadius: 9999,
            background: 'transparent',
            border: '1px solid var(--accent-cyan)',
            color: 'var(--accent-cyan)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Repository Folder
        </button>
      </div>
    </div>
  )
}
