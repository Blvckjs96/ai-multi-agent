import { useCallback, useEffect, useState } from 'react'

const API = '/api/v1/tasks'

const COLUMNS = [
  { id: 'todo',        label: 'Backlog',      accent: '#4a4a55' },
  { id: 'in_progress', label: 'In Progress',  accent: 'var(--accent-cyan)' },
  { id: 'review',      label: 'Review',       accent: 'var(--status-warning)' },
  { id: 'done',        label: 'Done',         accent: 'var(--accent-green)' },
]

const PRIORITY_COLORS = {
  low:    { fg: 'var(--text-muted)',    bg: 'transparent' },
  medium: { fg: 'var(--status-warning)', bg: 'rgba(255,184,0,0.08)' },
  high:   { fg: 'var(--status-error)',   bg: 'rgba(255,77,106,0.08)' },
}

// ── Tag palette matching the design spec ──────────────────────────────────────

const TAG_PALETTE = {
  frontend: { fg: '#00d4ff', bg: 'rgba(0,212,255,0.08)', bd: 'rgba(0,212,255,0.22)' },
  backend:  { fg: '#00ff9d', bg: 'rgba(0,255,157,0.08)', bd: 'rgba(0,255,157,0.22)' },
  research: { fg: '#c084fc', bg: 'rgba(192,132,252,0.08)', bd: 'rgba(192,132,252,0.22)' },
  infra:    { fg: '#ffb800', bg: 'rgba(255,184,0,0.08)', bd: 'rgba(255,184,0,0.22)' },
  bug:      { fg: '#ff4d6a', bg: 'rgba(255,77,106,0.08)', bd: 'rgba(255,77,106,0.22)' },
  docs:     { fg: '#8b8b95', bg: 'rgba(255,255,255,0.04)', bd: 'rgba(255,255,255,0.1)' },
}

function Tag({ name }) {
  const c = TAG_PALETTE[name?.toLowerCase()] || TAG_PALETTE.docs
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
      padding: '2px 7px', borderRadius: 4,
      color: c.fg, background: c.bg, border: `1px solid ${c.bd}`,
    }}>{name}</span>
  )
}

function TaskCard({ task, onMove, onDelete }) {
  const [hover, setHover] = useState(false)
  const isDone = task.status === 'done'
  const isActive = task.status === 'in_progress'
  const pColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${hover ? 'var(--border-active)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '12px 12px 10px',
        boxShadow: 'var(--sh-1)',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 120ms',
      }}
    >
      {/* Active card gradient top strip */}
      {isActive && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent-grad)' }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: task.tags ? 6 : 0 }}>
        <span style={{
          fontSize: 13, fontWeight: 500, lineHeight: 1.4,
          color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)',
          textDecoration: isDone ? 'line-through' : 'none',
        }}>{task.title}</span>
        {task.priority && (
          <span style={{
            fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
            padding: '2px 6px', borderRadius: 4, flexShrink: 0,
            color: pColor.fg, background: pColor.bg,
          }}>{task.priority}</span>
        )}
      </div>

      {/* Tag row */}
      {task.tags && (
        <div style={{ display: 'flex', gap: 5, marginBottom: 6, flexWrap: 'wrap' }}>
          {String(task.tags).split(',').map((t) => <Tag key={t} name={t.trim()} />)}
        </div>
      )}

      {task.description && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
          {task.description.slice(0, 80)}{task.description.length > 80 ? '…' : ''}
        </p>
      )}

      {/* Move / delete actions on hover */}
      {hover && (
        <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
          {COLUMNS.filter((c) => c.id !== task.status).map((c) => (
            <button
              key={c.id}
              onClick={() => onMove(task.id, c.id)}
              style={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                padding: '2px 8px',
                fontSize: 11,
                color: c.accent,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              → {c.label}
            </button>
          ))}
          <button
            onClick={() => onDelete(task.id)}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: '1px solid rgba(255,77,106,0.25)',
              borderRadius: 'var(--r-sm)',
              padding: '2px 8px',
              fontSize: 11,
              color: 'var(--status-error)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

function AddTaskInline({ columnId, workspaceId, onAdd }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('medium')

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, title, status: columnId, priority }),
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
          width: '100%',
          background: 'transparent',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          padding: '10px 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          cursor: 'pointer',
          textAlign: 'center',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        + Add task
      </button>
    )
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title…"
        style={{
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-active)',
          borderRadius: 'var(--r-sm)',
          padding: '7px 10px',
          fontSize: 13,
          color: 'var(--text-primary)',
          outline: 'none',
          width: '100%',
          fontFamily: 'inherit',
        }}
      />
      <div style={{ display: 'flex', gap: 4 }}>
        {['low', 'medium', 'high'].map((p) => {
          const c = PRIORITY_COLORS[p]
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              style={{
                flex: 1,
                background: priority === p ? c.bg : 'transparent',
                border: `1px solid ${priority === p ? c.fg : 'var(--border)'}`,
                borderRadius: 'var(--r-sm)',
                padding: '3px 0',
                fontSize: 11,
                color: c.fg,
                cursor: 'pointer',
                fontWeight: priority === p ? 700 : 400,
                textTransform: 'capitalize',
                fontFamily: 'inherit',
              }}
            >{p}</button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button type="submit" style={{ flex: 1, background: 'var(--accent-grad)', color: '#001218', border: 'none', borderRadius: 'var(--r-sm)', padding: '5px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
        <button type="button" onClick={() => setOpen(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', padding: '5px 0', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
      </div>
    </form>
  )
}

function Column({ col, tasks, workspaceId, onMove, onDelete, onAdd }) {
  return (
    <div style={{
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: 12,
      minHeight: 0,
    }}>
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 6px', flexShrink: 0 }}>
        <span style={{ width: 6, height: 6, borderRadius: 2, background: col.accent, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{col.label}</span>
        <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-secondary)', padding: '1px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.04)' }}>{tasks.length}</span>
      </div>

      {/* Task list */}
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 4 }}>
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onMove={onMove} onDelete={onDelete} />
        ))}
        <AddTaskInline columnId={col.id} workspaceId={workspaceId} onAdd={onAdd} />
      </div>
    </div>
  )
}

export function TaskBoard({ workspaceId }) {
  const [tasks, setTasks] = useState([])

  const loadTasks = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}`).then((r) => r.json()).then(setTasks).catch(() => {})
  }, [workspaceId])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleMove = async (taskId, newStatus) => {
    await fetch(`${API}/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    loadTasks()
  }

  const handleDelete = async (taskId) => {
    await fetch(`${API}/${taskId}`, { method: 'DELETE' })
    loadTasks()
  }

  if (!workspaceId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a workspace to view tasks</div>
      </div>
    )
  }

  const byStatus = (status) => tasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Board header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <h2 className="display" style={{ fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: '-0.025em' }}>Tasks</h2>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Columns */}
      <div style={{ flex: 1, display: 'flex', gap: 12, padding: 16, overflow: 'hidden' }}>
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            col={col}
            tasks={byStatus(col.id)}
            workspaceId={workspaceId}
            onMove={handleMove}
            onDelete={handleDelete}
            onAdd={loadTasks}
          />
        ))}
      </div>
    </div>
  )
}
