import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, MoreHorizontal, Search, Star, Pin } from 'lucide-react'

const GROUPS = [
  { key: 'today', label: 'TODAY' },
  { key: 'yesterday', label: 'YESTERDAY' },
  { key: 'week', label: 'LAST 7 DAYS' },
  { key: 'older', label: 'OLDER' },
]

export default function ConversationSidebar({
  conversations = [],
  filteredGroupedConversations = {},
  activeId = null,
  searchQuery = '',
  setSearchQuery,
  pinnedIds,
  pin,
  unpin,
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

  const commitEdit = useCallback((id, value) => {
    const v = (value ?? editValue).trim()
    if (v) onRename?.(id, v)
    setEditingId(null)
    setMenuOpenId(null)
  }, [editValue, onRename])

  function handleKey(e, id) {
    if (e.key === 'Enter') commitEdit(id, e.currentTarget.value)
    if (e.key === 'Escape') setEditingId(null)
  }

  const s = {
    root: { width: 200, minWidth: 200, height: '100%', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, animation: 'slide-in-left 200ms var(--ease-out) both' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' },
    searchBar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' },
    scroll: { flex: 1, overflowY: 'auto' },
    groupLabel: { fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', padding: '8px 12px 4px' },
    dropdown: { position: 'absolute', top: '100%', right: 8, zIndex: 100, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.3)', minWidth: 110, overflow: 'hidden' },
    menuItem: { display: 'block', width: '100%', padding: '7px 12px', fontSize: 12, color: 'var(--text-secondary)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer' },
  }

  const pinnedConversations = conversations.filter((c) => pinnedIds?.has(c.id))

  function ConvItem({ conv }) {
    const active = conv.id === activeId
    const hovered = conv.id === hoveredId
    const menuOpen = conv.id === menuOpenId
    const editing = conv.id === editingId
    const isPinned = pinnedIds?.has(conv.id)

    return (
      <button
        key={conv.id}
        type="button"
        aria-current={active ? 'page' : undefined}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '7px 12px', cursor: 'pointer', borderLeft: active ? '2px solid var(--accent-cyan)' : '2px solid transparent', background: active ? 'rgba(0,212,255,.08)' : hovered ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--accent-cyan)' : 'var(--text-secondary)', userSelect: 'none', width: '100%', border: 'none', outline: 'none', textAlign: 'left', fontFamily: 'inherit' }}
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
            onBlur={(e) => commitEdit(conv.id, e.currentTarget.value)}
            onClick={(e) => e.stopPropagation()}
            style={{ flex: 1, fontSize: 12, background: 'var(--bg-elevated)', border: '1px solid var(--accent-cyan)', borderRadius: 3, color: 'var(--text-primary)', padding: '1px 4px', minWidth: 0 }}
          />
        ) : (
          <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{conv.title}</span>
        )}
        {!editing && (hovered || menuOpen) && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); isPinned ? unpin?.(conv.id) : pin?.(conv.id) }}
              title={isPinned ? 'Unpin' : 'Pin'}
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: isPinned ? 'var(--accent-cyan)' : 'var(--text-muted)', padding: 2, borderRadius: 3 }}
            >
              <Star size={11} fill={isPinned ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpen ? null : conv.id) }}
              title="Options"
              style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 3 }}
            >
              <MoreHorizontal size={12} />
            </button>
          </span>
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
      </button>
    )
  }

  return (
    <aside style={s.root}>
      <div style={s.header}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Conversations</span>
        <button
          type="button"
          onClick={onNew}
          title="New conversation"
          style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, borderRadius: 4 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-cyan)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Search input */}
      <div style={s.searchBar}>
        <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery?.(e.target.value)}
          placeholder="Search…"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit' }}
        />
      </div>

      <div style={s.scroll}>
        {/* Pinned section */}
        {pinnedConversations.length > 0 && (
          <div>
            <div style={{ ...s.groupLabel, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Star size={9} />
              PINNED
            </div>
            {pinnedConversations.map((conv) => (
              <ConvItem key={conv.id} conv={conv} />
            ))}
          </div>
        )}

        {/* Grouped conversations */}
        {GROUPS.map(({ key, label }) => {
          const items = (filteredGroupedConversations[key] || []).filter((c) => !pinnedIds?.has(c.id))
          if (!items.length) return null
          return (
            <div key={key}>
              <div style={s.groupLabel}>{label}</div>
              {items.map((conv) => (
                <ConvItem key={conv.id} conv={conv} />
              ))}
            </div>
          )
        })}

        {!conversations.length && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 8px', display: 'block' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              No conversations yet.<br />Start a new chat to begin.
            </p>
          </div>
        )}

        {conversations.length > 0 && searchQuery && !Object.values(filteredGroupedConversations).some((g) => g.length) && (
          <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
            No results for "{searchQuery}"
          </div>
        )}
      </div>
    </aside>
  )
}
