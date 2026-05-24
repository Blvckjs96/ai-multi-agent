import { useState, useEffect, useRef } from 'react'
import { Plus, MoreHorizontal } from 'lucide-react'

const GROUPS = [
  { key: 'today', label: 'TODAY' },
  { key: 'yesterday', label: 'YESTERDAY' },
  { key: 'week', label: 'LAST 7 DAYS' },
  { key: 'older', label: 'OLDER' },
]

export default function ConversationSidebar({
  conversations = [],
  groupedConversations = {},
  activeId = null,
  onSelect,
  onNew,
  onRename,
  onDelete,
}) {
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [hoveredId, setHoveredId] = useState(null)
  const menuRef = useRef(null)
  const editRef = useRef(null)

  useEffect(() => {
    if (!menuOpenId) return
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpenId])

  useEffect(() => {
    if (editingId) editRef.current?.focus()
  }, [editingId])

  function startEdit(conv) {
    setMenuOpenId(null)
    setEditingId(conv.id)
    setEditValue(conv.title)
  }

  function commitEdit(id) {
    const v = editValue.trim()
    if (v) onRename?.(id, v)
    setEditingId(null)
  }

  function handleKey(e, id) {
    if (e.key === 'Enter') commitEdit(id)
    if (e.key === 'Escape') setEditingId(null)
  }

  const s = {
    root: { width: 200, minWidth: 200, height: '100dvh', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' },
    scroll: { flex: 1, overflowY: 'auto' },
    groupLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '8px 12px 4px' },
    dropdown: { position: 'absolute', top: '100%', right: 8, zIndex: 100, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.3)', minWidth: 110, overflow: 'hidden' },
    menuItem: { display: 'block', width: '100%', padding: '7px 12px', fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' },
  }

  return (
    <aside style={s.root}>
      <div style={s.header}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conversations</span>
        <button
          onClick={onNew}
          title="New conversation"
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Plus size={14} />
        </button>
      </div>

      <div style={s.scroll}>
        {GROUPS.map(({ key, label }) => {
          const items = groupedConversations[key] || []
          if (!items.length) return null
          return (
            <div key={key}>
              <div style={s.groupLabel}>{label}</div>
              {items.map((conv) => {
                const active = conv.id === activeId
                const hovered = conv.id === hoveredId
                const menuOpen = conv.id === menuOpenId
                const editing = conv.id === editingId
                return (
                  <div
                    key={conv.id}
                    style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '7px 12px', cursor: 'pointer', borderLeft: active ? '2px solid var(--accent-cyan)' : '2px solid transparent', background: active ? 'rgba(0,212,255,.08)' : hovered ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', userSelect: 'none' }}
                    onMouseEnter={() => setHoveredId(conv.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => !editing && onSelect?.(conv.id)}
                    onContextMenu={(e) => { e.preventDefault(); setMenuOpenId(conv.id) }}
                  >
                    {editing ? (
                      <input
                        ref={editRef}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => handleKey(e, conv.id)}
                        onBlur={() => commitEdit(conv.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ flex: 1, fontSize: 12, background: 'var(--bg-elevated)', border: '1px solid var(--accent-cyan)', borderRadius: 3, color: 'var(--text-primary)', padding: '1px 4px', outline: 'none', minWidth: 0 }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{conv.title}</span>
                    )}
                    {!editing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : conv.id) }}
                        style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1, borderRadius: 3, flexShrink: 0, opacity: hovered || menuOpen ? 1 : 0 }}
                        title="Options"
                      >
                        <MoreHorizontal size={12} />
                      </button>
                    )}
                    {menuOpen && (
                      <div ref={menuRef} style={s.dropdown} onClick={(e) => e.stopPropagation()}>
                        <button
                          style={s.menuItem}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          onClick={() => startEdit(conv)}
                        >Rename</button>
                        <button
                          style={{ ...s.menuItem, color: 'var(--color-error, #ff4d4f)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,77,79,.1)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          onClick={() => { setMenuOpenId(null); onDelete?.(conv.id) }}
                        >Delete</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
        {!conversations.length && (
          <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No conversations yet</div>
        )}
      </div>
    </aside>
  )
}
