# UI Redesign — Collapsible Side Nav + Chat History + Pipeline Inline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the horizontal tab-bar layout with a collapsible side nav, add a Claude Desktop-style conversation history sidebar inside the Chat tab, and integrate pipeline progress inline in chat bubbles with animations.

**Architecture:** `AppSidebar` replaces `WorkspaceBar` as the primary nav — rendered once at the root. When `mode === 'chat'`, a `ConversationSidebar` appears as a second panel. Pipeline tab is removed from the nav; pipeline output remains accessible via the existing `PipelinePanel` but is no longer in `PRIMARY_MODES`. Conversation metadata is persisted in `localStorage` via a `useConversations` hook.

**Tech Stack:** React 18, Lucide React (already installed), CSS custom properties (existing design tokens), localStorage for conversation persistence.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| **Create** | `src/components/AppSidebar.jsx` | Collapsible side nav (220px ↔ 52px) |
| **Create** | `src/components/chat/ConversationSidebar.jsx` | Conversation history panel (Chat tab only) |
| **Create** | `src/hooks/useConversations.js` | localStorage CRUD for conversation metadata |
| **Modify** | `src/App.jsx` | Remove `WorkspaceBar`, add `AppSidebar`, rewire layout |
| **Modify** | `src/components/chat/ChatView.jsx` | Add typing indicator, remove terminal toggle header |
| **Modify** | `src/components/chat/ChatInput.jsx` | Add Paperclip (file) button |
| **Modify** | `src/components/layout/IssueBoard.jsx` | Add bottom-center FAB "+" for repo folder |
| **Modify** | `src/index.css` | Add animation keyframes |

---

## Task 1: Add CSS animation keyframes

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Add keyframes after the existing CSS in `src/index.css`**

Append before the final closing brace (or at the end of the file):

```css
/* ── Argo chat animations ─────────────────────────────────────────── */

@keyframes argo-typing-bounce {
  0%, 60%, 100% { transform: translateY(0);   opacity: 0.35; }
  30%            { transform: translateY(-5px); opacity: 1; }
}

@keyframes argo-dot-pulse {
  0%, 100% { opacity: 1;   transform: scale(1); }
  50%      { opacity: 0.5; transform: scale(0.8); }
}

@keyframes argo-spin {
  to { transform: rotate(360deg); }
}

@keyframes argo-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Verify app still builds**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "style: add chat animation keyframes (typing, pulse, spin, fade-in)"
```

---

## Task 2: Create `useConversations` hook

**Files:**
- Create: `src/hooks/useConversations.js`

This hook stores conversation metadata in `localStorage`. Each conversation has: `id`, `title`, `createdAt`. It does NOT store messages (those live in `useChat` state).

- [ ] **Step 1: Create the file**

```js
// src/hooks/useConversations.js
import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'argo_conversations'
const MAX = 50

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX)))
}

export function useConversations() {
  const [conversations, setConversations] = useState(load)

  // Keep in sync when another tab writes
  useEffect(() => {
    const handler = () => setConversations(load())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  /** Call this when the user sends the first message of a new chat. */
  const addConversation = useCallback((id, title) => {
    setConversations((prev) => {
      const next = [
        { id, title: title.slice(0, 60), createdAt: new Date().toISOString() },
        ...prev.filter((c) => c.id !== id),
      ]
      save(next)
      return next
    })
  }, [])

  /** Remove a conversation by id. */
  const removeConversation = useCallback((id) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id)
      save(next)
      return next
    })
  }, [])

  /** Rename a conversation. */
  const renameConversation = useCallback((id, title) => {
    setConversations((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, title: title.slice(0, 60) } : c))
      save(next)
      return next
    })
  }, [])

  return { conversations, addConversation, removeConversation, renameConversation }
}
```

- [ ] **Step 2: Verify it parses (no build errors)**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useConversations.js
git commit -m "feat: add useConversations hook with localStorage persistence"
```

---

## Task 3: Create `AppSidebar` component

**Files:**
- Create: `src/components/AppSidebar.jsx`

This replaces `WorkspaceBar`. It reads collapse state from localStorage and emits `onMode` + `onNewChat`.

- [ ] **Step 1: Create the file**

```jsx
// src/components/AppSidebar.jsx
import { useCallback, useState } from 'react'
import {
  MessageSquare, LayoutDashboard, BookOpen, GitGraph,
  Clock, GitBranch, Network, Layers, Settings,
  ChevronLeft, ChevronRight, Plus,
} from 'lucide-react'

const NAV_ITEMS = [
  { id: 'chat',       label: 'Chat',       icon: MessageSquare },
  { id: 'tasks',      label: 'Issues',     icon: LayoutDashboard },
  { id: 'chiron',     label: 'Knowledge',  icon: BookOpen },
  { id: 'codegraph',  label: 'Codegraph',  icon: GitGraph },
  { id: 'timeline',   label: 'Timeline',   icon: Clock },
  { id: 'github',     label: 'GitHub',     icon: GitBranch },
]

const SYSTEM_ITEMS = [
  { id: 'argorouter', label: 'Router',    icon: Network },
  { id: 'providers',  label: 'Providers', icon: Layers },
]

const COLLAPSED_WIDTH = 52
const EXPANDED_WIDTH  = 220

function loadCollapsed() {
  try { return localStorage.getItem('argo_nav_collapsed') === 'true' } catch { return false }
}

export function AppSidebar({ mode, onMode, onNewChat }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed)

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('argo_nav_collapsed', String(next))
      return next
    })
  }, [])

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH

  /* ── shared item renderer ─────────────────────────────── */
  function NavItem({ item }) {
    const Icon = item.icon
    const active = mode === item.id
    return (
      <button
        key={item.id}
        onClick={() => onMode(item.id)}
        title={collapsed ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: collapsed ? 0 : 9,
          width: collapsed ? 36 : 'calc(100% - 12px)',
          margin: collapsed ? '2px auto' : '1px 6px',
          padding: collapsed ? '8px 0' : '6px 10px',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 7,
          border: active ? '1px solid rgba(0,255,157,0.2)' : '1px solid transparent',
          background: active ? 'rgba(0,255,157,0.08)' : 'transparent',
          color: active ? 'var(--accent-green)' : 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'background 120ms, color 120ms',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: active ? 600 : 400,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <Icon size={15} strokeWidth={active ? 2.2 : 1.8} style={{ flexShrink: 0 }} />
        {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>}
      </button>
    )
  }

  return (
    <aside
      style={{
        width,
        flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        transition: 'width 240ms cubic-bezier(.4,0,.2,1)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          padding: collapsed ? 0 : '0 10px 0 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' }}>
            <div
              style={{
                width: 22, height: 22,
                borderRadius: 7,
                background: 'var(--accent-grad)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 800, color: '#001218',
                letterSpacing: '-0.02em',
                flexShrink: 0,
              }}
            >
              A
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Argo</span>
          </div>
        )}
        {collapsed && (
          <div
            style={{
              width: 28, height: 28,
              borderRadius: 8,
              background: 'var(--accent-grad)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#001218',
            }}
          >
            A
          </div>
        )}
        <button
          onClick={toggleCollapse}
          title={collapsed ? 'Mở rộng' : 'Thu gọn'}
          style={{
            width: 24, height: 24,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
            WebkitAppRegion: 'no-drag',
            marginLeft: collapsed ? 0 : 0,
          }}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 0' : '8px 0', display: 'flex', flexDirection: 'column' }}>
        {!collapsed && (
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)', padding: '4px 16px 3px', margin: 0 }}>
            Workspace
          </p>
        )}
        {collapsed && <div style={{ height: 4 }} />}
        {NAV_ITEMS.map((item) => <NavItem key={item.id} item={item} />)}

        <div style={{ height: 1, background: 'var(--border)', margin: '8px 10px' }} />

        {!collapsed && (
          <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)', padding: '4px 16px 3px', margin: 0 }}>
            System
          </p>
        )}
        {SYSTEM_ITEMS.map((item) => <NavItem key={item.id} item={item} />)}
      </div>

      {/* Footer */}
      <div style={{ padding: collapsed ? '8px 0' : '8px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Settings */}
        <button
          onClick={() => onMode('settings')}
          title="Settings"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 9,
            width: collapsed ? 36 : '100%',
            margin: collapsed ? '0 auto' : 0,
            padding: collapsed ? '7px 0' : '6px 10px',
            borderRadius: 7,
            border: mode === 'settings' ? '1px solid rgba(0,255,157,0.2)' : '1px solid transparent',
            background: mode === 'settings' ? 'rgba(0,255,157,0.08)' : 'transparent',
            color: mode === 'settings' ? 'var(--accent-green)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
          }}
        >
          <Settings size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Settings</span>}
        </button>

        {/* New Chat */}
        <button
          onClick={onNewChat}
          title={collapsed ? 'New Chat' : undefined}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
            gap: collapsed ? 0 : 7,
            width: collapsed ? 36 : '100%',
            margin: collapsed ? '0 auto' : 0,
            padding: collapsed ? '7px 0' : '7px 10px',
            borderRadius: 7,
            border: '1px solid rgba(0,212,255,0.25)',
            background: 'rgba(0,212,255,0.08)',
            color: 'var(--accent-cyan)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
          }}
        >
          <Plus size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AppSidebar.jsx
git commit -m "feat: add AppSidebar — collapsible side nav (220px <-> 52px icon rail)"
```

---

## Task 4: Create `ConversationSidebar` component

**Files:**
- Create: `src/components/chat/ConversationSidebar.jsx`

- [ ] **Step 1: Create the file**

```jsx
// src/components/chat/ConversationSidebar.jsx
import { useCallback, useState } from 'react'
import { Plus, Trash2, Pencil } from 'lucide-react'

function formatRelative(iso) {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function groupByDate(conversations) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] }
  for (const c of conversations) {
    const d = new Date(c.createdAt)
    if (d >= today)         groups.Today.push(c)
    else if (d >= yesterday) groups.Yesterday.push(c)
    else if (d >= weekAgo)   groups['Previous 7 days'].push(c)
    else                     groups.Older.push(c)
  }
  return groups
}

export function ConversationSidebar({
  conversations,
  activeId,
  onNewChat,
  onSelect,
  onRemove,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [hoveredId, setHoveredId] = useState(null)

  const groups = groupByDate(conversations)

  const startEdit = useCallback((c, e) => {
    e.stopPropagation()
    setEditingId(c.id)
    setEditTitle(c.title)
  }, [])

  const commitEdit = useCallback(() => {
    if (editTitle.trim()) onRename(editingId, editTitle.trim())
    setEditingId(null)
  }, [editTitle, editingId, onRename])

  const handleDelete = useCallback((id, e) => {
    e.stopPropagation()
    onRemove(id)
  }, [onRemove])

  return (
    <aside
      style={{
        width: 200,
        flexShrink: 0,
        background: 'var(--bg-base)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'argo-fade-in 180ms ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.02em' }}>
          Conversations
        </span>
        <button
          onClick={onNewChat}
          title="New chat"
          style={{
            width: 22, height: 22,
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.22)',
            borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--accent-cyan)',
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {conversations.length === 0 && (
          <p style={{ padding: '20px 12px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
            No conversations yet. Start typing to begin.
          </p>
        )}

        {Object.entries(groups).map(([groupLabel, items]) => {
          if (items.length === 0) return null
          return (
            <div key={groupLabel}>
              <p style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.1em', color: 'var(--text-muted)',
                padding: '8px 12px 3px', margin: 0,
              }}>
                {groupLabel}
              </p>
              {items.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onSelect(c)}
                  onMouseEnter={() => setHoveredId(c.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    padding: '5px 10px',
                    margin: '1px 4px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: activeId === c.id ? 'rgba(0,212,255,0.08)' : hoveredId === c.id ? 'var(--bg-hover)' : 'transparent',
                    border: activeId === c.id ? '1px solid rgba(0,212,255,0.18)' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {editingId === c.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border-active)',
                        borderRadius: 4, padding: '2px 6px', fontSize: 11, color: 'var(--text-primary)',
                        outline: 'none', fontFamily: 'inherit',
                      }}
                    />
                  ) : (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: activeId === c.id ? 'var(--text-primary)' : 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                        {formatRelative(c.createdAt)}
                      </div>
                    </div>
                  )}

                  {/* Action buttons on hover */}
                  {hoveredId === c.id && editingId !== c.id && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={(e) => startEdit(c, e)} style={{ width: 18, height: 18, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, padding: 0 }}>
                        <Pencil size={10} />
                      </button>
                      <button onClick={(e) => handleDelete(c.id, e)} style={{ width: 18, height: 18, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3, padding: 0 }}>
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify no import errors**

```bash
cd frontend && npm run build 2>&1 | grep -E "error|Error" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/ConversationSidebar.jsx
git commit -m "feat: add ConversationSidebar — grouped history with rename/delete"
```

---

## Task 5: Refactor `App.jsx` — swap WorkspaceBar for AppSidebar

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the entire `App.jsx`**

The key changes:
1. Remove `WorkspaceBar` component and its `PRIMARY_MODES` constant
2. Remove `pipeline` from the modes (keep `PipelinePanel` import but unused in nav)
3. `ChatPanel` now accepts `conversations`, `activeConvId`, `onNewChat`, `onSelectConv`, `onRemove`, `onRename` props
4. Root layout is now `flex-row` (sidebar + content) not `flex-column` (topbar + content)

```jsx
import { useCallback, useEffect, useState } from 'react'

// Pipeline mode (kept for direct access, not in nav)
import { AgentCard } from './components/AgentCard'
import { InputForm } from './components/InputForm'
import { saveRunToHistory } from './components/Sidebar'
import { SpecOutput } from './components/SpecOutput'
import { usePipeline } from './hooks/usePipeline'

// Chat mode
import { ChatView } from './components/chat/ChatView'
import { TerminalView } from './components/chat/TerminalView'
import { useChat, STATUS } from './hooks/useChat'
import { ConversationSidebar } from './components/chat/ConversationSidebar'
import { useConversations } from './hooks/useConversations'

// Panels
import WikiPanel from './components/wiki/WikiPanel'
import { ChironPanel } from './components/chiron/ChironPanel'
import { ChangeTimeline } from './components/timeline/ChangeTimeline'
import { GitHubPanel } from './components/github/GitHubPanel'
import ProvidersPanel from './components/providers/ProvidersPanel'
import SettingsPanel from './components/settings/SettingsPanel'
import ArgorouterPanel from './components/argorouter/ArgorouterPanel'
import CodegraphPanel from './components/codegraph/CodegraphPanel'

// Layout
import { IssueBoard } from './components/layout/IssueBoard'
import { IssueWorkspace } from './components/layout/IssueWorkspace'
import { WorkspaceTabs } from './components/WorkspaceTabs'
import { useWorkspace } from './hooks/useWorkspace'

// New side nav
import { AppSidebar } from './components/AppSidebar'

const AGENT_NAMES = ['planner', 'engineer', 'cost_estimator', 'writer']

// ── ChatPanel ─────────────────────────────────────────────────────────────────

function ChatPanel({ workspaceId, conversations, activeConvId, onNewChat, onSelectConv, onRemove, onRename }) {
  const chat = useChat()

  const sendWithWorkspace = useCallback(
    (msg) => {
      // Register conversation on first message
      const convId = crypto.randomUUID()
      if (chat.messages.length === 0) {
        onNewChat(convId, msg)
      }
      chat.send(msg, workspaceId)
    },
    [chat, workspaceId, onNewChat],
  )

  const handleNewChat = useCallback(() => {
    chat.reset()
    onNewChat(null, null) // signal new chat started
  }, [chat, onNewChat])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConvId}
        onNewChat={handleNewChat}
        onSelect={(c) => { chat.reset(); onSelectConv(c) }}
        onRemove={onRemove}
        onRename={onRename}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <ChatView
          messages={chat.messages}
          status={chat.status}
          error={chat.error}
          activeTools={chat.activeTools}
          stats={chat.stats}
          onSend={sendWithWorkspace}
          onConfirm={chat.confirm}
          onCancel={chat.cancel}
          onReset={handleNewChat}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  )
}

// ── PipelinePanel ─────────────────────────────────────────────────────────────

function PipelinePanel() {
  const { agents, spec, isRunning, error, pipelineStats, runPipeline, reset } = usePipeline()
  const [description, setDescription] = useState('')

  const handleSubmit = useCallback(async (desc) => {
    setDescription(desc)
    saveRunToHistory(desc)
    window.dispatchEvent(new Event('pipeline_history_updated'))
    await runPipeline(desc)
  }, [runPipeline])

  const handleNewRun = useCallback(() => { reset(); setDescription('') }, [reset])
  const hasActivity = Object.values(agents).some((a) => a.status === 'thinking' || a.status === 'done')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      <div style={{ flex: 1, padding: '32px 28px 48px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px', width: '100%', margin: '0 auto' }}>
        {!hasActivity && !error && (
          <div style={{ textAlign: 'center', padding: '48px 0 24px' }}>
            <h1 className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8, background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>What should we build?</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Describe your project and four AI agents will produce a full specification.</p>
          </div>
        )}
        {hasActivity && description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '-0.01em', borderLeft: '2px solid var(--border-active)', paddingLeft: 12 }}>
            {description.slice(0, 100)}{description.length > 100 ? '…' : ''}
          </div>
        )}
        <InputForm onSubmit={handleSubmit} isRunning={isRunning} initialValue={description} />
        {pipelineStats && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Tokens in', value: pipelineStats.tokensBefore.toLocaleString() },
              { label: 'Compressed', value: pipelineStats.tokensAfter.toLocaleString(), badge: pipelineStats.tokensBefore > pipelineStats.tokensAfter ? `−${Math.round((1 - pipelineStats.tokensAfter / pipelineStats.tokensBefore) * 100)}%` : null },
              { label: 'RAG chunks', value: pipelineStats.ragChunks, dim: pipelineStats.ragChunks === 0 },
            ].map(({ label, value, badge, dim }) => (
              <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12, color: dim ? 'var(--text-muted)' : 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>{label}:</span>
                <span style={{ fontWeight: 600, color: dim ? 'var(--text-muted)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                {badge && <span style={{ color: 'var(--accent-cyan)', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
              </div>
            ))}
          </div>
        )}
        {error && (
          <div role="alert" style={{ background: 'var(--error-soft)', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: 'var(--status-error)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <div><strong style={{ display: 'block', marginBottom: 2 }}>Pipeline error</strong>{error}</div>
          </div>
        )}
        {hasActivity && (
          <section>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Agent Pipeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AGENT_NAMES.map((name) => <AgentCard key={name} name={name} status={agents[name].status} result={agents[name].result} provider={agents[name].provider} />)}
            </div>
            <button onClick={handleNewRun} style={{ marginTop: 12, background: 'transparent', border: '1px solid var(--border-active)', color: 'var(--text-secondary)', padding: '5px 14px', borderRadius: 'var(--r-lg)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ New run</button>
          </section>
        )}
        {spec && (
          <section>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Generated Specification</p>
            <SpecOutput spec={spec} />
          </section>
        )}
        {!hasActivity && !error && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            {['SaaS todo app', 'E-commerce API', 'Real-time chat service', 'Mobile fitness tracker'].map((label) => (
              <button key={label} onClick={() => setDescription(label)} style={{ background: 'transparent', border: '1px solid var(--border-active)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 'var(--r-lg)', fontSize: 12, cursor: 'pointer', letterSpacing: '-0.01em' }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── TasksLayout ───────────────────────────────────────────────────────────────

function TasksLayout({ workspaceId }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IssueBoard key={refreshKey} workspaceId={workspaceId} selectedId={selectedTask?.id} onSelect={setSelectedTask} />
      <IssueWorkspace task={selectedTask} workspaceId={workspaceId} onTaskRefresh={() => setRefreshKey((k) => k + 1)} />
    </div>
  )
}

// ── StatusBar ─────────────────────────────────────────────────────────────────

function StatusBar({ mode }) {
  return (
    <div style={{ height: 24, borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 12, fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
      <span className="mono">Argo v0.5.0</span>
      <span>·</span>
      <span>{mode}</span>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('chat')
  const ws = useWorkspace()
  const convs = useConversations()
  const [activeConvId, setActiveConvId] = useState(null)

  const workspaceId = ws.activeId

  const handleNewChat = useCallback((id, title) => {
    if (id && title) {
      convs.addConversation(id, title)
      setActiveConvId(id)
    } else {
      setActiveConvId(null)
    }
    setMode('chat')
  }, [convs])

  return (
    <div
      className="grain"
      style={{ display: 'flex', flexDirection: 'row', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)' }}
    >
      {/* Sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
        <AppSidebar
          mode={mode}
          onMode={setMode}
          onNewChat={() => { handleNewChat(null, null); setMode('chat') }}
        />
        <WorkspaceTabs
          openWorkspaces={ws.openWorkspaces}
          activeId={ws.activeId}
          all={ws.all}
          openIds={ws.openIds}
          onSwitch={ws.switchWorkspace}
          onClose={ws.closeWorkspace}
          onCreate={ws.createWorkspace}
          onOpen={ws.openWorkspace}
          vertical
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {mode === 'chat'       && (
            <ChatPanel
              workspaceId={workspaceId}
              conversations={convs.conversations}
              activeConvId={activeConvId}
              onNewChat={handleNewChat}
              onSelectConv={(c) => setActiveConvId(c.id)}
              onRemove={convs.removeConversation}
              onRename={convs.renameConversation}
            />
          )}
          {mode === 'tasks'      && <TasksLayout workspaceId={workspaceId} />}
          {mode === 'pipeline'   && <PipelinePanel />}
          {mode === 'chiron'     && <ChironPanel workspaceId={workspaceId} />}
          {mode === 'wiki'       && <WikiPanel workspaceId={workspaceId} />}
          {mode === 'argorouter' && <ArgorouterPanel />}
          {mode === 'codegraph'  && <CodegraphPanel workspaceId={workspaceId} repoPath={ws.activeWorkspace?.repo_path ?? null} />}
          {mode === 'timeline'   && <ChangeTimeline workspaceId={workspaceId} />}
          {mode === 'github'     && <GitHubPanel />}
          {mode === 'providers'  && <ProvidersPanel />}
          {mode === 'settings'   && <SettingsPanel />}
        </div>
        <StatusBar mode={mode} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Fix `WorkspaceTabs` — it currently renders horizontally. Pass `vertical` prop and hide it for now (workspace switching can be revisited). The simplest fix: just don't render `WorkspaceTabs` in the new layout since it's a horizontal bar that doesn't fit the side-nav layout.**

Edit the root `App.jsx` — remove `WorkspaceTabs` from the JSX entirely (it was used for workspace management; workspace switching can move to `AppSidebar` or settings in a later task):

```jsx
// Remove these lines from root App():
//   import { WorkspaceTabs } from './components/WorkspaceTabs'
// And remove <WorkspaceTabs ... /> from the JSX
```

The final root `App()` sidebar section becomes:

```jsx
<div style={{ display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
  <AppSidebar
    mode={mode}
    onMode={setMode}
    onNewChat={() => { handleNewChat(null, null); setMode('chat') }}
  />
</div>
```

- [ ] **Step 3: Run the dev server and verify the layout renders**

```bash
cd frontend && npm run dev
```

Open http://localhost:5173 — you should see the side nav on the left (expanded, with icon+label nav items), and chat content on the right. The nav should collapse when you click the ChevronLeft button.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: replace horizontal WorkspaceBar with collapsible AppSidebar"
```

---

## Task 6: Update `ChatInput` — add Paperclip button

**Files:**
- Modify: `src/components/chat/ChatInput.jsx`

- [ ] **Step 1: Add `Paperclip` import and render the button**

Replace the entire file:

```jsx
import { useCallback, useRef } from 'react'
import { SendHorizonal, Paperclip } from 'lucide-react'

export function ChatInput({ onSend, disabled, placeholder = 'Ask Argo anything…' }) {
  const ref = useRef(null)
  const fileRef = useRef(null)

  const submit = useCallback(() => {
    const val = ref.current?.value?.trim()
    if (!val || disabled) return
    onSend(val)
    ref.current.value = ''
    ref.current.style.height = 'auto'
  }, [onSend, disabled])

  const onKey = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        submit()
      }
    },
    [submit],
  )

  const onInput = useCallback((e) => {
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px'
  }, [])

  return (
    <div
      style={{
        padding: '10px 16px 14px',
        borderTop: '1px solid var(--border)',
        background: 'rgba(13,13,13,0.8)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-active)',
          borderRadius: 14,
          padding: '8px 10px 8px 12px',
          transition: 'border-color 150ms',
        }}
        onFocusCapture={(e) => e.currentTarget.style.borderColor = 'rgba(0,212,255,0.35)'}
        onBlurCapture={(e) => e.currentTarget.style.borderColor = 'var(--border-active)'}
      >
        {/* File attach button */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Attach file"
          style={{
            width: 30, height: 30,
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer',
            color: 'var(--text-muted)',
            flexShrink: 0,
            alignSelf: 'flex-end',
            marginBottom: 1,
            opacity: disabled ? 0.4 : 1,
            transition: 'color 120ms',
          }}
          onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.color = 'var(--text-secondary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <Paperclip size={16} strokeWidth={1.8} />
        </button>
        <input ref={fileRef} type="file" style={{ display: 'none' }} />

        {/* Textarea */}
        <textarea
          ref={ref}
          rows={1}
          onKeyDown={onKey}
          onInput={onInput}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            border: 'none',
            padding: '4px 0',
            fontSize: '14px',
            color: 'var(--text-primary)',
            lineHeight: 1.5,
            outline: 'none',
            overflowY: 'hidden',
            fontFamily: 'inherit',
          }}
        />

        {/* Send button */}
        <button
          onClick={submit}
          disabled={disabled}
          aria-label="Send"
          style={{
            width: 32, height: 32,
            borderRadius: 9,
            border: 'none',
            background: disabled
              ? 'var(--bg-overlay)'
              : 'linear-gradient(135deg, #00d4ff, #00ff9d)',
            color: disabled ? 'var(--text-muted)' : '#0a0a0a',
            cursor: disabled ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            alignSelf: 'flex-end',
            transition: 'opacity 150ms',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <SendHorizonal size={15} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Reload http://localhost:5173 → chat tab → input bar should now show a paperclip icon on the left and a unified rounded box around the textarea + buttons.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/ChatInput.jsx
git commit -m "feat: add file attachment button to ChatInput, unify input box styling"
```

---

## Task 7: Add typing indicator to `ChatView`

**Files:**
- Modify: `src/components/chat/ChatView.jsx`

- [ ] **Step 1: Add `TypingIndicator` sub-component and wire it up**

Add this component just before the `ChatView` export (after the `SessionStats` function):

```jsx
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 0 2px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: 'var(--accent-cyan)',
            display: 'inline-block',
            animation: 'argo-typing-bounce 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  )
}
```

Then inside `ChatView`, replace the existing `<PhaseIndicator .../>` line with:

```jsx
{/* Show typing dots while streaming (planning or executing) */}
{(isPlanning || isExecuting) && messages.length > 0 && <TypingIndicator />}

{/* Phase indicator (keep for cases with no messages yet) */}
<PhaseIndicator status={status} activeTools={activeTools} onAbort={onCancel} />
```

- [ ] **Step 2: Verify in browser**

Send a message in Chat tab. While Argo is responding, three bouncing cyan dots should appear below the last message.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/chat/ChatView.jsx
git commit -m "feat: add typing indicator dots to ChatView during planning/executing"
```

---

## Task 8: Add `PipelineProgress` inline component in chat bubble

**Files:**
- Create: `src/components/chat/PipelineProgress.jsx`
- Modify: `src/components/chat/ChatView.jsx`

The pipeline has 4 agents: `planner`, `engineer`, `cost_estimator`, `writer`. When `usePipeline` is running, show a compact progress block inline in the chat message area (not a separate tab).

- [ ] **Step 1: Create `PipelineProgress.jsx`**

```jsx
// src/components/chat/PipelineProgress.jsx
import { Zap, Check } from 'lucide-react'

const STEPS = [
  { id: 'planner',       label: 'Planner' },
  { id: 'engineer',      label: 'Engineer' },
  { id: 'cost_estimator', label: 'Cost Est.' },
  { id: 'writer',        label: 'Writer' },
]

function StepDot({ status }) {
  if (status === 'done') {
    return (
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--accent-green)',
        display: 'inline-block', flexShrink: 0,
      }} />
    )
  }
  if (status === 'thinking') {
    return (
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: 'var(--accent-cyan)',
        boxShadow: '0 0 6px rgba(0,212,255,0.7)',
        display: 'inline-block', flexShrink: 0,
        animation: 'argo-dot-pulse 1.2s ease-in-out infinite',
      }} />
    )
  }
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%',
      background: 'var(--bg-overlay)',
      border: '1px solid var(--border-active)',
      display: 'inline-block', flexShrink: 0,
    }} />
  )
}

export function PipelineProgress({ agents }) {
  const hasActivity = Object.values(agents).some(
    (a) => a.status === 'thinking' || a.status === 'done'
  )
  if (!hasActivity) return null

  return (
    <div
      style={{
        background: 'rgba(0,255,157,0.03)',
        border: '1px solid rgba(0,255,157,0.12)',
        borderRadius: 10,
        padding: '10px 12px',
        margin: '8px 0 4px',
        animation: 'argo-fade-in 200ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Zap size={11} color="var(--accent-green)" strokeWidth={2.5} />
        <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'rgba(0,255,157,0.6)' }}>
          Pipeline
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {STEPS.map(({ id, label }) => {
          const agent = agents[id] || { status: 'idle' }
          const isDone = agent.status === 'done'
          const isRunning = agent.status === 'thinking'
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <StepDot status={agent.status} />
              <span style={{
                fontSize: 11,
                color: isDone ? 'var(--accent-green)' : isRunning ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontWeight: isRunning ? 500 : 400,
                flex: 1,
              }}>
                {label}
              </span>
              {isDone && (
                <Check size={10} color="var(--accent-green)" strokeWidth={2.5} />
              )}
              {isRunning && (
                <span style={{ fontSize: 9, color: 'var(--accent-cyan)' }}>running…</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire `PipelineProgress` into `ChatPanel` in `App.jsx`**

The `ChatPanel` already imports `usePipeline` is available at the top level. Add pipeline state to `ChatPanel` and pass it down to `ChatView`:

In `App.jsx`, update `ChatPanel` to accept and expose pipeline agents:

```jsx
// In ChatPanel function, add:
import { usePipeline } from '../../hooks/usePipeline'  // already imported at top of App.jsx

// Inside ChatPanel body, add:
const pipeline = usePipeline()
```

Then pass `pipelineAgents={pipeline.agents}` to `ChatView`:

```jsx
<ChatView
  ...
  pipelineAgents={pipeline.agents}
/>
```

- [ ] **Step 3: Render `PipelineProgress` inside `ChatView`**

In `src/components/chat/ChatView.jsx`, add import:

```jsx
import { PipelineProgress } from './PipelineProgress'
```

Add `pipelineAgents` to the `ChatView` props:

```jsx
export function ChatView({
  messages, status, error, activeTools, stats,
  onSend, onConfirm, onCancel, onReset, workspaceId,
  pipelineAgents,   // ← add this
}) {
```

Inside the message scroll area, after the message list and before `PhaseIndicator`, add:

```jsx
{/* Pipeline inline progress (only when pipeline has activity) */}
{pipelineAgents && <PipelineProgress agents={pipelineAgents} />}
```

- [ ] **Step 4: Verify in browser**

Navigate to Issues tab, trigger a pipeline run from PipelinePanel (or test by temporarily rendering PipelinePanel alongside ChatView). The 4 agent steps should appear inline in the chat area with dot-pulse animation on the running agent.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/chat/PipelineProgress.jsx frontend/src/components/chat/ChatView.jsx frontend/src/App.jsx
git commit -m "feat: add PipelineProgress inline component — pipeline steps visible in chat bubble"
```

---

## Task 9: Update `IssueBoard` — add prominent FAB for repo folder

**Files:**
- Modify: `src/components/layout/IssueBoard.jsx`

- [ ] **Step 1: Read the current bottom of IssueBoard to find where to add the FAB**

```bash
grep -n "return\|export\|workspaceId\|onAdd\|render" \
  frontend/src/components/layout/IssueBoard.jsx | head -20
```

- [ ] **Step 2: Add `onAddFolder` prop to `IssueBoard` signature and add the FAB**

Find the `export function IssueBoard({` line and add `onAddFolder` to the destructured props:

```jsx
export function IssueBoard({ workspaceId, selectedId, onSelect, onAddFolder }) {
```

Find the outermost wrapper `<div>` returned by `IssueBoard` and add a `position: relative` wrapper with the FAB at the bottom. Locate the closing `</div>` of the IssueBoard's root element and insert before it:

```jsx
{/* FAB — Add Repository Folder */}
<div
  style={{
    position: 'absolute',
    bottom: 20,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 10,
  }}
>
  <button
    onClick={onAddFolder}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      padding: '9px 20px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-active)',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 500,
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      fontFamily: 'inherit',
      boxShadow: 'var(--sh-2)',
      transition: 'border-color 150ms, color 150ms',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'rgba(0,212,255,0.4)'
      e.currentTarget.style.color = 'var(--accent-cyan)'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--border-active)'
      e.currentTarget.style.color = 'var(--text-secondary)'
    }}
  >
    <Plus size={14} strokeWidth={2.5} />
    Add Repository Folder
  </button>
</div>
```

`IssueBoard` receives `onAddFolder` prop from `TasksLayout` in `App.jsx`. In `App.jsx`, update `TasksLayout`:

```jsx
function TasksLayout({ workspaceId }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const ws = useWorkspace()
  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IssueBoard
        key={refreshKey}
        workspaceId={workspaceId}
        selectedId={selectedTask?.id}
        onSelect={setSelectedTask}
        onAddFolder={() => ws.createWorkspace('New workspace', '')}
      />
      <IssueWorkspace task={selectedTask} workspaceId={workspaceId} onTaskRefresh={() => setRefreshKey((k) => k + 1)} />
    </div>
  )
}
```

Add `Plus` to the import at the top of `IssueBoard.jsx`:

```jsx
import { Plus } from 'lucide-react'
```

And add `position: 'relative'` to the root wrapper div of `IssueBoard`:

```jsx
// Find the root div in IssueBoard's return and add position relative:
style={{ ..., position: 'relative' }}
```

- [ ] **Step 3: Verify in browser**

Switch to Issues tab → a pill-shaped "Add Repository Folder" button should appear at the bottom center.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/IssueBoard.jsx
git commit -m "feat: add bottom-center FAB button to IssueBoard for repo folder"
```

---

## Task 10: Final verification

- [ ] **Step 1: Run the full dev build**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build completes with no errors. Note any warnings about unused imports (acceptable).

- [ ] **Step 2: Manual smoke test in browser**

Start dev server: `cd frontend && npm run dev`

Check these flows:
1. Side nav expands/collapses with ◀/▶ button — state persists on reload
2. In Chat tab: conversation history sidebar visible on left with "Conversations" header
3. Send a message → typing bounce dots appear → response streams in
4. Click "+" in ConversationSidebar → creates new chat
5. Hover over a conversation → Rename (pencil) and Delete (trash) icons appear
6. Switch to Issues tab → FAB "Add Repository Folder" appears at bottom center
7. Switch to Knowledge/Codegraph/Timeline → no conversation sidebar shown

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete UI redesign — side nav, chat history, typing indicator, issues FAB"
```
