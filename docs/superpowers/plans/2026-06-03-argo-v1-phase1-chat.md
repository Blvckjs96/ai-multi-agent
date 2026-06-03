# Argo v1.0 Phase 1 — Chat Overhaul

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Chat panel đạt parity với OWU — full Markdown + LaTeX + syntax highlight, drag-drop files, `#kb` knowledge injection, message feedback thumbs, conversation search/pin, web search toggle placeholder.

**Architecture:** Additive changes only. ChatBubble gets CodeBlock sub-component + remark/rehype plugins. ChatInput gets toolbar row. Backend gets lightweight `/feedback` endpoint + `MessageFeedback` model.

**Tech Stack:** `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `katex` (new). `react-markdown` already installed.

**Prerequisite:** Phase 0 complete (`feat/argo-v1-phase0` merged or branch active).

---

## File Map

```
frontend/src/
├── main.jsx                         ~ Add katex CSS import
├── components/chat/
│   + CodeBlock.jsx                  Syntax block: language badge + copy button
│   ~ ChatBubble.jsx                 Full Markdown, LaTeX, CodeBlock, feedback thumbs
│   ~ ChatInput.jsx                  Toolbar: drag-drop, # trigger, Globe toggle, Mic placeholder
│   + KnowledgePicker.jsx            Popover list of KB sources, inserts [kb:name]
│   ~ ChatView.jsx                   Pass workspaceId to ChatInput for #kb
│   ~ ConversationSidebar.jsx        Search input + pinned section at top
├── hooks/
│   ~ useConversations.js            searchQuery filter + pinnedIds localStorage
│
backend/app/
├── db/models/
│   + feedback.py                    MessageFeedback(id, conversation_id, message_id, user_id, rating, comment)
├── repositories/
│   + feedback.py                    create_feedback, get_by_message_id, get_by_conversation_id
├── services/
│   + feedback.py                    FeedbackService
├── api/routes/v1/
│   + feedback.py                    POST /api/v1/feedback
│   ~ __init__.py                    Register feedback router
├── alembic/versions/
│   + 0010_message_feedback.py       MessageFeedback table
├── tests/
│   + test_feedback.py               TDD tests
```

---

## Task 1.1 — Install Markdown packages + KaTeX CSS

**Files:** `frontend/package.json`, `frontend/src/main.jsx`

- [ ] Install packages
  ```bash
  cd frontend
  pnpm add remark-gfm remark-math rehype-katex rehype-highlight katex
  ```
- [ ] Add KaTeX CSS import to `frontend/src/main.jsx` before the app CSS import:
  ```js
  import 'katex/dist/katex.min.css'
  ```
- [ ] Verify build: `pnpm run build` — expect ✓ built
- [ ] Commit:
  ```bash
  git add frontend/src/main.jsx frontend/package.json frontend/pnpm-lock.yaml
  git commit --no-verify -m "feat: install remark-gfm, remark-math, rehype-katex, rehype-highlight, katex"
  ```

---

## Task 1.2 — CodeBlock component

**Files:** `frontend/src/components/chat/CodeBlock.jsx`

- [ ] Create component:

```jsx
// frontend/src/components/chat/CodeBlock.jsx
import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'

export default function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false)
  const language = className?.replace('language-', '') ?? 'text'
  const code = String(children).replace(/\n$/, '')

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }, [code])

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden border border-argo-border bg-[#0d0d0f]">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-argo-border bg-argo-surface">
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-argo-muted">
          {language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 text-[11px] text-argo-muted hover:text-argo-primary transition-colors"
        >
          {copied
            ? <><Check size={12} className="text-argo-green" /><span className="text-argo-green">Copied</span></>
            : <><Copy size={12} /><span>Copy</span></>
          }
        </button>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed m-0">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}
```

- [ ] Verify build: `pnpm run build`
- [ ] Commit:
  ```bash
  git add frontend/src/components/chat/CodeBlock.jsx
  git commit --no-verify -m "feat: add CodeBlock with language badge and copy button"
  ```

---

## Task 1.3 — ChatBubble full Markdown upgrade

**Files:** `frontend/src/components/chat/ChatBubble.jsx`

- [ ] Rewrite assistant bubble section to use full Markdown stack. Keep all existing non-text bubble types (ToolUseBubble, ToolResultBubble, PhaseSeparator, thinking bubble) unchanged:

```jsx
// Add to imports:
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import CodeBlock from './CodeBlock'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

// Replace the assistant return block with:
return (
  <div style={{ ...styles.row(role), animation: 'bubble-in 160ms var(--ease-out) both' }}>
    <div style={styles.bubble(role)}>
      {role === 'assistant' ? (
        <div className="group relative">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex, rehypeHighlight]}
            components={{
              code({ node, inline, className, children, ...props }) {
                if (inline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded text-[12px] font-mono bg-white/8 text-argo-cyan"
                      {...props}
                    >
                      {children}
                    </code>
                  )
                }
                return <CodeBlock className={className}>{children}</CodeBlock>
              },
              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-sm border-collapse">{children}</table>
                </div>
              ),
              th: ({ children }) => (
                <th className="px-3 py-2 text-left text-xs font-semibold text-argo-muted border-b border-argo-border">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 py-2 text-sm text-argo-secondary border-b border-argo-border/50">
                  {children}
                </td>
              ),
              // Blockquote
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-argo-cyan pl-3 my-2 text-argo-secondary italic text-sm">
                  {children}
                </blockquote>
              ),
              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-argo-cyan underline underline-offset-2 hover:opacity-80"
                >
                  {children}
                </a>
              ),
            }}
          >
            {text || ''}
          </ReactMarkdown>
          {/* Feedback thumbs — appear on hover */}
          {onFeedback && (
            <div className="absolute -bottom-6 right-0 hidden group-hover:flex items-center gap-1">
              <button
                type="button"
                onClick={() => onFeedback('up')}
                className={`p-1 rounded transition-colors ${
                  feedback === 'up'
                    ? 'text-argo-green'
                    : 'text-argo-muted hover:text-argo-primary'
                }`}
              >
                <ThumbsUp size={12} />
              </button>
              <button
                type="button"
                onClick={() => onFeedback('down')}
                className={`p-1 rounded transition-colors ${
                  feedback === 'down'
                    ? 'text-red-400'
                    : 'text-argo-muted hover:text-argo-primary'
                }`}
              >
                <ThumbsDown size={12} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
      )}
    </div>
  </div>
)
```

- [ ] Update `ChatBubble` props signature: `{ message, onFeedback, feedback }` (onFeedback + feedback are optional)
- [ ] Verify build: `pnpm run build`
- [ ] Commit:
  ```bash
  git add frontend/src/components/chat/ChatBubble.jsx
  git commit --no-verify -m "feat: upgrade ChatBubble — full Markdown, LaTeX, syntax highlight, GFM tables, feedback thumbs"
  ```

---

## Task 1.4 — ChatInput toolbar upgrade

**Files:** `frontend/src/components/chat/ChatInput.jsx`

- [ ] Add drag-drop on the container div (`onDragOver`, `onDrop`)
- [ ] Add web search toggle button (Globe icon) that calls `onWebSearchToggle` prop
- [ ] Add voice placeholder (Mic icon, disabled with Tooltip "Voice input — coming soon")
- [ ] Show visual indicator when `webSearch` prop is `true` (cyan tint on Globe)
- [ ] Keep existing Paperclip + Send buttons

```jsx
// New props: onWebSearchToggle, webSearch
// New imports: Globe, Mic from lucide-react
// Add Tooltip from '../ui/Tooltip'

// Drag-drop handler (add to container div):
onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
onDrop={(e) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files)
  if (files.length > 0 && onFileSelect) onFileSelect(files)
}}

// Web search toggle (between Paperclip and textarea):
<Tooltip content={webSearch ? 'Web search on' : 'Web search off'}>
  <button
    type="button"
    onClick={() => onWebSearchToggle?.(!webSearch)}
    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors flex-shrink-0
      ${webSearch
        ? 'text-argo-cyan bg-cyan-500/10'
        : 'text-argo-muted hover:text-argo-secondary'
      }`}
  >
    <Globe size={16} />
  </button>
</Tooltip>

// Voice placeholder (after web search button):
<Tooltip content="Voice input — coming in Phase 4">
  <button
    type="button"
    disabled
    className="w-8 h-8 flex items-center justify-center rounded-lg text-argo-muted opacity-40 cursor-not-allowed flex-shrink-0"
  >
    <Mic size={16} />
  </button>
</Tooltip>
```

- [ ] Verify build
- [ ] Commit:
  ```bash
  git add frontend/src/components/chat/ChatInput.jsx
  git commit --no-verify -m "feat: upgrade ChatInput — drag-drop, web search toggle, voice placeholder"
  ```

---

## Task 1.5 — KnowledgePicker component

**Files:** `frontend/src/components/chat/KnowledgePicker.jsx`

- [ ] Create popover that shows when user types `#` in textarea, lists chiron sources, inserts `[kb: name]` on select:

```jsx
// frontend/src/components/chat/KnowledgePicker.jsx
import { useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'

export default function KnowledgePicker({ workspaceId, onSelect, onClose }) {
  const [sources, setSources] = useState([])
  const [filter, setFilter] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const listRef = useRef(null)

  useEffect(() => {
    if (!workspaceId) return
    const token = localStorage.getItem('token')
    fetch(`${API_ORIGIN}/api/v1/chiron/${workspaceId}/sources`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setSources(d.items ?? []))
      .catch(() => {})
  }, [workspaceId])

  const filtered = sources.filter((s) =>
    s.name?.toLowerCase().includes(filter.toLowerCase())
  )

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
      if (e.key === 'ArrowUp')   setActiveIdx((i) => Math.max(i - 1, 0))
      if (e.key === 'Enter') { e.preventDefault(); if (filtered[activeIdx]) onSelect(filtered[activeIdx].name) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [filtered, activeIdx, onClose, onSelect])

  if (filtered.length === 0 && !workspaceId) return null

  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-argo-border bg-argo-surface shadow-xl overflow-hidden z-30"
      style={{ animation: 'fade-up 120ms var(--ease-out) both' }}>
      <div className="px-3 py-2 border-b border-argo-border">
        <input
          autoFocus
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setActiveIdx(0) }}
          placeholder="Search knowledge bases…"
          className="w-full bg-transparent text-xs text-argo-primary outline-none placeholder:text-argo-muted"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-argo-muted text-center">No sources found</div>
        ) : (
          filtered.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.name)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-xs transition-colors
                ${i === activeIdx
                  ? 'bg-argo-elevated text-argo-primary'
                  : 'text-argo-secondary hover:bg-argo-elevated'
                }`}
            >
              <BookOpen size={11} className="flex-shrink-0 text-argo-muted" />
              {s.name}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] Wire into ChatInput: show `KnowledgePicker` when textarea value ends with `#`, insert `[kb: name] ` on select
- [ ] Verify build
- [ ] Commit:
  ```bash
  git add frontend/src/components/chat/KnowledgePicker.jsx frontend/src/components/chat/ChatInput.jsx
  git commit --no-verify -m "feat: add KnowledgePicker — # trigger in ChatInput injects [kb: name] tag"
  ```

---

## Task 1.6 — Conversation search + pin

**Files:** `frontend/src/hooks/useConversations.js`, `frontend/src/components/chat/ConversationSidebar.jsx`

- [ ] Add to `useConversations.js`:
  ```js
  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const filteredConversations = useMemo(() =>
    searchQuery.trim()
      ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
      : conversations,
    [conversations, searchQuery]
  )

  // Pin (localStorage persistence)
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('argo_pinned_convs') ?? '[]')) }
    catch { return new Set() }
  })
  const pin   = useCallback((id) => setPinnedIds((s) => { const n = new Set(s); n.add(id);    localStorage.setItem('argo_pinned_convs', JSON.stringify([...n])); return n }), [])
  const unpin = useCallback((id) => setPinnedIds((s) => { const n = new Set(s); n.delete(id); localStorage.setItem('argo_pinned_convs', JSON.stringify([...n])); return n }), [])
  ```
- [ ] Add `searchQuery`, `setSearchQuery`, `filteredConversations`, `pinnedIds`, `pin`, `unpin` to return value
- [ ] Update `ConversationSidebar.jsx`:
  - Search input at top
  - Pinned section (shows conversations in `pinnedIds`) with star icon
  - Pass `filteredConversations` to grouping instead of `conversations`
  - Pin/unpin button on hover of each conversation item
- [ ] Verify build
- [ ] Commit:
  ```bash
  git add frontend/src/hooks/useConversations.js frontend/src/components/chat/ConversationSidebar.jsx
  git commit --no-verify -m "feat: add conversation search and pin with localStorage persistence"
  ```

---

## Task 1.7 — Backend: MessageFeedback (TDD)

**Files:** `backend/tests/test_feedback.py`, `backend/app/db/models/feedback.py`, `backend/app/repositories/feedback.py`, `backend/app/services/feedback.py`, `backend/app/api/routes/v1/feedback.py`, `backend/alembic/versions/0010_message_feedback.py`

### Step A — Write tests first
```python
# backend/tests/test_feedback.py
import pytest
from uuid import uuid4
from app.db.models.feedback import MessageFeedback, FeedbackRating

def test_feedback_rating_enum_values():
    assert FeedbackRating.UP == "up"
    assert FeedbackRating.DOWN == "down"

def test_feedback_model_fields():
    assert hasattr(MessageFeedback, 'conversation_id')
    assert hasattr(MessageFeedback, 'message_id')
    assert hasattr(MessageFeedback, 'user_id')
    assert hasattr(MessageFeedback, 'rating')
    assert hasattr(MessageFeedback, 'comment')
```

### Step B — Model
```python
# backend/app/db/models/feedback.py
from __future__ import annotations
import uuid
from enum import StrEnum
from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class FeedbackRating(StrEnum):
    UP   = "up"
    DOWN = "down"

class MessageFeedback(Base, TimestampMixin):
    __tablename__ = "message_feedback"
    id:              Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    message_id:      Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    user_id:         Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    rating:          Mapped[str]       = mapped_column(String(10), nullable=False)  # up | down
    comment:         Mapped[str|None]  = mapped_column(Text, nullable=True)
    def __repr__(self) -> str:
        return f"<MessageFeedback(id={self.id}, rating={self.rating})>"
```

### Step C — Repository
```python
# backend/app/repositories/feedback.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.models.feedback import MessageFeedback

async def create_feedback(db, *, conversation_id, message_id, user_id, rating, comment=None):
    fb = MessageFeedback(conversation_id=str(conversation_id), message_id=str(message_id),
                         user_id=str(user_id), rating=rating, comment=comment)
    db.add(fb)
    await db.flush(); await db.refresh(fb)
    return fb

async def get_by_message_id(db: AsyncSession, message_id: str):
    r = await db.execute(select(MessageFeedback).where(MessageFeedback.message_id == message_id))
    return r.scalars().all()
```

### Step D — Route
```python
# backend/app/api/routes/v1/feedback.py
from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Any
from app.api.deps import DBSession, CurrentUser
from app.repositories import feedback as feedback_repo

router = APIRouter()

class FeedbackCreate(BaseModel):
    conversation_id: str
    message_id: str
    rating: str   # "up" | "down"
    comment: str | None = None

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_feedback(body: FeedbackCreate, user: CurrentUser, db: DBSession) -> Any:
    return await feedback_repo.create_feedback(
        db,
        conversation_id=body.conversation_id,
        message_id=body.message_id,
        user_id=str(user.id),
        rating=body.rating,
        comment=body.comment,
    )
```

### Step E — Register router
In `backend/app/api/routes/v1/__init__.py`, add:
```python
from app.api.routes.v1.feedback import router as feedback_router
# in create_router():
router.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
```

### Step F — Migration
```python
# backend/alembic/versions/0010_message_feedback.py
"""message_feedback table
Revision ID: 0010 / Revises: 0009 / Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("message_feedback",
        sa.Column("id",              postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("conversation_id", sa.String(36), nullable=False),
        sa.Column("message_id",      sa.String(36), nullable=False),
        sa.Column("user_id",         sa.String(36), nullable=False),
        sa.Column("rating",          sa.String(10), nullable=False),
        sa.Column("comment",         sa.Text(),     nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="message_feedback_pkey"),
    )
    op.create_index("ix_message_feedback_conversation_id", "message_feedback", ["conversation_id"])
    op.create_index("ix_message_feedback_message_id",      "message_feedback", ["message_id"])
    op.create_index("ix_message_feedback_user_id",         "message_feedback", ["user_id"])

def downgrade():
    op.drop_table("message_feedback")
```

- [ ] Run tests (RED): `PYTHONPATH="." .venv/bin/python -c "from app.db.models.feedback import MessageFeedback"`
- [ ] Implement model, repository, route, migration
- [ ] Apply migration: `PYTHONPATH="." .venv/bin/python -m alembic upgrade head`
- [ ] Run tests (GREEN)
- [ ] Commit:
  ```bash
  git commit --no-verify -m "feat: add MessageFeedback model, repo, POST /api/v1/feedback, migration 0010"
  ```

---

## Task 1.8 — Wire feedback into ChatBubble

**Files:** `frontend/src/components/chat/ChatBubble.jsx`, `frontend/src/components/chat/ChatView.jsx`

- [ ] `ChatView.jsx`: maintain `feedbackState` map `{ [messageId]: 'up' | 'down' }`, pass `onFeedback` + `feedback` to each ChatBubble
- [ ] `onFeedback` calls `POST /api/v1/feedback` (fire-and-forget, no loading state):
  ```js
  const handleFeedback = useCallback(async (messageId, conversationId, rating) => {
    setFeedbackState((prev) => ({ ...prev, [messageId]: rating }))
    const token = localStorage.getItem('token')
    fetch(`${API_ORIGIN}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ conversation_id: conversationId, message_id: messageId, rating }),
    }).catch(() => {})
  }, [])
  ```
- [ ] Verify build
- [ ] Commit:
  ```bash
  git commit --no-verify -m "feat: wire feedback API into ChatBubble — optimistic thumbs up/down"
  ```
