import { useCallback, useEffect, useState } from 'react'

const API = '/api/v1/timeline'

const STATUS_COLORS = {
  pending: 'var(--warning)',
  committed: 'var(--success)',
  reverted: 'var(--text-dim)',
  error: 'var(--error)',
}

function DiffView({ diff }) {
  if (!diff) return <p style={{ fontSize: '12px', color: 'var(--text-dim)', padding: '16px' }}>No diff available</p>

  const lines = diff.split('\n')
  return (
    <div style={{ fontFamily: 'monospace', fontSize: '12px', lineHeight: 1.6, overflowX: 'auto' }}>
      {lines.map((line, i) => {
        let color = 'var(--text-secondary)'
        let bg = 'transparent'
        if (line.startsWith('+') && !line.startsWith('+++')) { color = '#22c55e'; bg = 'rgba(34,197,94,0.06)' }
        else if (line.startsWith('-') && !line.startsWith('---')) { color = '#ef4444'; bg = 'rgba(239,68,68,0.06)' }
        else if (line.startsWith('@@')) { color = '#00d4ff'; bg = 'rgba(0,212,255,0.05)' }
        else if (line.startsWith('diff') || line.startsWith('index')) { color = 'var(--text-dim)' }
        return (
          <div key={i} style={{ color, background: bg, padding: '0 12px', whiteSpace: 'pre' }}>{line}</div>
        )
      })}
    </div>
  )
}

function EntryRow({ entry, onSelect, selected }) {
  const isSelected = selected?.id === entry.id
  return (
    <button
      onClick={() => onSelect(entry)}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isSelected ? 'var(--bg-active)' : 'var(--bg-card)',
        border: `1px solid ${isSelected ? 'var(--border-strong)' : 'var(--border)'}`,
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        cursor: 'pointer',
        transition: 'border-color 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 600 }}>
          {entry.prompt?.slice(0, 70)}{entry.prompt?.length > 70 ? '…' : ''}
        </span>
        <span style={{ fontSize: '11px', color: STATUS_COLORS[entry.status] ?? 'var(--text-dim)', fontWeight: 600 }}>
          {entry.status}
        </span>
      </div>
      {entry.git_commit_hash && (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
          {entry.git_commit_hash.slice(0, 8)}
        </div>
      )}
      {entry.files_changed?.length > 0 && (
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
          {entry.files_changed.length} file{entry.files_changed.length !== 1 ? 's' : ''}
        </div>
      )}
    </button>
  )
}

export function ChangeTimeline({ workspaceId }) {
  const [entries, setEntries] = useState([])
  const [selected, setSelected] = useState(null)
  const [diff, setDiff] = useState(null)
  const [loadingDiff, setLoadingDiff] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [acting, setActing] = useState(false)

  const loadEntries = useCallback(() => {
    if (!workspaceId) return
    fetch(`${API}/${workspaceId}`).then((r) => r.json()).then(setEntries).catch(() => {})
  }, [workspaceId])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleSelect = async (entry) => {
    setSelected(entry)
    setDiff(null)
    setLoadingDiff(true)
    try {
      const res = await fetch(`${API}/${entry.id}/diff`)
      const data = await res.json()
      setDiff(data.diff)
    } finally {
      setLoadingDiff(false)
    }
  }

  const handleCommit = async () => {
    if (!selected) return
    setActing(true)
    try {
      const res = await fetch(`${API}/${selected.id}/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commit_message: commitMsg || undefined }),
      })
      const updated = await res.json()
      setSelected(updated)
      loadEntries()
    } finally {
      setActing(false)
    }
  }

  const handleRevert = async () => {
    if (!selected) return
    setActing(true)
    try {
      const res = await fetch(`${API}/${selected.id}/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const updated = await res.json()
      setSelected(updated)
      loadEntries()
    } finally {
      setActing(false)
    }
  }

  if (!workspaceId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Select a workspace to view the change timeline</p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left: entry list */}
      <div style={{ width: '280px', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.07em', textTransform: 'uppercase' }}>Change log</span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{entries.length}</span>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {entries.length === 0
            ? <p style={{ fontSize: '13px', color: 'var(--text-dim)', textAlign: 'center', marginTop: '32px' }}>No changes recorded</p>
            : entries.map((e) => <EntryRow key={e.id} entry={e} selected={selected} onSelect={handleSelect} />)
          }
        </div>
      </div>

      {/* Right: detail + diff */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selected ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-dim)' }}>Select an entry to view its diff</p>
          </div>
        ) : (
          <>
            {/* Actions bar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, flex: 1 }}>
                {selected.prompt?.slice(0, 60)}{selected.prompt?.length > 60 ? '…' : ''}
              </span>
              {selected.status === 'pending' && (
                <>
                  <input
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                    placeholder="Commit message (optional)"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', width: '200px' }}
                  />
                  <button
                    onClick={handleCommit}
                    disabled={acting}
                    style={{ background: 'var(--success)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: acting ? 0.6 : 1 }}
                  >
                    {acting ? '…' : 'Commit'}
                  </button>
                </>
              )}
              {selected.status === 'committed' && (
                <button
                  onClick={handleRevert}
                  disabled={acting}
                  style={{ background: 'transparent', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', padding: '5px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', opacity: acting ? 0.6 : 1 }}
                >
                  {acting ? '…' : 'Revert'}
                </button>
              )}
            </div>
            {/* Diff */}
            <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-card)' }}>
              {loadingDiff ? (
                <p style={{ padding: '16px', fontSize: '12px', color: 'var(--text-dim)' }}>Loading diff…</p>
              ) : (
                <DiffView diff={diff} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
