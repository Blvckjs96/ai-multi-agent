# Argo UI Redesign — Design Spec
Date: 2026-05-23

## Overview

Redesign the Argo frontend from a horizontal tab bar layout to a Claude Desktop-inspired layout with a collapsible side nav, persistent conversation history, and pipeline integrated inline into the chat bubble.

## Goals

1. Side nav that collapses to an icon rail (replaces top WorkspaceBar tab strip)
2. Chat tab shows a second sidebar with conversation history + CRUD (like Claude Desktop)
3. Pipeline runs inline inside the chat message bubble (no longer a separate tab)
4. Loading/running animations in chat bubble (typing dots, step pulse, tool spinner)
5. Issues tab "+" button moved to bottom-center as a prominent guided action
6. All icons use Lucide React (shadcn UI standard)

---

## 1. Layout Architecture

### Overall shell (all modes)

```
┌──────────────────────────────────────────────────────┐
│  [Side Nav 220px | 52px]  │  [Content Area]          │
│                            │                          │
│  Logo + brand              │  Mode-specific panel     │
│  Nav items (icon+label)    │                          │
│  ──────────────────        │                          │
│  [New Chat] button         │                          │
│  Settings (bottom)         │                          │
└──────────────────────────────────────────────────────┘
```

### Chat mode only (adds a second sidebar)

```
┌────────────────────────────────────────────────────────────────┐
│  [Side Nav]  │  [Conv History 200px]  │  [Chat Main]           │
│              │                         │                        │
│              │  Conversations          │  Messages              │
│              │  grouped by date        │  + pipeline inline     │
│              │  + rename/delete        │  + input bar           │
└────────────────────────────────────────────────────────────────┘
```

---

## 2. Side Nav Component (`AppSidebar`)

### Expanded state (220px)

- **Header**: Argo logo (gradient) + brand name + ChevronLeft collapse button
- **Nav sections**:
  - *Workspace*: Chat (MessageSquare), Issues (LayoutDashboard), Knowledge (BookOpen), Codegraph (GitGraph), Timeline (Clock), GitHub (GitBranch)
  - *System*: Router (Network), Providers (Layers)
- **Footer**: `+ New Chat` button (full width, styled)
- **Bottom**: Settings icon (Settings from Lucide)

### Collapsed state (52px icon rail)

- Logo only (no brand text)
- ChevronRight expand button below logo
- Icon-only nav items (same icons, no labels)
- Tooltip on hover showing the label
- Settings icon at bottom

### Behavior

- State persisted in `localStorage` (`argo_nav_collapsed`)
- Smooth CSS transition: `width 250ms ease`, label fade with `opacity` + `overflow: hidden`
- Active item highlighted with accent color

---

## 3. Conversation History Sidebar (`ConversationSidebar`)

**Only rendered when `mode === 'chat'`.**

- Width: 200px, fixed, no collapse
- Header: "Conversations" label + `+` (Plus icon) new chat button
- Groups conversations by date: Today / Yesterday / Previous 7 days / Older
- Each item: title (truncated) + relative timestamp
- Active conversation: highlighted
- Right-click or hover → context menu: Rename, Delete
- Data source: `GET /api/v1/conversations` (existing API)
- State managed in new `useConversations` hook

---

## 4. Chat Panel Redesign (`ChatPanel`)

### Message bubbles

- **User**: right-aligned, dark green tinted background, rounded `14px 14px 3px 14px`
- **Assistant**: left-aligned, avatar (gradient circle) + bubble `14px 14px 14px 3px`

### Pipeline inline block (inside assistant bubble)

When a chat triggers the pipeline, a `PipelineProgress` sub-component renders inside the bubble:

```
⚡ Pipeline đang chạy
● Planner       ✓  1.2s
● Engineer      ▶  đang viết code...   [pulse animation]
○ Cost Estimator    —
○ Writer            —
```

- Step states: `pending` (dim dot) / `running` (cyan pulsing dot) / `done` (green solid dot)
- Each step's result can be expanded inline (chevron toggle)

### Tool use block

While a tool is executing, a small inline block appears below the text:

```
[spinner] Đang tạo file backend/app/core/security.py
```

### Streaming / typing indicator

While the model is generating text, show three bouncing dots (same pattern as Claude Desktop).

### Animations

| State | Animation |
|-------|-----------|
| Streaming text | Typing bounce dots (3 dots, staggered 0.2s delay) |
| Pipeline step running | Dot pulse (scale + opacity, 1.2s loop) |
| Tool executing | CSS spinner (rotate 0.8s linear infinite) |
| Step completes | Flash: running → brief white → done green |

### Chat input bar

```
┌─────────────────────────────────────────────────────┐
│  Paperclip │  Nhắn tin với Argo...  │  Zap │  ↑    │
└─────────────────────────────────────────────────────┘
  (file)       (placeholder)           (model) (send)
```

Status line below input: `Model · Workspace · Auth status`

---

## 5. Issues Tab — "+" Guidance Button

The current `IssueBoard` has no obvious entry point to add a repo folder.

- Add a floating `+` button anchored to bottom-center of the IssueBoard panel
- Style: pill button, gradient border, label "Add Repository Folder"
- When board is empty: show a centered empty state with the button prominently
- When board has items: button stays at bottom as a subtle FAB (Floating Action Button)

---

## 6. Pipeline Tab Removal

The `pipeline` mode is removed from `PRIMARY_MODES` in `AppSidebar`. The pipeline feature is now only accessible by running a task from the Chat input (with a `/pipeline` command or auto-triggered by message context). The `PipelinePanel` component is preserved but not linked from the nav.

---

## 7. Components Affected

| File | Change |
|------|--------|
| `src/App.jsx` | Remove WorkspaceBar, add AppSidebar, wire nav collapse state |
| `src/components/AppSidebar.jsx` | New — collapsible side nav |
| `src/components/chat/ConversationSidebar.jsx` | New — conversation history |
| `src/components/chat/ChatPanel.jsx` | Refactor — add ConversationSidebar, update bubble layout |
| `src/components/chat/PipelineProgress.jsx` | New — inline pipeline steps inside bubble |
| `src/components/chat/ToolUseBlock.jsx` | New — inline tool execution indicator |
| `src/components/chat/TypingIndicator.jsx` | New — bouncing dots |
| `src/hooks/useConversations.js` | New — fetch/CRUD conversations |
| `src/components/layout/IssueBoard.jsx` | Add FAB "+" button + empty state |
| `src/index.css` | Add animation keyframes |

---

## 8. Out of Scope

- Backend changes (conversation CRUD API already exists)
- Mobile / responsive layout
- Dark/light theme toggle
- Drag-to-resize sidebar width
