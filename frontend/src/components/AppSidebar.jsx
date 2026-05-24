import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare, LayoutDashboard, BookOpen, GitGraph,
  Clock, GitBranch, Network, Layers, Settings, Plus,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

const WORKSPACE_ITEMS = [
  { id: 'chat',       label: 'Chat',      icon: MessageSquare },
  { id: 'tasks',      label: 'Issues',    icon: LayoutDashboard },
  { id: 'chiron',     label: 'Knowledge', icon: BookOpen },
  { id: 'codegraph',  label: 'Codegraph', icon: GitGraph },
  { id: 'timeline',   label: 'Timeline',  icon: Clock },
  { id: 'github',     label: 'GitHub',    icon: GitBranch },
]

const SYSTEM_ITEMS = [
  { id: 'argorouter', label: 'Router',    icon: Network },
  { id: 'providers',  label: 'Providers', icon: Layers },
]

const logoBoxStyle = {
  width: 24, height: 24,
  background: 'var(--accent-grad)',
  borderRadius: 6,
  flexShrink: 0,
}

const logoTextStyle = {
  fontFamily: 'var(--f-display)',
  fontSize: 16,
  fontWeight: 700,
  background: 'var(--accent-grad)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  whiteSpace: 'nowrap',
}

const sectionLabelStyle = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.08em',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  padding: '0 12px',
  margin: '16px 0 4px',
  whiteSpace: 'nowrap',
  transition: 'opacity 200ms ease-out',
}

function NavItem({ item, active, collapsed, onModeChange }) {
  const [hovered, setHovered] = useState(false)
  const Icon = item.icon

  const handleClick = useCallback(() => onModeChange(item.id), [item.id, onModeChange])

  const containerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: collapsed ? 0 : 10,
    padding: collapsed ? '8px' : '8px 12px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    cursor: 'pointer',
    borderLeft: active ? '2px solid var(--accent-cyan)' : '2px solid transparent',
    fontSize: 13,
    fontWeight: 500,
    transition: 'all 120ms ease-out',
    background: active
      ? 'rgba(0, 212, 255, 0.10)'
      : hovered ? 'var(--bg-elevated)' : 'transparent',
    color: active
      ? 'var(--accent-cyan)'
      : hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
    userSelect: 'none',
  }

  const labelStyle = {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    opacity: collapsed ? 0 : 1,
    maxWidth: collapsed ? 0 : 140,
    transition: 'opacity 200ms ease-out, max-width 200ms ease-out',
  }

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
      <span style={labelStyle}>{item.label}</span>
    </div>
  )
}

export default function AppSidebar({ mode, onModeChange }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('argo_nav_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const [settingsHovered, setSettingsHovered] = useState(false)
  const [newChatHovered, setNewChatHovered] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('argo_nav_collapsed', String(collapsed))
    } catch {}
  }, [collapsed])

  const toggleCollapsed = useCallback(() => setCollapsed(c => !c), [])
  const handleNewChat = useCallback(() => onModeChange('chat'), [onModeChange])

  const sidebarStyle = {
    width: collapsed ? 52 : 220,
    transition: 'width 250ms cubic-bezier(0.16, 1, 0.3, 1)',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    height: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0,
  }

  const logoRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '16px 12px 12px',
    flexShrink: 0,
  }

  const toggleBtnStyle = {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-sm)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 120ms ease-out, color 120ms ease-out',
  }

  const newChatStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    margin: '8px 10px',
    padding: '6px 12px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--accent-cyan)',
    background: newChatHovered ? 'rgba(0,212,255,0.12)' : 'rgba(0,212,255,0.05)',
    color: 'var(--accent-cyan)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    opacity: collapsed ? 0 : 1,
    pointerEvents: collapsed ? 'none' : 'auto',
    transition: 'opacity 200ms ease-out, background 120ms ease-out',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  }

  const settingsBtnStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px',
    cursor: 'pointer',
    color: settingsHovered ? 'var(--text-primary)' : 'var(--text-muted)',
    background: settingsHovered ? 'var(--bg-elevated)' : 'transparent',
    transition: 'all 120ms ease-out',
    flexShrink: 0,
  }

  const navScrollStyle = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
  }

  return (
    <aside style={sidebarStyle}>
      <div style={logoRowStyle}>
        <div style={logoBoxStyle} />
        <span style={{ ...logoTextStyle, opacity: collapsed ? 0 : 1, transition: 'opacity 200ms ease-out' }}>
          Argo
        </span>
        <button style={toggleBtnStyle} onClick={toggleCollapsed} title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed
            ? <ChevronRight size={14} />
            : <ChevronLeft size={14} />
          }
        </button>
      </div>

      <div style={newChatStyle}
        onClick={handleNewChat}
        onMouseEnter={() => setNewChatHovered(true)}
        onMouseLeave={() => setNewChatHovered(false)}
      >
        <Plus size={13} strokeWidth={2.2} />
        New Chat
      </div>

      <nav style={navScrollStyle}>
        <div style={{ ...sectionLabelStyle, opacity: collapsed ? 0 : 1 }}>Workspace</div>
        {WORKSPACE_ITEMS.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={mode === item.id}
            collapsed={collapsed}
            onModeChange={onModeChange}
          />
        ))}

        <div style={{ ...sectionLabelStyle, opacity: collapsed ? 0 : 1, marginTop: 20 }}>System</div>
        {SYSTEM_ITEMS.map(item => (
          <NavItem
            key={item.id}
            item={item}
            active={mode === item.id}
            collapsed={collapsed}
            onModeChange={onModeChange}
          />
        ))}
      </nav>

      <div
        style={settingsBtnStyle}
        onClick={() => {}}
        onMouseEnter={() => setSettingsHovered(true)}
        onMouseLeave={() => setSettingsHovered(false)}
        title="Settings"
      >
        <Settings size={16} strokeWidth={1.8} />
      </div>
    </aside>
  )
}
