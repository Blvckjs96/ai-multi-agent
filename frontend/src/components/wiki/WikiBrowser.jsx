import { useCallback, useEffect, useState } from 'react'
import { Search, RefreshCw, FilePlus2, Folder, FolderOpen, FileText, ChevronRight, ChevronDown } from 'lucide-react'
import WikiPage from './WikiPage'
import WikiSearch from './WikiSearch'

const API = '/api/v1/argon'

function groupByPrefix(pages) {
  const groups = {}
  for (const p of pages) {
    const parts = (p.slug || '').split('/')
    const prefix = parts.length > 1 ? parts[0] : '__root__'
    if (!groups[prefix]) groups[prefix] = []
    groups[prefix].push(p)
  }
  return groups
}

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
  },
  toolbar: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  searchBtn: {
    flex: 1, display: 'flex', alignItems: 'center', gap: '8px',
    background: 'var(--bg-overlay)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', padding: '5px 10px', cursor: 'pointer',
    fontSize: '12px', color: 'var(--text-dim)', transition: 'border-color 150ms',
  },
  iconBtn: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    padding: '5px 8px', cursor: 'pointer', fontSize: '13px',
    color: 'var(--text-secondary)', transition: 'border-color 150ms, color 150ms',
  },
  layout: {
    display: 'flex', flex: 1, overflow: 'hidden',
  },
  tree: {
    width: '220px', flexShrink: 0, borderRight: '1px solid var(--border)',
    overflow: 'auto', padding: '8px 0',
  },
  content: {
    flex: 1, overflow: 'hidden',
  },
  groupHeader: {
    padding: '4px 14px', fontSize: '10px', fontWeight: 700,
    color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.07em',
    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
    userSelect: 'none',
  },
  treeItem: {
    padding: '4px 14px 4px 24px', fontSize: '12px', cursor: 'pointer',
    color: 'var(--text-secondary)', transition: 'color 100ms, background 100ms',
    display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1.4,
    borderRadius: 0,
  },
  loading: {
    padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-dim)',
  },
  empty: {
    padding: '24px', textAlign: 'center', fontSize: '13px', color: 'var(--text-dim)',
  },
}

export default function WikiBrowser({ workspaceId }) {
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState(null)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [showSearch, setShowSearch] = useState(false)

  const loadPages = useCallback(() => {
    setLoading(true)
    const params = workspaceId ? `?scope_type=project&scope_id=${workspaceId}` : ''
    fetch(`${API}/wiki/pages${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => { setPages(Array.isArray(data) ? data : []) })
      .catch(() => setPages([]))
      .finally(() => setLoading(false))
  }, [workspaceId])

  useEffect(() => { loadPages() }, [loadPages])

  const groups = groupByPrefix(pages)
  const prefixes = Object.keys(groups).sort((a, b) =>
    a === '__root__' ? -1 : b === '__root__' ? 1 : a.localeCompare(b)
  )

  const toggleGroup = (prefix) =>
    setCollapsedGroups((prev) => ({ ...prev, [prefix]: !prev[prefix] }))

  const handleSelect = (page) => setSelectedSlug(page.slug)

  return (
    <div style={s.root}>
      <div style={s.toolbar}>
        <button
          style={s.searchBtn}
          onClick={() => setShowSearch(true)}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-strong)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <Search size={12} />
          <span>Search pages…</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', opacity: 0.5 }}>⌘K</span>
        </button>
        <button
          style={s.iconBtn}
          title="Refresh"
          onClick={loadPages}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} />
        </button>
        <button
          style={{ ...s.iconBtn, color: 'var(--accent)', borderColor: 'var(--border-accent)' }}
          title="New page"
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-soft)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <FilePlus2 size={13} />
        </button>
      </div>

      <div style={s.layout}>
        <nav style={s.tree} aria-label="Wiki pages">
          {loading && <div style={s.loading}>Loading…</div>}
          {!loading && pages.length === 0 && (
            <div style={s.empty}>No wiki pages yet</div>
          )}
          {!loading && prefixes.map((prefix) => {
            const isRoot = prefix === '__root__'
            const isCollapsed = collapsedGroups[prefix]
            const groupPages = groups[prefix]

            return (
              <div key={prefix}>
                {!isRoot && (
                  <div
                    style={s.groupHeader}
                    onClick={() => toggleGroup(prefix)}
                    role="button"
                    aria-expanded={!isCollapsed}
                  >
                    {isCollapsed ? <ChevronRight size={10} style={{ opacity: 0.6, flexShrink: 0 }} /> : <ChevronDown size={10} style={{ opacity: 0.6, flexShrink: 0 }} />}
                    {isCollapsed ? <Folder size={12} style={{ flexShrink: 0 }} /> : <FolderOpen size={12} style={{ flexShrink: 0 }} />}
                    <span>{prefix}</span>
                  </div>
                )}
                {!isCollapsed && groupPages.map((page) => {
                  const label = isRoot ? page.title : page.title
                  const isActive = page.slug === selectedSlug
                  return (
                    <div
                      key={page.slug}
                      style={{
                        ...s.treeItem,
                        paddingLeft: isRoot ? '14px' : '28px',
                        background: isActive ? 'var(--bg-active)' : 'transparent',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                      onClick={() => setSelectedSlug(page.slug)}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <FileText size={11} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </nav>

        <main style={s.content}>
          <WikiPage
            slug={selectedSlug}
            scopeType={workspaceId ? 'project' : undefined}
            scopeId={workspaceId}
            onBack={selectedSlug ? () => setSelectedSlug(null) : undefined}
          />
        </main>
      </div>

      {showSearch && (
        <WikiSearch
          onSelect={handleSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  )
}
