import { useCallback, useEffect, useState } from 'react'
import {
  MessageSquare, LayoutDashboard, BookOpen, GitGraph,
  Clock, GitBranch, Network, Layers, Settings, Plus,
  ChevronLeft, FileText, Zap, BarChart2, ThumbsUp,
} from 'lucide-react'

const WORKSPACE_ITEMS = [
  { id: 'chat',        label: 'Chat',        icon: MessageSquare },
  { id: 'tasks',       label: 'Issues',      icon: LayoutDashboard },
  { id: 'knowledge',   label: 'Knowledge',   icon: BookOpen },
  { id: 'notes',       label: 'Notes',       icon: FileText },
  { id: 'codegraph',   label: 'Codegraph',   icon: GitGraph },
  { id: 'timeline',    label: 'Timeline',    icon: Clock },
  { id: 'github',      label: 'GitHub',      icon: GitBranch },
]

const PLATFORM_ITEMS = [
  { id: 'automations',  label: 'Automations', icon: Zap },
  { id: 'analytics',    label: 'Analytics',   icon: BarChart2 },
  { id: 'evaluations',  label: 'Evaluations', icon: ThumbsUp },
  { id: 'argorouter',   label: 'Router',      icon: Network },
  { id: 'providers',    label: 'Providers',   icon: Layers },
]

function NavItem({ item, active, collapsed, onModeChange }) {
  const Icon = item.icon

  return (
    <button
      type="button"
      title={collapsed ? item.label : undefined}
      onClick={() => onModeChange(item.id)}
      className={[
        'flex items-center w-full transition-all duration-100 border-l-2 select-none',
        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-2',
        active
          ? 'border-argo-cyan bg-cyan-500/10 text-argo-cyan'
          : 'border-transparent text-argo-secondary hover:bg-argo-elevated hover:text-argo-primary',
      ].join(' ')}
    >
      <Icon size={15} strokeWidth={1.8} className="flex-shrink-0" />
      {!collapsed && (
        <span className="text-[13px] font-medium truncate">{item.label}</span>
      )}
    </button>
  )
}

function SectionLabel({ label, collapsed }) {
  if (collapsed) {
    return <div className="my-2 mx-2 border-t border-argo-border" />
  }
  return (
    <p className="px-3 mt-4 mb-1 text-[10px] font-bold tracking-widest uppercase text-argo-muted select-none">
      {label}
    </p>
  )
}

export default function AppSidebar({ mode, onModeChange }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('argo_nav_collapsed') === 'true' } catch { return false }
  })
  const [newChatHovered, setNewChatHovered] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('argo_nav_collapsed', String(collapsed)) } catch {}
  }, [collapsed])

  const toggle = useCallback(() => setCollapsed((c) => !c), [])

  return (
    <aside
      className="flex flex-col h-dvh bg-argo-surface border-r border-argo-border flex-shrink-0 overflow-hidden"
      style={{
        width: collapsed ? 52 : 220,
        transition: 'width 250ms cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Logo row */}
      <div className="flex items-center gap-2 px-3 py-4 flex-shrink-0">
        <div
          className="w-6 h-6 rounded-md flex-shrink-0"
          style={{
            background: 'var(--accent-grad)',
            cursor: collapsed ? 'pointer' : 'default',
          }}
          onClick={collapsed ? toggle : undefined}
          title={collapsed ? 'Expand sidebar' : undefined}
        />
        {!collapsed && (
          <>
            <span
              className="text-base font-bold overflow-hidden whitespace-nowrap"
              style={{
                background: 'var(--accent-grad)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                maxWidth: 120,
                transition: 'opacity 200ms ease-out, max-width 250ms cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              Argo
            </span>
            <button
              type="button"
              onClick={toggle}
              className="ml-auto w-6 h-6 flex items-center justify-center rounded border border-argo-border text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft size={12} />
            </button>
          </>
        )}
      </div>

      {/* New Chat button — only visible when expanded */}
      <div
        style={{
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
          transition: 'opacity 200ms ease-out',
        }}
      >
        <button
          type="button"
          onClick={() => onModeChange('chat')}
          onMouseEnter={() => setNewChatHovered(true)}
          onMouseLeave={() => setNewChatHovered(false)}
          className="mx-2 mb-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-argo-cyan text-argo-cyan text-xs font-semibold transition-colors w-[calc(100%-16px)]"
          style={{ background: newChatHovered ? 'rgba(0,212,255,0.10)' : 'rgba(0,212,255,0.04)' }}
        >
          <Plus size={12} strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Navigation */}
      <nav
        aria-label="Primary navigation"
        className="flex-1 overflow-y-auto overflow-x-hidden"
      >
        <SectionLabel label="Workspace" collapsed={collapsed} />
        {WORKSPACE_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={mode === item.id}
            collapsed={collapsed}
            onModeChange={onModeChange}
          />
        ))}

        <SectionLabel label="Platform" collapsed={collapsed} />
        {PLATFORM_ITEMS.map((item) => (
          <NavItem
            key={item.id}
            item={item}
            active={mode === item.id}
            collapsed={collapsed}
            onModeChange={onModeChange}
          />
        ))}
      </nav>

      {/* Settings footer */}
      <button
        type="button"
        onClick={() => onModeChange('settings')}
        title={collapsed ? 'Settings' : undefined}
        className={[
          'flex items-center gap-2.5 w-full border-t border-argo-border px-3 py-3',
          'text-argo-muted hover:text-argo-primary hover:bg-argo-elevated transition-colors',
          collapsed ? 'justify-center' : '',
        ].join(' ')}
        style={{ background: 'none', border: 'none', borderTop: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', outline: 'none' }}
      >
        <Settings size={15} strokeWidth={1.8} />
        {!collapsed && <span className="text-[13px] font-medium">Settings</span>}
      </button>
    </aside>
  )
}
