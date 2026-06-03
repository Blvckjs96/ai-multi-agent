# Chat Bubble — Combined Implementation Plan

> Mục tiêu: Chat bubble hoạt động như Claude Desktop — standalone hoặc repo-aware,
> conversation persistence, session resume sau refresh, streaming per-token + thinking,
> tool timeline, Chiron wiki auto-draft.
>
> Không cần thêm service, route, hay migration mới.
> Toàn bộ backend (ConversationService, ChironService, /api/v1/conversations) đã tồn tại.

---

## Trạng thái hiện tại

| Thành phần | Vấn đề |
|---|---|
| `useConversations.js` | `createConversation()` tạo UUID local, không gọi API |
| `useChat.js` | Không nhận `conversationId`, messages mất khi refresh |
| `ChatPanel` (App.jsx) | Nhận `activeConversationId` nhưng không dùng, `useChat()` fresh mỗi lần |
| `claude_cli.py` `_parse_event()` | Thinking blocks bị drop silently, không extract subtype |
| `chat.py` `_normalize_event()` | Không forward `subtype` và `tool_index` lên frontend |
| Tool timeline (frontend) | `tool_use` và `tool_result` là 2 message riêng, không link với nhau |
| Chiron wiki | Chỉ có nội dung khi Claude chủ động gọi MCP tool, không auto-draft |

---

## Dependency graph

```
Step 1 (conversation persistence)  ← làm đầu tiên, là nền tảng
  ├── Step 2 (workspace indicator)  ← cosmetic, làm song song được
  └── Step 3 (session_id persist)  ← cần conversationId thật từ Step 1

Step 4 (text_delta + thinking)  ← backend only, làm bất kỳ lúc nào
  └── Step 5 (tool timeline)  ← cần tool_index từ Step 4

Step 6 (promptInjectionGuard)  ← hoàn toàn độc lập, ~30 phút

Steps 1+4 complete
  └── Step 7 (Chiron wiki auto-draft)  ← backend only, cần chiron_token
```

---

## Step 1 — Conversation Persistence

> **Sprint 1** — Nền tảng. Messages lưu vào PostgreSQL, load lại khi click conversation cũ.

**Status: `[ ] todo`**

### Files thay đổi

#### `frontend/src/hooks/useConversations.js`

- [ ] Thay `createConversation(title)` từ local-only → async + POST `/api/v1/conversations`
- [ ] Thêm hàm `loadMessages(conversationId)` → GET `/api/v1/conversations/{id}/messages?limit=200`

```js
// Thay createConversation
const createConversation = useCallback(async (title) => {
  const token = localStorage.getItem('token')
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const item = await res.json()
  const conv = { id: item.id, title: item.title, createdAt: item.created_at }
  setConversations((prev) => [conv, ...prev])
  return conv
}, [])

// Thêm loadMessages
const loadMessages = useCallback(async (conversationId) => {
  const token = localStorage.getItem('token')
  const res = await fetch(`${API_BASE}/${conversationId}/messages?limit=200`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.items || []).map((m) => ({
    id: m.id,
    role: m.role,
    type: m.type || 'text',
    text: m.content,
    createdAt: m.created_at,
  }))
}, [])
```

- [ ] Return `loadMessages` từ hook

---

#### `frontend/src/hooks/useChat.js`

- [ ] Đổi signature: `export function useChat(conversationId = null)`
- [ ] Thêm `saveMessage` helper (fire-and-forget, không block streaming)
- [ ] Gọi `saveMessage('user', message)` khi user send
- [ ] Gọi `saveMessage('assistant', fullText)` sau khi `result` event (lúc `flushBuffer()`)
- [ ] Thêm `loadHistory(msgs)` để load messages từ ngoài vào
- [ ] Return `loadHistory` từ hook

```js
export function useChat(conversationId = null) {
  // ... existing state ...

  const saveMessage = useCallback(async (role, content, type = 'text') => {
    if (!conversationId) return
    const token = localStorage.getItem('token')
    fetch(`${API_ORIGIN}/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ role, content, type }),
    }).catch(() => {})
  }, [conversationId])

  const loadHistory = useCallback((msgs) => {
    setMessages(msgs)
  }, [])

  // Trong send(): sau appendMsg → saveMessage('user', message)
  // Trong consumeStream() result block: sau flushBuffer() → saveMessage('assistant', assistantBufRef.current)

  return { ..., loadHistory }
}
```

---

#### `frontend/src/App.jsx` — `ChatPanel`

- [ ] Thêm prop `onLoadMessages` vào `ChatPanel`
- [ ] Dùng `useChat(activeConversationId)` thay vì `useChat()`
- [ ] Thêm `useEffect` để load history khi mount
- [ ] Thêm workspace indicator vào header

```jsx
function ChatPanel({ workspaceId, activeConversationId, onLoadMessages }) {
  const chat = useChat(activeConversationId)

  useEffect(() => {
    if (!activeConversationId || !onLoadMessages) return
    onLoadMessages(activeConversationId).then((msgs) => {
      if (msgs.length > 0) chat.loadHistory(msgs)
    })
  }, [activeConversationId]) // intentionally run once on mount
  // ...
}
```

- [ ] Trong render site: thêm `key` và `onLoadMessages`

```jsx
<ChatPanel
  key={convs.activeId ?? 'no-conv'}      // ← forces remount on switch
  workspaceId={ws.activeId}
  activeConversationId={convs.activeId}
  onLoadMessages={convs.loadMessages}
/>
```

- [ ] Button "New Chat": `await convs.createConversation(title)` → `convs.selectConversation(newConv.id)`

---

## Step 2 — Workspace Context Indicator

> **Sprint 2** — Visual feedback khi workspace đang active (context injection đã hoạt động phía backend).

**Status: `[ ] todo`**

### Files thay đổi

#### `frontend/src/App.jsx` — `ChatPanel` header

- [ ] Thêm dot indicator "repo active" khi `workspaceId` có giá trị

```jsx
{workspaceId && (
  <span style={{
    fontSize: 11,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  }}>
    <span style={{
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--accent-green)',
      display: 'inline-block',
    }} />
    repo active
  </span>
)}
```

> Không cần thay đổi backend — `build_context_injection()` trong `triage.py` đã inject
> workspace stack + Chiron wiki results vào `--append-system-prompt` tự động.

---

## Step 3 — Session ID Persistence

> **Sprint 4** — `session_id` tồn tại qua page refresh → `--resume` tiếp tục đúng session.

**Status: `[ ] todo`** _(cần Step 1 hoàn thành trước)_

### Files thay đổi

#### `frontend/src/hooks/useChat.js`

- [ ] Restore `sessionId` từ localStorage khi mount (keyed by `conversationId`)
- [ ] Persist `sessionId` vào localStorage mỗi khi thay đổi
- [ ] Clear localStorage key khi `reset()`

```js
// Restore on mount
useEffect(() => {
  if (!conversationId) return
  const stored = localStorage.getItem(`session_${conversationId}`)
  if (stored) setSessionId(stored)
}, [conversationId])

// Persist on change
useEffect(() => {
  if (!conversationId || !sessionId) return
  localStorage.setItem(`session_${conversationId}`, sessionId)
}, [conversationId, sessionId])

// Trong reset():
if (conversationId) localStorage.removeItem(`session_${conversationId}`)
```

> Không cần thay đổi backend. `--resume <session_id>` trong `claude_cli.py` đã xử lý.

---

## Step 4 — Text Delta + Thinking Blocks

> **OpenHuman pattern** — Per-token streaming + hiển thị thinking blocks như Claude Desktop.

**Status: `[ ] todo`**

### Files thay đổi

#### `backend/app/services/claude_cli.py` — `_parse_event()`

- [ ] Extract thinking blocks từ `content[]` (type == "thinking")
- [ ] Set `subtype = "thinking"` cho thinking blocks, `subtype = "text"` cho text blocks
- [ ] Xử lý partial events: `delta.type == "thinking_delta"` → `subtype = "thinking"`

```python
def _parse_event(raw: dict[str, Any]) -> CLIEvent | None:
    event_type = raw.get("type", "")
    if not event_type:
        return None

    subtype: str | None = raw.get("subtype")
    text: str | None = None

    if event_type == "assistant":
        message = raw.get("message") or {}
        content = message.get("content", [])
        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "text":
                    text = block.get("text")
                    subtype = "text"
                    break
                if block.get("type") == "thinking":
                    text = block.get("thinking")
                    subtype = "thinking"
                    break
        if text is None and raw.get("is_partial"):
            delta = raw.get("delta") or {}
            delta_type = delta.get("type", "text_delta")
            if delta_type == "text_delta":
                text = delta.get("text")
                subtype = "text"
            elif delta_type == "thinking_delta":
                text = delta.get("thinking")
                subtype = "thinking"

    return CLIEvent(
        type=event_type,
        subtype=subtype,
        data=raw,
        session_id=raw.get("session_id"),
        text=text,
    )
```

---

#### `backend/app/api/routes/v1/chat.py` — `_normalize_event()`

- [ ] Forward `subtype` cho assistant events ("text" hoặc "thinking")
- [ ] Forward `tool_index` cho tool_use và tool_result events

```python
if event.type == "assistant":
    if not event.text:
        return None
    base["text"] = event.text
    base["subtype"] = event.subtype or "text"   # "text" | "thinking"

elif event.type == "tool_use":
    tool_use = event.data.get("tool_use") or {}
    base["tool"] = tool_use.get("name", "")
    base["input"] = tool_use.get("input", {})
    base["tool_index"] = event.data.get("index", 0)

elif event.type == "tool_result":
    content = event.data.get("tool_result") or {}
    base["content"] = content.get("content", "")
    base["tool_index"] = event.data.get("index", 0)
```

---

#### `frontend/src/hooks/useChat.js`

- [ ] Xử lý `evt.subtype === 'thinking'` → separate thinking bubble (không accumulate vào text buffer)

```js
if (evt.type === 'assistant' && evt.text) {
  if (evt.subtype === 'thinking') {
    // Thinking bubble — separate, not mixed with main text
    appendMsg({ role: 'assistant', type: 'thinking', text: evt.text, phase })
  } else {
    // Normal text — accumulate và patch
    assistantBufRef.current += evt.text
    if (streamingMsgRef.current === null) {
      appendMsg({ role: 'assistant', type: 'text', text: assistantBufRef.current, phase })
      streamingMsgRef.current = 'active'
    } else {
      patchLastAssistant(assistantBufRef.current)
    }
  }
}
```

---

## Step 5 — Tool Timeline (Linked tool_use + tool_result)

> **OpenHuman pattern** — tool_result collapse vào dưới tool_use tương ứng thay vì tách riêng.

**Status: `[ ] todo`** _(cần Step 4 để có `tool_index`)_

### Files thay đổi

#### `frontend/src/hooks/useChat.js`

- [ ] Thêm `toolCallMapRef` để map `tool_index → message id`
- [ ] `tool_use`: lưu message id vào map, status = 'running'
- [ ] `tool_result`: tìm message theo index, patch status = 'done' + result vào đó

```js
const toolCallMapRef = useRef({})

// tool_use handler:
if (evt.type === 'tool_use') {
  flushBuffer()
  const toolIndex = evt.tool_index ?? Object.keys(toolCallMapRef.current).length
  const id = crypto.randomUUID()
  toolCallMapRef.current[toolIndex] = id
  setActiveTools((t) => [...new Set([...t, evt.tool])])
  appendMsg({ id, role: 'tool', type: 'tool_use', tool: evt.tool, input: evt.input, phase, status: 'running' })
}

// tool_result handler:
if (evt.type === 'tool_result') {
  const toolIndex = evt.tool_index ?? (Object.keys(toolCallMapRef.current).length - 1)
  const linkedId = toolCallMapRef.current[toolIndex]
  if (linkedId) {
    setMessages((prev) => prev.map((m) =>
      m.id === linkedId ? { ...m, status: 'done', result: evt.content } : m
    ))
  } else {
    appendMsg({ role: 'tool', type: 'tool_result', content: evt.content, phase })
  }
  setActiveTools([])
}

// Reset map khi start stream mới
toolCallMapRef.current = {}
```

> ChatView/MessageBubble cần render `status: 'running'` (spinner) và `status: 'done'` (result expandable).
> Điều chỉnh component `ChatView` để support trạng thái mới này.

---

## Step 6 — Prompt Injection Guard

> **OpenHuman pattern** — Client-side block trước khi message rời khỏi browser.

**Status: `[ ] todo`**

### Files thay đổi

#### `frontend/src/lib/promptInjectionGuard.js` _(file mới)_

```js
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|another)\s+(?:ai|model|assistant)/i,
  /disregard\s+(?:your\s+)?(?:system\s+prompt|instructions|guidelines)/i,
  /act\s+as\s+(?:if\s+)?(?:you\s+(?:have|had)\s+no|without)\s+(?:restrictions|limitations)/i,
  /<\s*(?:system|SYSTEM)\s*>/,
]

export function checkPromptInjection(message) {
  return INJECTION_PATTERNS.some((p) => p.test(message))
}
```

#### `frontend/src/hooks/useChat.js`

- [ ] Import `checkPromptInjection`
- [ ] Gọi ở đầu `send()`, block và set error nếu detected

```js
import { checkPromptInjection } from '../lib/promptInjectionGuard'

const send = useCallback(async (message, workspaceId) => {
  if (checkPromptInjection(message)) {
    setError('Message blocked: potential prompt injection detected.')
    setStatus(STATUS.ERROR)
    return
  }
  // ... existing logic
}, [...])
```

---

## Step 7 — Chiron Wiki Auto-Draft

> **Sprint 3** — Tự động tạo wiki draft sau mỗi session nếu có nội dung đáng ghi lại.
> Dùng Haiku (nhanh, rẻ), chạy background — không ảnh hưởng UX.

**Status: `[ ] todo`**

### Files thay đổi

#### `backend/app/api/routes/v1/chat.py`

- [ ] Sau `result` event trong `_stream_response()`: nếu `chiron_token` có và response > 200 chars → fire background task
- [ ] Thêm hàm `_maybe_draft_wiki()`

```python
# Trong _stream_response(), sau khi yield result SSE:
if got_result and chiron_token and chiron_workspace_id and session_assistant_text:
    full_response = " ".join(session_assistant_text)
    if len(full_response) > 200:
        task = asyncio.create_task(
            _maybe_draft_wiki(
                chiron_token=chiron_token,
                chiron_workspace_id=chiron_workspace_id,
                conversation_summary=full_response[:2000],
                original_message=body.message,
            )
        )
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)
```

```python
async def _maybe_draft_wiki(
    chiron_token: str,
    chiron_workspace_id: str,
    conversation_summary: str,
    original_message: str,
) -> None:
    from dataclasses import replace as dc_replace
    from app.services.claude_cli import TriageResult
    from app.services.chat_session import run_session

    prompt = (
        f"User asked: {original_message[:300]}\n\n"
        f"You responded with:\n{conversation_summary[:1500]}\n\n"
        "If this conversation contains a reusable pattern, architecture decision, "
        "debugging insight, or process that would help future sessions — "
        "call mcp__chiron__propose_wiki_edit to draft a wiki page. "
        "If there is nothing worth recording, respond with just: SKIP"
    )
    chiron_mcp = {
        "chiron": {
            "url": f"{settings.CHIRON_MCP_BASE_URL}/chiron/mcp",
            "headers": {"x-mcp-token": chiron_token},
        }
    }
    triage = TriageResult(
        allowed_tools=["mcp__chiron__propose_wiki_edit"],
        model="haiku",
    )
    triage = dc_replace(triage, mcp_servers=chiron_mcp)

    try:
        async for event in run_session(
            prompt, triage, permission_mode="auto", workspace_path=None
        ):
            if event.type == "result":
                break
    except Exception as exc:
        logger.debug("Wiki draft background task failed: %s", exc)
```

---

## Tổng kết files thay đổi

| File | Steps | Loại thay đổi |
|---|---|---|
| `frontend/src/hooks/useConversations.js` | 1 | `createConversation` async + API; thêm `loadMessages` |
| `frontend/src/hooks/useChat.js` | 1, 3, 4, 5, 6 | `conversationId` param; save/restore; thinking; tool timeline; guard |
| `frontend/src/App.jsx` | 1, 2 | `key={convs.activeId}`; pass `onLoadMessages`; workspace indicator |
| `frontend/src/lib/promptInjectionGuard.js` | 6 | File mới ~20 lines |
| `backend/app/services/claude_cli.py` | 4 | `_parse_event()` thinking + delta subtype |
| `backend/app/api/routes/v1/chat.py` | 4, 7 | `_normalize_event()` subtype + tool_index; `_maybe_draft_wiki` bg task |

**Không cần:** migration mới, service mới, route mới, thay đổi Docker.

---

## Checklist tổng

- [ ] **Step 1** — Conversation persistence (foundation)
  - [ ] `useConversations.js`: `createConversation` → async API
  - [ ] `useConversations.js`: thêm `loadMessages`
  - [ ] `useChat.js`: nhận `conversationId`, `saveMessage`, `loadHistory`
  - [ ] `App.jsx`: `key={convs.activeId}`, `onLoadMessages`, New Chat flow
- [ ] **Step 2** — Workspace indicator
  - [ ] `App.jsx`: dot indicator trong ChatPanel header
- [ ] **Step 3** — Session ID persistence
  - [ ] `useChat.js`: localStorage restore/persist/clear theo `conversationId`
- [ ] **Step 4** — Text delta + thinking blocks
  - [ ] `claude_cli.py`: `_parse_event()` extract thinking + subtype
  - [ ] `chat.py`: `_normalize_event()` forward subtype + tool_index
  - [ ] `useChat.js`: xử lý `subtype === 'thinking'`
- [ ] **Step 5** — Tool timeline
  - [ ] `useChat.js`: `toolCallMapRef`, link tool_use ↔ tool_result
- [ ] **Step 6** — Prompt injection guard
  - [ ] `frontend/src/lib/promptInjectionGuard.js`: file mới
  - [ ] `useChat.js`: gọi guard trong `send()`
- [ ] **Step 7** — Chiron wiki auto-draft
  - [ ] `chat.py`: fire `_maybe_draft_wiki` sau result event
  - [ ] `chat.py`: implement `_maybe_draft_wiki` background task
