import { useCallback, useRef, useState } from 'react'

// ── WorkspaceTabs ─────────────────────────────────────────────────────────────
// Horizontal scrollable tab bar for open workspaces.
// Props: openWorkspaces, activeId, all, onSwitch, onClose, onCreate

function AddForm({ all, openIds, onOpen, onCreate, onDismiss }) {
  const [tab, setTab]     = useState('existing') // 'existing' | 'new'
  const [form, setForm]   = useState({ name: '', path: '' })
  const [busy, setBusy]   = useState(false)
  const nameRef           = useRef(null)

  const available = all.filter((ws) => !openIds.includes(ws.id))

  const submitNew = useCallback(async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.path.trim()) return
    setBusy(true)
    try {
      await onCreate(form.name.trim(), form.path.trim())
      onDismiss()
    } catch {
      setBusy(false)
    }
  }, [form, onCreate, onDismiss])

  const inputSx = {
    background:   'var(--bg-overlay)',
    border:       '1px solid var(--border-active)',
    borderRadius: 5,
    padding:      '3px 8px',
    fontSize:     11,
    color:        'var(--text-primary)',
    outline:      'none',
    fontFamily:   'inherit',
  }

  return (
    <div style={{
      position:      'absolute',
      top:           '100%',
      left:          0,
      zIndex:        200,
      background:    'var(--bg-surface)',
      border:        '1px solid var(--border)',
      borderRadius:  8,
      boxShadow:     '0 8px 24px rgba(0,0,0,0.5)',
      padding:       12,
      minWidth:      280,
    }}>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: 'var(--bg-elevated)', borderRadius: 6, padding: 3 }}>
        {['existing', 'new'].map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 500,
            padding: '3px 0', cursor: 'pointer', fontFamily: 'inherit',
            background: tab === t ? 'var(--bg-overlay)' : 'transparent',
            color:      tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {t === 'existing' ? 'Open existing' : 'New workspace'}
          </button>
        ))}
      </div>

      {tab === 'existing' ? (
        available.length === 0 ? (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', margin: '8px 0' }}>
            All workspaces already open
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {available.map((ws) => (
              <button key={ws.id} onClick={() => { onOpen(ws.id); onDismiss() }} style={{
                background:   'transparent',
                border:       '1px solid transparent',
                borderRadius: 5,
                padding:      '5px 8px',
                textAlign:    'left',
                cursor:       'pointer',
                color:        'var(--text-secondary)',
                fontSize:     11,
                fontFamily:   'inherit',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-overlay)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ws.name}</span>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 10, color: 'var(--text-muted)', display: 'block', marginTop: 1 }}>{ws.path}</span>
              </button>
            ))}
          </div>
        )
      ) : (
        <form onSubmit={submitNew} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <input
            ref={nameRef}
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Workspace name"
            style={{ ...inputSx, width: '100%', boxSizing: 'border-box' }}
          />
          <input
            value={form.path}
            onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
            placeholder="/path/to/repo"
            style={{ ...inputSx, width: '100%', boxSizing: 'border-box', fontFamily: 'var(--f-mono)', fontSize: 10 }}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDismiss} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={busy} style={{ background: 'var(--accent-grad)', border: 'none', borderRadius: 5, padding: '4px 12px', fontSize: 11, fontWeight: 700, color: '#001218', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}


export function WorkspaceTabs({ openWorkspaces, activeId, all, openIds, onSwitch, onClose, onCreate, onOpen }) {
  const [adding, setAdding] = useState(false)

  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      height:         32,
      background:     'var(--bg-elevated)',
      borderBottom:   '1px solid var(--border)',
      flexShrink:     0,
      overflowX:      'auto',
      position:       'relative',
      WebkitAppRegion:'no-drag',
    }}>
      {/* Workspace tabs */}
      {openWorkspaces.map((ws) => {
        const active = ws.id === activeId
        return (
          <div
            key={ws.id}
            onClick={() => onSwitch(ws.id)}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         5,
              height:      '100%',
              padding:     '0 10px',
              borderRight: '1px solid var(--border)',
              background:  active ? 'var(--bg-surface)' : 'transparent',
              borderBottom: active ? '2px solid var(--accent-cyan)' : '2px solid transparent',
              cursor:      'pointer',
              flexShrink:  0,
              userSelect:  'none',
            }}
          >
            {/* Activity dot */}
            <span style={{
              width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: active ? 'var(--accent-cyan)' : 'var(--text-muted)',
              boxShadow: active ? '0 0 4px var(--accent-cyan)' : 'none',
            }} />
            <span style={{
              fontSize:   11,
              fontWeight: active ? 600 : 400,
              color:      active ? 'var(--text-primary)' : 'var(--text-secondary)',
              maxWidth:   120,
              overflow:   'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {ws.name}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(ws.id) }}
              title="Close tab"
              style={{
                background:   'transparent',
                border:       'none',
                color:        'var(--text-muted)',
                cursor:       'pointer',
                fontSize:     13,
                lineHeight:   1,
                padding:      '0 2px',
                borderRadius: 3,
                display:      'flex',
                alignItems:   'center',
              }}
            >
              ×
            </button>
          </div>
        )
      })}

      {/* Add workspace button */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setAdding((v) => !v)}
          title="Open workspace"
          style={{
            background:  'transparent',
            border:      'none',
            color:       adding ? 'var(--accent-cyan)' : 'var(--text-muted)',
            cursor:      'pointer',
            height:      32,
            width:       32,
            fontSize:    18,
            display:     'flex',
            alignItems:  'center',
            justifyContent: 'center',
            flexShrink:  0,
          }}
        >
          +
        </button>

        {adding && (
          <>
            {/* Click-away overlay */}
            <div
              onClick={() => setAdding(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            />
            <AddForm
              all={all}
              openIds={openIds}
              onOpen={onOpen}
              onCreate={onCreate}
              onDismiss={() => setAdding(false)}
            />
          </>
        )}
      </div>
    </div>
  )
}
