import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, FolderOpen, ChevronDown, ChevronRight, Terminal, GitBranch, Cpu, Clock, AlertCircle, X } from 'lucide-react'

const API = '/api/v1/tasks'

const STEPS = ['backlog', 'planning', 'implementation', 'review', 'done']
const STEP_LABEL = { backlog: 'bl', planning: 'pl', implementation: 'impl', review: 'rv', done: 'dn' }

const PRIORITY_COLOR = {
  high:   'var(--status-error)',
  medium: 'var(--status-warning)',
  low:    'var(--text-faint)',
}

const STATUS_CONFIG = {
  busy:          { label: 'BUSY',     color: 'var(--accent-cyan)',  dotClass: 'lane-beat', cardClass: 'lane-busy',    bg: 'rgba(0,212,255,0.04)',  border: 'rgba(0,212,255,0.22)' },
  starting:      { label: 'STARTING', color: 'var(--accent-cyan)',  dotClass: 'lane-beat', cardClass: 'lane-busy',    bg: 'rgba(0,212,255,0.03)',  border: 'rgba(0,212,255,0.16)' },
  awaiting_input:{ label: 'WAITING',  color: 'var(--accent-green)', dotClass: 'lane-beat', cardClass: 'lane-waiting', bg: 'rgba(0,255,157,0.04)',  border: 'rgba(0,255,157,0.22)' },
  stopped:       { label: 'STOPPED',  color: 'var(--text-muted)',   dotClass: '',          cardClass: '',             bg: 'var(--bg-elevated)',     border: 'var(--border)' },
  none:          { label: 'IDLE',     color: 'var(--text-faint)',   dotClass: '',          cardClass: '',             bg: 'var(--bg-elevated)',     border: 'var(--border)' },
}

// ── Elapsed timer hook ────────────────────────────────────────────────────────

function useElapsed(isActive) {
  const [secs, setSecs] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    setSecs(0)
    if (!isActive) { clearInterval(ref.current); return }
    ref.current = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(ref.current)
  }, [isActive])
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Progress track (5 dots) ───────────────────────────────────────────────────

function ProgressTrack({ step }) {
  const idx = STEPS.indexOf(step)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '10px 0 6px' }}>
      {STEPS.map((s, i) => {
        const done    = i < idx
        const active  = i === idx
        const future  = i > idx
        return (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 }}>
            <div style={{
              width: active ? 8 : 6,
              height: active ? 8 : 6,
              borderRadius: '50%',
              background: done ? 'var(--text-muted)' : active ? 'var(--accent-cyan)' : 'transparent',
              border: done ? 'none' : active ? '2px solid var(--accent-cyan)' : '1.5px solid var(--text-faint)',
              boxShadow: active ? '0 0 6px rgba(0,212,255,0.5)' : 'none',
              transition: 'all 200ms',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: 8,
              fontFamily: 'var(--f-mono)',
              color: active ? 'var(--accent-cyan)' : done ? 'var(--text-muted)' : 'var(--text-faint)',
              fontWeight: active ? 700 : 400,
              letterSpacing: '0.02em',
            }}>
              {STEP_LABEL[s]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Single lane card ──────────────────────────────────────────────────────────

function LaneCard({ task, isSelected, onSelect, onDelete, index }) {
  const [hover, setHover] = useState(false)
  const isActive = task.runtime_status === 'busy' || task.runtime_status === 'starting'
  const isWaiting = task.runtime_status === 'awaiting_input'
  const isLive = isActive || isWaiting
  const elapsed = useElapsed(isLive)
  const cfg = STATUS_CONFIG[task.runtime_status] ?? STATUS_CONFIG.none

  const branchShort = task.worktree_name
    ? task.worktree_name.replace('argo/', '').slice(0, 22)
    : null

  return (
    <div
      style={{
        animation: `fade-up 180ms var(--ease-out) ${index * 40}ms both`,
      }}
    >
      <button
        type="button"
        onClick={() => onSelect(task)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className={cfg.cardClass}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: isSelected ? `${cfg.bg}` : hover ? cfg.bg : 'var(--bg-elevated)',
          border: `1px solid ${isSelected ? cfg.border : hover ? cfg.border : 'var(--border)'}`,
          borderLeft: isSelected ? `3px solid ${cfg.color}` : `3px solid ${isLive ? cfg.color : 'transparent'}`,
          borderRadius: 'var(--r-md)',
          padding: '10px 11px 8px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 120ms, border-color 150ms',
          outline: 'none',
          marginBottom: 6,
        }}
      >
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 2 }}>
          {/* Priority dot */}
          {task.priority && task.priority !== 'low' && (
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0, marginTop: 5,
              background: PRIORITY_COLOR[task.priority],
            }} />
          )}
          <span style={{
            flex: 1,
            fontSize: 12,
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
            lineHeight: 1.4,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {task.title}
          </span>
          {/* Delete on hover — not selected */}
          {hover && !isSelected && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
              title="Delete task"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '1px', lineHeight: 1, flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={11} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Progress track */}
        <ProgressTrack step={task.step ?? 'backlog'} />

        {/* Status + meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {/* Status badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px', borderRadius: 999,
            background: `${cfg.color}14`,
            border: `1px solid ${cfg.color}30`,
            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
            color: cfg.color, fontFamily: 'var(--f-mono)',
          }}>
            <span
              className={cfg.dotClass}
              style={{
                width: 5, height: 5, borderRadius: '50%',
                background: cfg.color, flexShrink: 0,
              }}
            />
            {cfg.label}
          </span>

          {/* Elapsed timer — only when live */}
          {isLive && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)',
            }}>
              <Clock size={9} />
              {elapsed}
            </span>
          )}

          {/* Branch badge */}
          {branchShort && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)',
              maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <GitBranch size={9} />
              {branchShort}
            </span>
          )}
        </div>

        {/* Activity hint — only when live */}
        {isLive && (
          <div style={{
            marginTop: 8, paddingTop: 7,
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Terminal size={9} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{
              fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isWaiting ? 'awaiting your input…' : `running ${task.step ?? 'backlog'}`}
            </span>
          </div>
        )}
      </button>
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, color, collapsed, onToggle, live = false }) {
  return (
    <button
      type="button"
      aria-expanded={!collapsed}
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '5px 0 4px', margin: '8px 0 4px',
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', outline: 'none',
      }}
    >
      {collapsed
        ? <ChevronRight size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        : <ChevronDown  size={10} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      }
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color }}>
        {label}
      </span>
      {live && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%', background: color,
          boxShadow: `0 0 5px ${color}`,
          animation: 'status-beat 1.4s ease-in-out infinite',
          flexShrink: 0,
        }} />
      )}
      <span style={{
        fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)',
        background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '1px 5px',
        marginLeft: 2,
      }}>
        {count}
      </span>
    </button>
  )
}

// ── Add task inline ───────────────────────────────────────────────────────────

function AddTaskInline({ workspaceId, onAdd }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const ref = useRef(null)

  useEffect(() => { if (open) ref.current?.focus() }, [open])

  const submit = async (e) => {
    e.preventDefault()
    if (!title.trim()) return
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, title: title.trim(), step: 'backlog' }),
    }).catch(() => {})
    setTitle('')
    setOpen(false)
    onAdd()
  }

  if (!open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%', padding: '6px 8px',
        background: 'transparent', border: '1px dashed var(--border)',
        borderRadius: 'var(--r-md)', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: 11, fontFamily: 'inherit',
        transition: 'border-color 120ms, color 120ms',
        marginTop: 4,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-active)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <Plus size={11} strokeWidth={2} />
      New task
    </button>
  )

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 5, marginTop: 4 }}>
      <input
        ref={ref}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        placeholder="Task title…"
        style={{
          flex: 1, background: 'var(--bg-overlay)',
          border: '1px solid var(--border-active)', borderRadius: 'var(--r-sm)',
          padding: '5px 8px', fontSize: 12, color: 'var(--text-primary)',
          fontFamily: 'inherit',
        }}
      />
      <button
        type="submit"
        style={{
          background: 'var(--accent-grad)', color: '#001218',
          border: 'none', borderRadius: 'var(--r-sm)', padding: '5px 10px',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}
      >
        Add
      </button>
    </form>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyLanes({ onAddFolder }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '32px 20px', textAlign: 'center',
      animation: 'scale-in 200ms var(--ease-out) both',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 'var(--r-lg)',
        background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Cpu size={22} strokeWidth={1.2} style={{ color: 'var(--accent-cyan)', opacity: 0.7 }} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', margin: '0 0 4px' }}>
          No workspace selected
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          Add a repository folder to start<br />monitoring agent tasks
        </p>
      </div>
      <button
        type="button"
        onClick={onAddFolder}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 16px', borderRadius: 9999,
          background: 'transparent', border: '1px solid var(--accent-cyan)',
          color: 'var(--accent-cyan)', fontSize: 12, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,212,255,0.08)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        <FolderOpen size={13} strokeWidth={1.8} />
        Add Repository
      </button>
    </div>
  )
}

// ── AgentLanes (main export) ──────────────────────────────────────────────────

export function AgentLanes({ workspaceId, selectedId, onSelect, onAddFolder, refreshKey }) {
  const [tasks, setTasks] = useState([])
  const [doneCollapsed, setDoneCollapsed] = useState(true)
  const [queuedCollapsed, setQueuedCollapsed] = useState(false)

  const load = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}`)
      .then((r) => r.json())
      .then((d) => setTasks(Array.isArray(d) ? d : d?.items ?? []))
      .catch(() => {})
  }, [workspaceId])

  // Poll while any task is live
  useEffect(() => { load() }, [load, refreshKey])
  useEffect(() => {
    const hasLive = tasks.some((t) => t.runtime_status === 'busy' || t.runtime_status === 'starting' || t.runtime_status === 'awaiting_input')
    if (!hasLive) return
    const id = setInterval(load, 4000)
    return () => clearInterval(id)
  }, [tasks, load])

  const handleDelete = useCallback(async (id) => {
    await fetch(`${API}/${id}`, { method: 'DELETE' }).catch(() => {})
    load()
    if (selectedId === id) onSelect(null)
  }, [load, selectedId, onSelect])

  if (!workspaceId) {
    return (
      <div style={{ width: 268, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' }}>
        <EmptyLanes onAddFolder={onAddFolder} />
      </div>
    )
  }

  // Partition tasks
  const live    = tasks.filter((t) => ['busy', 'starting', 'awaiting_input'].includes(t.runtime_status))
  const queued  = tasks.filter((t) => !['busy', 'starting', 'awaiting_input'].includes(t.runtime_status) && (t.step ?? 'backlog') !== 'done')
  const done    = tasks.filter((t) => (t.step ?? 'backlog') === 'done')

  return (
    <div
      style={{
        width: 268, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slide-in-left 200ms var(--ease-out) both',
      }}
    >
      {/* Panel header */}
      <div style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>
            Agent Monitor
          </span>
          {live.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px',
              borderRadius: 999, background: 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.3)', color: 'var(--accent-cyan)',
              fontFamily: 'var(--f-mono)',
            }}>
              {live.length} live
            </span>
          )}
        </div>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)' }}>
          {tasks.length}
        </span>
      </div>

      {/* Scrollable lanes */}
      <div className="scroll-thin" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px 4px' }}>

        {/* ACTIVE section */}
        {live.length > 0 && (
          <div>
            <SectionHeader
              label="Active"
              count={live.length}
              color="var(--accent-cyan)"
              collapsed={false}
              onToggle={() => {}}
              live
            />
            {live.map((t, i) => (
              <LaneCard
                key={t.id}
                task={t}
                isSelected={t.id === selectedId}
                onSelect={onSelect}
                onDelete={handleDelete}
                index={i}
              />
            ))}
          </div>
        )}

        {/* QUEUED section */}
        {queued.length > 0 && (
          <div>
            <SectionHeader
              label="Queued"
              count={queued.length}
              color="var(--text-secondary)"
              collapsed={queuedCollapsed}
              onToggle={() => setQueuedCollapsed((c) => !c)}
            />
            {!queuedCollapsed && queued.map((t, i) => (
              <LaneCard
                key={t.id}
                task={t}
                isSelected={t.id === selectedId}
                onSelect={onSelect}
                onDelete={handleDelete}
                index={i}
              />
            ))}
          </div>
        )}

        {/* DONE section — collapsed by default */}
        {done.length > 0 && (
          <div>
            <SectionHeader
              label="Done"
              count={done.length}
              color="var(--accent-green)"
              collapsed={doneCollapsed}
              onToggle={() => setDoneCollapsed((c) => !c)}
            />
            {!doneCollapsed && done.map((t, i) => (
              <LaneCard
                key={t.id}
                task={t}
                isSelected={t.id === selectedId}
                onSelect={onSelect}
                onDelete={handleDelete}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Empty state when workspace selected but no tasks */}
        {tasks.length === 0 && (
          <div style={{
            padding: '32px 8px', textAlign: 'center',
            animation: 'fade-up 200ms var(--ease-out) both',
          }}>
            <AlertCircle size={24} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              No tasks yet.<br />Create one below to get started.
            </p>
          </div>
        )}

        {/* Add task */}
        <AddTaskInline workspaceId={workspaceId} onAdd={load} />
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 10px', borderTop: '1px solid var(--border)',
        display: 'flex', justifyContent: 'center', flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onAddFolder}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px', borderRadius: 9999,
            background: 'transparent', border: '1px solid var(--border-active)',
            color: 'var(--text-muted)', fontSize: 11, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'color 120ms, border-color 120ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-strong)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
        >
          <FolderOpen size={11} strokeWidth={1.8} />
          New Workspace
        </button>
      </div>
    </div>
  )
}
