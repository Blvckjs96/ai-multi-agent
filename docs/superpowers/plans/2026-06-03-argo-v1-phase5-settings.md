# Argo v1.0 Phase 5 — Settings Unified

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** SettingsPanel becomes a fully functional 12-tab settings system. Tất cả configuration hiện đang scattered (providers, model, memory, embedding) được centralize vào đây. Users panel cho admin. API keys per user.

**Architecture:** Two-level settings: User Settings (profile, interface, chat, privacy) + Workspace Settings (connections, models, knowledge, web search, audio, users, groups). Backend `/api/v1/settings` CRUD + `/api/v1/users/me` profile endpoint. ProviderConfigTab content moves vào Settings > Connections tab.

**Prerequisite:** Phase 4 complete.

---

## File Map

```
frontend/src/
├── components/settings/
│   ~ SettingsPanel.jsx             Full 12-tab router (replaces skeleton)
│   + tabs/
│     + ProfileTab.jsx              Avatar, name, bio, API key generate/revoke
│     + InterfaceTab.jsx            Theme, text scale, animation toggle
│     + ChatTab.jsx                 Default model, suggestions, voice provider
│     + PrivacyTab.jsx              Memory settings, STM/LTM toggle, data export
│     + ConnectionsTab.jsx          Providers (Ollama, Anthropic, NIM, custom) — replaces ProvidersPanel
│     + ModelsTab.jsx               Available models list, default model select
│     + KnowledgeTab.jsx            Embedding model, vector DB, chunk size
│     + WebSearchTab.jsx            Provider select, API key, result count
│     + AudioTab.jsx                STT/TTS provider config
│     + UsersTab.jsx                User list + approve pending (admin only)
│     + GroupsTab.jsx               Group CRUD + permission matrix (admin only)
│     + AnalyticsTab.jsx            Tracking toggle, retention period
│
backend/app/
├── api/routes/v1/
│   + settings.py                   GET/PATCH /api/v1/settings/user, /settings/workspace
│   ~ users.py                      Add PATCH /api/v1/users/me + POST /api/v1/users/me/avatar
│   + admin.py                      GET /api/v1/admin/users, PATCH /api/v1/admin/users/{id}/role
│   ~ auth.py                       Add POST /api/v1/auth/api-key, DELETE /api/v1/auth/api-key
│   ~ __init__.py                   Register settings, admin routers
├── db/models/
│   + user_settings.py              UserSettings(user_id, settings JSONB) — per-user prefs
├── alembic/versions/
│   + 0013_user_settings.py         user_settings table
```

---

## Task 5.1 — Backend: Settings CRUD

**Files:** `backend/app/db/models/user_settings.py`, `backend/app/api/routes/v1/settings.py`, migration `0013`

### Model:
```python
# backend/app/db/models/user_settings.py
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base

DEFAULT_USER_SETTINGS = {
    "theme":        "dark",
    "text_scale":   1.0,
    "animations":   True,
    "default_model": None,
    "voice_enabled": False,
    "stm_enabled":   True,
    "ltm_enabled":   True,
}

DEFAULT_WORKSPACE_SETTINGS = {
    "embedding_model":    "nomic-embed-text",
    "vector_db":          "pgvector",
    "chunk_size":         512,
    "chunk_overlap":      64,
    "web_search_provider": "duckduckgo",
    "web_search_results":  5,
    "stt_provider":       "whisper",
    "tts_provider":       "webspeech",
    "analytics_enabled":  True,
    "analytics_retention_days": 90,
}

class UserSettings(Base):
    __tablename__ = "user_settings"
    user_id:  Mapped[str] = mapped_column(UUID(as_uuid=True).with_variant(sa.String(36), "postgresql"), primary_key=True)
    settings: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
```

### Routes:
```python
# backend/app/api/routes/v1/settings.py
@router.get("/user")
async def get_user_settings(user: CurrentUser, db: DBSession) -> Any:
    # Fetch from user_settings, merge with defaults
    ...

@router.patch("/user")
async def update_user_settings(body: dict, user: CurrentUser, db: DBSession) -> Any:
    # Deep merge with existing settings
    ...

@router.get("/workspace")
async def get_workspace_settings(user: CurrentUser, db: DBSession) -> Any:
    # Return workspace-level settings (from config + DB)
    ...

@router.patch("/workspace")
async def update_workspace_settings(body: dict, user: CurrentUser, db: DBSession) -> Any:
    # Admin or workspace owner only
    ...
```

### Migration:
```python
# backend/alembic/versions/0013_user_settings.py
revision = "0013"; down_revision = "0012"
def upgrade():
    op.create_table("user_settings",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("settings", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.PrimaryKeyConstraint("user_id", name="user_settings_pkey"),
    )
```

- [ ] Model + migration + apply
- [ ] Settings routes
- [ ] Register router
- [ ] Commit: `feat: add UserSettings model + GET/PATCH /api/v1/settings/user,workspace, migration 0013`

---

## Task 5.2 — Backend: User profile + API key

**Files:** `backend/app/api/routes/v1/users.py`, `backend/app/api/routes/v1/auth.py`

### Add to users.py:
```python
@router.get("/me")
async def get_my_profile(user: CurrentUser) -> Any:
    return {
        "id": str(user.id), "email": user.email, "full_name": user.full_name,
        "role": user.role, "bio": user.bio, "profile_image_url": user.profile_image_url,
        "avatar_url": user.avatar_url,
    }

@router.patch("/me")
async def update_my_profile(body: UserUpdateSchema, user: CurrentUser, db: DBSession) -> Any:
    # Update full_name, bio, profile_image_url
    ...

@router.post("/me/avatar")
async def upload_avatar(file: UploadFile, user: CurrentUser, db: DBSession) -> Any:
    # Save avatar to MinIO or local storage, return URL
    ...
```

### Add to auth.py:
```python
@router.post("/api-key")
async def generate_api_key(user: CurrentUser, db: DBSession) -> Any:
    import secrets
    key = secrets.token_hex(32)
    user.api_key = key
    await db.flush()
    return {"api_key": key}

@router.delete("/api-key", status_code=204)
async def revoke_api_key(user: CurrentUser, db: DBSession) -> None:
    user.api_key = None
    await db.flush()
```

- [ ] Add profile endpoints to users.py
- [ ] Add api-key endpoints to auth.py
- [ ] Commit: `feat: add user profile PATCH + avatar upload + API key generate/revoke`

---

## Task 5.3 — Backend: Admin user management

**File:** `backend/app/api/routes/v1/admin.py`

```python
# backend/app/api/routes/v1/admin.py
@router.get("/users")  # admin only — list all users with roles
async def list_users(user: CurrentAdmin, db: DBSession, skip: int = Query(0), limit: int = Query(50)) -> Any:
    ...

@router.patch("/users/{user_id}/role")  # admin only — approve pending, change role
async def update_user_role(user_id: UUID, body: RoleUpdateBody, user: CurrentAdmin, db: DBSession) -> Any:
    ...

@router.delete("/users/{user_id}")  # admin only — delete user
async def delete_user(user_id: UUID, user: CurrentAdmin, db: DBSession) -> Any:
    ...
```

- [ ] Create admin.py route
- [ ] Register router with `/admin` prefix
- [ ] Commit: `feat: add admin user management — list, role update, delete`

---

## Task 5.4 — SettingsPanel full redesign

**File:** `frontend/src/components/settings/SettingsPanel.jsx`

The SettingsPanel becomes a two-column layout: vertical tab list (left) + tab content (right).

```jsx
// frontend/src/components/settings/SettingsPanel.jsx
import { useState } from 'react'
import { useAppStore } from '../../store/index'
import ProfileTab     from './tabs/ProfileTab'
import InterfaceTab   from './tabs/InterfaceTab'
import ChatTab        from './tabs/ChatTab'
import PrivacyTab     from './tabs/PrivacyTab'
import ConnectionsTab from './tabs/ConnectionsTab'
import ModelsTab      from './tabs/ModelsTab'
import KnowledgeTab   from './tabs/KnowledgeTab'
import WebSearchTab   from './tabs/WebSearchTab'
import AudioTab       from './tabs/AudioTab'
import UsersTab       from './tabs/UsersTab'
import GroupsTab      from './tabs/GroupsTab'

const USER_TABS = [
  { id: 'profile',     label: 'Profile',      icon: '👤' },
  { id: 'interface',   label: 'Interface',    icon: '🖥' },
  { id: 'chat',        label: 'Chat',         icon: '💬' },
  { id: 'privacy',     label: 'Privacy',      icon: '🔒' },
]

const WORKSPACE_TABS = [
  { id: 'connections', label: 'Connections',  icon: '🔌' },
  { id: 'models',      label: 'Models',       icon: '🤖' },
  { id: 'knowledge',   label: 'Knowledge',    icon: '📚' },
  { id: 'web_search',  label: 'Web Search',   icon: '🔍' },
  { id: 'audio',       label: 'Audio',        icon: '🎤' },
  { id: 'users',       label: 'Users',        icon: '👥', adminOnly: true },
  { id: 'groups',      label: 'Groups',       icon: '🏷',  adminOnly: true },
]

export default function SettingsPanel() {
  const [tab, setTab] = useState('profile')
  const { user } = useAppStore()
  const isAdmin = user?.role === 'admin'

  const allTabs = [...USER_TABS, ...WORKSPACE_TABS.filter((t) => !t.adminOnly || isAdmin)]

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Tab list — left sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-argo-border overflow-y-auto py-4">
        <p className="px-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-argo-muted">User</p>
        {USER_TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 w-full px-4 py-2 text-xs font-medium transition-colors border-l-2 ${
              tab === t.id ? 'border-argo-cyan bg-cyan-500/10 text-argo-cyan' : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
            }`}>
            <span className="text-sm">{t.icon}</span>{t.label}
          </button>
        ))}
        <p className="px-4 mt-4 mb-2 text-[10px] font-bold uppercase tracking-wider text-argo-muted">Workspace</p>
        {WORKSPACE_TABS.filter((t) => !t.adminOnly || isAdmin).map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 w-full px-4 py-2 text-xs font-medium transition-colors border-l-2 ${
              tab === t.id ? 'border-argo-cyan bg-cyan-500/10 text-argo-cyan' : 'border-transparent text-argo-secondary hover:bg-argo-elevated'
            }`}>
            <span className="text-sm">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Tab content — right */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'profile'     && <ProfileTab />}
        {tab === 'interface'   && <InterfaceTab />}
        {tab === 'chat'        && <ChatTab />}
        {tab === 'privacy'     && <PrivacyTab />}
        {tab === 'connections' && <ConnectionsTab />}
        {tab === 'models'      && <ModelsTab />}
        {tab === 'knowledge'   && <KnowledgeTab />}
        {tab === 'web_search'  && <WebSearchTab />}
        {tab === 'audio'       && <AudioTab />}
        {tab === 'users'       && <UsersTab />}
        {tab === 'groups'      && <GroupsTab />}
      </div>
    </div>
  )
}
```

- [ ] Create SettingsPanel.jsx (tab router)
- [ ] Create `frontend/src/components/settings/tabs/` directory
- [ ] Commit: `feat: rebuild SettingsPanel with 11-tab two-column layout`

---

## Task 5.5 — Settings tabs implementation

Each tab is a focused, self-contained component. Implement them in this order (highest value first):

### 5.5a — ProfileTab
```jsx
// frontend/src/components/settings/tabs/ProfileTab.jsx
// Sections: Avatar | Name + Bio | API Key
// Avatar: shows current avatar_url, click to upload (POST /api/v1/users/me/avatar)
// Name: input PATCH /api/v1/users/me
// Bio: textarea PATCH /api/v1/users/me
// API Key: show masked key, [Generate] button, [Revoke] button
// Uses ConfirmDialog for revoke
```

### 5.5b — ConnectionsTab (moves ProvidersPanel here)
```jsx
// frontend/src/components/settings/tabs/ConnectionsTab.jsx
// Move content from ProvidersPanel + ProviderConfigTab here
// Sections: Ollama | Anthropic | NIM | Custom providers
// Keep exact same API calls, just new visual wrapper
// Remove ProvidersPanel from sidebar nav (kept as internal tab)
```

### 5.5c — InterfaceTab
```jsx
// Theme: Dark / Light / System (radio group)
// Text scale: slider 0.8–1.4 (sets CSS var(--app-text-scale) via document.documentElement.style)
// Animations: toggle (disables CSS transitions via class on body)
// Sidebar: toggle collapsed default
```

### 5.5d — KnowledgeTab
```jsx
// Embedding model: select (calls /api/v1/chiron/providers/models)
// Chunk size: number input (128–1024, step 64)
// Chunk overlap: number input (0–256)
// PATCH /api/v1/settings/workspace on save
```

### 5.5e — WebSearchTab, AudioTab, PrivacyTab, ChatTab, UsersTab, GroupsTab
Each follows same pattern: fetch current settings, form, PATCH on save.

- [ ] `ProfileTab.jsx`
- [ ] `ConnectionsTab.jsx` (moves from ProvidersPanel)
- [ ] `InterfaceTab.jsx`
- [ ] `KnowledgeTab.jsx`
- [ ] `WebSearchTab.jsx`
- [ ] `AudioTab.jsx`
- [ ] `ChatTab.jsx`
- [ ] `PrivacyTab.jsx`
- [ ] `UsersTab.jsx`
- [ ] `GroupsTab.jsx`
- [ ] Commit: `feat: implement all settings tabs — profile, connections, interface, knowledge, audio, etc.`

---

## Task 5.6 — Remove ProvidersPanel from nav, redirect to Settings

**Files:** `frontend/src/components/AppSidebar.jsx`, `frontend/src/App.jsx`

- [ ] Remove `providers` and `argorouter` from PLATFORM_ITEMS in AppSidebar — they're now in Settings > Connections
- [ ] Keep `ArgorouterPanel` accessible from Settings > Connections tab (add a "Router Status" section there)
- [ ] Ensure `mode === 'providers'` still renders (backward compat for any hardcoded links)
- [ ] Commit: `refactor: move providers to Settings > Connections, clean up nav`
