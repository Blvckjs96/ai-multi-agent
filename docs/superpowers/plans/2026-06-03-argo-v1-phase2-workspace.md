# Argo v1.0 Phase 2 — Workspace Panel + Notes

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Full Workspace panel (Models/Knowledge/Tools/Skills/Prompts tabs) + Notes feature integrating với Chiron wiki. Coworker builder redesigned theo OWU ModelEditor pattern.

**Architecture:** New `WorkspacePanel` router component with 5 tabs. Notes là panel riêng trong sidebar. Tất cả features đều có backend routes tương ứng. CodeEditor (từ Phase 0 UI lib) được dùng cho ToolkitEditor và SkillEditor.

**Prerequisite:** Phase 1 complete.

---

## File Map

```
frontend/src/
├── App.jsx                              ~ Wire mode='workspace' → WorkspacePanel, mode='notes' → NotesPanel
├── components/workspace/               (ALL NEW)
│   + WorkspacePanel.jsx                Tab router: Models | Knowledge | Tools | Skills | Prompts
│   + ModelEditor.jsx                   Coworker builder: prompt + KB + tools + skills + model
│   + ToolkitEditor.jsx                 Python function editor + test runner
│   + SkillEditor.jsx                   Markdown skill editor
│   + PromptEditor.jsx                  Prompt template editor with {{var}} preview
│   + KnowledgeWorkspace.jsx            KB list + create/delete + file/URL/text add
├── components/notes/                   (ALL NEW)
│   + NotesPanel.jsx                    Left list (pin/search) + right editor layout
│   + NoteEditor.jsx                    Markdown editor + AI assist sidebar
├── hooks/
│   + useWorkspacePanel.js              Fetch tools, skills, prompts, KB lists
│   + useNotes.js                       Notes CRUD hook
│
backend/app/
├── db/models/
│   + note.py                           Note(id, user_id, workspace_id, title, content, pinned)
│   ~ coworker.py                       Add knowledge_ids[], tool_ids[], skill_ids[] JSONB columns
├── repositories/
│   + note.py                           Note CRUD
│   ~ coworker.py                       Update create/update to handle new fields
├── services/
│   + note.py                           NoteService: CRUD + AI assist (calls chat stream)
│   ~ coworker.py                       CoworkerService: handle knowledge/tool/skill attachments
├── api/routes/v1/
│   + notes.py                          CRUD + pin + GET /notes/{id}/ai-assist (SSE)
│   ~ coworkers.py                      Add knowledge_ids/tool_ids/skill_ids to create/update
│   ~ __init__.py                       Register notes router
├── alembic/versions/
│   + 0011_notes_coworker_upgrade.py    notes table + coworker new columns
├── tests/
│   + test_notes.py                     TDD: note CRUD
```

---

## Task 2.1 — WorkspacePanel tab router

**File:** `frontend/src/components/workspace/WorkspacePanel.jsx`

```jsx
// frontend/src/components/workspace/WorkspacePanel.jsx
import { useState } from 'react'
import { Bot, BookOpen, Wrench, Star, AlignLeft } from 'lucide-react'
import ModelEditor from './ModelEditor'
import KnowledgeWorkspace from './KnowledgeWorkspace'
import ToolkitEditor from './ToolkitEditor'
import SkillEditor from './SkillEditor'
import PromptEditor from './PromptEditor'

const TABS = [
  { id: 'models',    label: 'Models',    icon: Bot },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'tools',     label: 'Tools',     icon: Wrench },
  { id: 'skills',    label: 'Skills',    icon: Star },
  { id: 'prompts',   label: 'Prompts',   icon: AlignLeft },
]

export default function WorkspacePanel({ workspaceId }) {
  const [tab, setTab] = useState('models')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 border-b border-argo-border bg-argo-surface flex-shrink-0 h-11">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2',
                tab === t.id
                  ? 'border-argo-cyan text-argo-cyan'
                  : 'border-transparent text-argo-muted hover:text-argo-secondary',
              ].join(' ')}
            >
              <Icon size={13} strokeWidth={1.8} />
              {t.label}
            </button>
          )
        })}
      </div>
      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'models'    && <ModelEditor workspaceId={workspaceId} />}
        {tab === 'knowledge' && <KnowledgeWorkspace workspaceId={workspaceId} />}
        {tab === 'tools'     && <ToolkitEditor workspaceId={workspaceId} />}
        {tab === 'skills'    && <SkillEditor workspaceId={workspaceId} />}
        {tab === 'prompts'   && <PromptEditor workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
```

- [ ] Wire `mode === 'workspace'` in `App.jsx` → `<WorkspacePanel workspaceId={workspaceId} />`
- [ ] Commit: `feat: add WorkspacePanel with 5-tab router`

---

## Task 2.2 — ModelEditor (Coworker builder redesign)

**File:** `frontend/src/components/workspace/ModelEditor.jsx`

ModelEditor là interface để tạo/sửa AI coworker. Mỗi coworker = model + system prompt + attached knowledge bases + tools + skills.

Key sections:
1. **Header**: name + model dropdown (calls `/api/v1/providers/llm/models`)
2. **System Prompt**: textarea
3. **Knowledge**: multi-select từ KB list (`/api/v1/chiron/{ws}/sources`)
4. **Tools**: multi-select từ tools list
5. **Skills**: multi-select từ skills list
6. **Access**: private/workspace dropdown
7. **Save/Delete** buttons

```jsx
// frontend/src/components/workspace/ModelEditor.jsx
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, Save } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'
import ConfirmDialog from '../ui/ConfirmDialog'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function ModelEditor({ workspaceId }) {
  const [coworkers, setCoworkers] = useState([])
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState({ name: '', model_name: '', system_prompt: '', knowledge_ids: [], tool_ids: [], skill_ids: [] })
  const [models, setModels] = useState([])
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_ORIGIN}/api/v1/coworkers`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : { items: [] })
      .then((d) => setCoworkers(d.items ?? d))
      .catch(() => {})
    fetch(`${API_ORIGIN}/api/v1/providers/llm/models`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : [])
      .then(setModels)
      .catch(() => {})
  }, [])

  const selectCoworker = (cw) => {
    setSelected(cw)
    setForm({ name: cw.name, model_name: cw.model_name ?? '', system_prompt: cw.system_prompt ?? '', knowledge_ids: cw.knowledge_ids ?? [], tool_ids: cw.tool_ids ?? [], skill_ids: cw.skill_ids ?? [] })
  }

  const save = async () => {
    setSaving(true)
    try {
      const method = selected ? 'PATCH' : 'POST'
      const url    = selected ? `${API_ORIGIN}/api/v1/coworkers/${selected.id}` : `${API_ORIGIN}/api/v1/coworkers`
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(form) })
      if (res.ok) {
        const updated = await res.json()
        setCoworkers((prev) => selected
          ? prev.map((c) => c.id === updated.id ? updated : c)
          : [updated, ...prev])
        setSelected(updated)
      }
    } finally { setSaving(false) }
  }

  const deleteCoworker = async () => {
    if (!selected) return
    await fetch(`${API_ORIGIN}/api/v1/coworkers/${selected.id}`, { method: 'DELETE', headers: authHeaders() })
    setCoworkers((prev) => prev.filter((c) => c.id !== selected.id))
    setSelected(null)
    setForm({ name: '', model_name: '', system_prompt: '', knowledge_ids: [], tool_ids: [], skill_ids: [] })
    setDeleteConfirm(false)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: list */}
      <div className="w-56 flex-shrink-0 border-r border-argo-border flex flex-col overflow-hidden">
        <div className="p-3 border-b border-argo-border flex items-center justify-between">
          <span className="text-xs font-semibold text-argo-secondary">Coworkers</span>
          <button type="button" onClick={() => { setSelected(null); setForm({ name: '', model_name: '', system_prompt: '', knowledge_ids: [], tool_ids: [], skill_ids: [] }) }}
            className="w-6 h-6 flex items-center justify-center rounded text-argo-muted hover:text-argo-cyan hover:bg-cyan-500/10 transition-colors">
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {coworkers.map((cw) => (
            <button key={cw.id} type="button" onClick={() => selectCoworker(cw)}
              className={`w-full px-3 py-2 text-left text-xs transition-colors border-l-2 ${
                selected?.id === cw.id ? 'border-argo-cyan bg-cyan-500/10 text-argo-primary' : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
              }`}>
              {cw.name}
            </button>
          ))}
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Coworker name"
            className="flex-1 bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary outline-none focus:border-argo-cyan transition-colors" />
          <select value={form.model_name} onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
            className="bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-secondary outline-none focus:border-argo-cyan">
            <option value="">Auto model</option>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1.5">System Prompt</label>
          <textarea value={form.system_prompt} onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
            rows={8} placeholder="You are a helpful AI assistant…"
            className="w-full bg-argo-elevated border border-argo-border rounded-lg px-3 py-2 text-sm text-argo-primary resize-y outline-none focus:border-argo-cyan transition-colors font-mono leading-relaxed" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={save} disabled={saving || !form.name}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-argo-cyan text-[#001218] disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity">
            <Save size={12} />{saving ? 'Saving…' : 'Save'}
          </button>
          {selected && (
            <button type="button" onClick={() => setDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-argo-error border border-red-500/20 hover:bg-red-500/10 transition-colors">
              <Trash2 size={12} />Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog open={deleteConfirm} title="Delete coworker"
        message={`Delete "${selected?.name}"? This cannot be undone.`}
        danger onConfirm={deleteCoworker} onCancel={() => setDeleteConfirm(false)} />
    </div>
  )
}
```

- [ ] Commit: `feat: add ModelEditor (coworker builder) in Workspace panel`

---

## Task 2.3 — KnowledgeWorkspace

**File:** `frontend/src/components/workspace/KnowledgeWorkspace.jsx`

Display and manage knowledge bases (wraps existing Chiron panel UI). Key actions:
- List knowledge bases (folders/sources from `/api/v1/chiron/{ws}/sources`)
- Create new KB: name + description
- Add content: "+ Add" dropdown → File upload / URL / Text inline
- Delete KB

```jsx
// frontend/src/components/workspace/KnowledgeWorkspace.jsx
// Wraps ChironPanel source management with cleaner UX
// Primary: reuse existing chiron source APIs
// Show sources as cards with file count + last updated
// "+ Add content" button → Modal with 3 tabs: Upload / URL / Text
import { useEffect, useState } from 'react'
import { Plus, Trash2, FileText, Link, AlignLeft } from 'lucide-react'
import { API_ORIGIN } from '../../lib/api'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'

// Implementation: fetch /api/v1/chiron/{workspaceId}/sources
// Upload: POST /api/v1/chiron/{workspaceId}/upload
// Text: POST /api/v1/chiron/{workspaceId}/ingest (existing endpoint)
// Delete: DELETE /api/v1/chiron/{workspaceId}/sources/{id}
// (All endpoints already exist in chiron.py)
export default function KnowledgeWorkspace({ workspaceId }) {
  // ... full implementation using existing chiron endpoints
  // See chiron.py for available endpoints
  return (
    <div className="flex-1 p-5 overflow-y-auto">
      <p className="text-xs text-argo-muted">Knowledge workspace — wraps Chiron sources management</p>
      {/* TODO: implement in task execution */}
    </div>
  )
}
```

- [ ] Full implementation during task execution (reads chiron.py to discover endpoints)
- [ ] Commit: `feat: add KnowledgeWorkspace panel in Workspace tab`

---

## Task 2.4 — ToolkitEditor

**File:** `frontend/src/components/workspace/ToolkitEditor.jsx`

Python function editor for creating callable tools. Uses `CodeEditor` from Phase 0.

```jsx
// frontend/src/components/workspace/ToolkitEditor.jsx
// Left: list of tools
// Right: CodeEditor (python) + name/description + Test panel
// Test: enter input JSON → POST /api/v1/tools/{id}/test → show output
// Uses CodeEditor from components/ui/CodeEditor.jsx
import CodeEditor from '../ui/CodeEditor'
// ... implementation
```

Backend endpoint needed: `POST /api/v1/tools/{id}/test` — runs function with provided args.

- [ ] Create ToolkitEditor.jsx (list + editor + test runner)
- [ ] Backend: add `POST /api/v1/tools/{id}/test` to existing `tools.py` route (safe sandbox via subprocess with timeout)
- [ ] Commit: `feat: add ToolkitEditor with Python editor and test runner`

---

## Task 2.5 — SkillEditor + PromptEditor

**Files:** `frontend/src/components/workspace/SkillEditor.jsx`, `frontend/src/components/workspace/PromptEditor.jsx`

SkillEditor: markdown editor for skill content (name + description + content textarea)  
PromptEditor: prompt template editor with `{{variable}}` preview — renders preview of template with sample values

```jsx
// Both follow same pattern: left list + right editor form + save/delete
// SkillEditor calls /api/v1/skills (existing)
// PromptEditor: needs new /api/v1/prompts endpoint
```

Backend: add `prompts.py` route (simple CRUD: id, user_id, name, description, content, variables[]).

- [ ] SkillEditor.jsx
- [ ] PromptEditor.jsx
- [ ] Backend: `prompts.py` route + `Prompt` model + migration `0012_prompts`
- [ ] Commit: `feat: add SkillEditor and PromptEditor in Workspace panel`

---

## Task 2.6 — Backend: Notes (TDD)

**Files:** `backend/tests/test_notes.py`, `backend/app/db/models/note.py`, `backend/app/repositories/note.py`, `backend/app/services/note.py`, `backend/app/api/routes/v1/notes.py`, migration `0011`

### TDD tests first:
```python
# backend/tests/test_notes.py
from app.db.models.note import Note

def test_note_has_required_fields():
    assert hasattr(Note, 'title')
    assert hasattr(Note, 'content')
    assert hasattr(Note, 'user_id')
    assert hasattr(Note, 'pinned')
```

### Model:
```python
# backend/app/db/models/note.py
class Note(Base, TimestampMixin):
    __tablename__ = "notes"
    id:           Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:      Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    workspace_id: Mapped[str|None]  = mapped_column(String(36), nullable=True, index=True)
    title:        Mapped[str]       = mapped_column(String(500), nullable=False, default="Untitled")
    content:      Mapped[str]       = mapped_column(Text, nullable=False, default="")
    pinned:       Mapped[bool]      = mapped_column(Boolean, default=False, nullable=False)
```

### Routes: `GET /notes`, `POST /notes`, `GET /notes/{id}`, `PATCH /notes/{id}`, `DELETE /notes/{id}`, `POST /notes/{id}/pin`

### Migration 0011:
```python
# backend/alembic/versions/0011_notes.py
revision = "0011"; down_revision = "0010"
def upgrade():
    op.create_table("notes",
        sa.Column("id",           postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id",      sa.String(36), nullable=False),
        sa.Column("workspace_id", sa.String(36), nullable=True),
        sa.Column("title",        sa.String(500), nullable=False, server_default="Untitled"),
        sa.Column("content",      sa.Text(), nullable=False, server_default=""),
        sa.Column("pinned",       sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at",   sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",   sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="notes_pkey"),
    )
    op.create_index("ix_notes_user_id",      "notes", ["user_id"])
    op.create_index("ix_notes_workspace_id", "notes", ["workspace_id"])
```

- [ ] Implement all files
- [ ] Apply migration
- [ ] Commit: `feat: add Note model, repo, notes CRUD routes, migration 0011`

---

## Task 2.7 — NotesPanel + NoteEditor frontend

**Files:** `frontend/src/components/notes/NotesPanel.jsx`, `frontend/src/components/notes/NoteEditor.jsx`, `frontend/src/hooks/useNotes.js`

### useNotes.js:
```js
// CRUD + pin + search for notes
// Calls /api/v1/notes
export function useNotes(workspaceId) {
  const [notes, setNotes] = useState([])
  const [activeId, setActiveId] = useState(null)
  // fetch, create, update (debounced auto-save 1s), delete, pin, unpin
}
```

### NotesPanel.jsx layout:
```
[Left: 240px list panel]  [Right: flex-1 editor]
  ─ Search input            ─ Title input (large)
  ─ [+ New Note]            ─ Textarea (markdown)
  ─ Pinned section          ─ Toolbar: Bold/Italic/Code/Link
  ─ All notes list          ─ AI Assist button → slide-in drawer
```

### NoteEditor.jsx:
- Large title input + markdown textarea with auto-save (1s debounce)
- "AI Assist" button opens `Drawer` (from Phase 0) with a mini chat
- Mini chat calls `/api/v1/chat/stream` with selected text as context

- [ ] `useNotes.js` hook
- [ ] `NotesPanel.jsx` (list layout)
- [ ] `NoteEditor.jsx` (editor + AI assist drawer)
- [ ] Wire `mode === 'notes'` in App.jsx → `<NotesPanel workspaceId={workspaceId} />`
- [ ] Commit: `feat: add NotesPanel and NoteEditor with AI assist drawer`
