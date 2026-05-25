# Lanes — Reverse Engineering Notes

> Phân tích Lanes desktop app (v0.40.7) từ binary, filesystem, và database.  
> Không có source code — toàn bộ thông tin extract từ: binary strings, `~/.lanes/`, `~/Library/WebKit/com.lanes.app/`, và macOS shell integration scripts.

---

## 1. Tổng quan

**Lanes** là một desktop app quản lý parallel AI coding agents — mỗi "issue" là một task chạy Claude CLI trong terminal riêng biệt, có thể có git worktree riêng.

| Thuộc tính | Giá trị |
|---|---|
| Bundle ID | `com.lanes.app` |
| Version | 0.40.7 (cũng có 0.39.1 trong Homebrew cache) |
| Framework | **Tauri v2** (Rust + macOS WebView) |
| Binary | Mach-O universal (x86_64 + arm64), **44MB** |
| Auth | **Firebase** (Google) |
| Data | `~/.lanes/` + `~/Library/WebKit/com.lanes.app/` |
| Install | `brew install --cask lanes-sh/lanes/lanes` |

---

## 2. Tech Stack

### Runtime
- **Tauri 2.8.3** — frame, IPC, PTY bridge, file system, shell integration
- **WebView (WKWebView)** — toàn bộ UI là React/JS chạy trong native WebView
- **portable-pty** hoặc tương đương — PTY management (native macOS/Linux)
- **Firebase** — authentication + cloud sync
- **SQLite** (`~/.lanes/database.db`) — local data store

### Frontend (inferred từ binary strings)
- React (component lifecycle strings)
- Vite (build tool, từ npm cache artifacts)
- Tailwind hoặc CSS-in-JS (class patterns)
- xterm.js hoặc tương đương — terminal emulator trong WebView

### Backend / Rust commands (từ Tauri invoke handlers)
```
pty_kill    pty_list    git_pull    git_push
mcp_stop    open_url    worktree_create   worktree_list
worktree_remove   worktree_status   detect_base_branch
path_exists   get_git_remote   start_oauth_listener   save_auth_user
```

---

## 3. Data Storage — `~/.lanes/`

```
~/.lanes/
├── database.db          # SQLite — toàn bộ local state
├── auth.json            # Firebase user profile (uid, email, displayName)
├── settings.json        # UI preferences
├── integrations.json    # GitHub/Linear tokens + MCP config
└── analytics_client_id  # Anonymous analytics ID
```

### `auth.json`
```json
{
  "uid": "...",
  "email": "...",
  "displayName": "...",
  "photoUrl": null
}
```

### `settings.json` (known keys)
```json
{
  "selectedBoardSteps": ["done"],
  "boardFilterVersion": 1,
  "folderAccessOnboardingDone": true,
  "activeWorkspaceId": "local",
  "settingsMigrationVersion": 1
}
```
Keys khác từ binary: `terminalFontFamily`, `defaultStartMode`, `selectedCliFlags`, `collapsedStepIds`, `completionSound`, `customSoundPath`, `repoConfigMigrated`

### `integrations.json`
```json
{
  "mcp": { "enabled": false, "port": 5353 },
  "github": { "token": null, "scopes": null, "connectedAt": null },
  "linear": { "token": null, "refreshToken": null, "expiresAt": null, "defaultTeamId": null }
}
```

---

## 4. Database Schema — `database.db`

### `issues` (core entity)
```sql
CREATE TABLE issues (
    id                  INTEGER PRIMARY KEY,
    title               TEXT NOT NULL,
    description         TEXT,
    cwd                 TEXT,                          -- working directory
    step                TEXT NOT NULL,                 -- kanban column
    sort_order          REAL NOT NULL,
    dependencies_json   TEXT NOT NULL,                 -- []
    workflow_id         TEXT NOT NULL,
    tags_json           TEXT NOT NULL,                 -- label UUIDs
    attachments_json    TEXT NOT NULL DEFAULT '[]',
    worktree_strategy   TEXT,                          -- 'create'|'existing'|'none'
    worktree_path       TEXT,
    worktree_name       TEXT,
    base_branch         TEXT,
    component_id        TEXT,                          -- project component FK
    workspace_id        TEXT NOT NULL DEFAULT 'local',
    created_by_uid      TEXT,
    assignee_uid        TEXT,
    deleted_at          INTEGER,
    -- External tracker sync
    external_provider   TEXT,                          -- 'github'|'linear'
    external_id         TEXT,
    external_key        TEXT,                          -- '#42', 'ENG-123'
    external_url        TEXT,
    external_synced_at  INTEGER,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);
```

**Kanban steps** (từ binary + schema): `backlog`, `planning`, `implementation`, `review`, `done`, `misc`

**Worktree strategies**:
- `create` — auto-tạo git worktree khi session start
- `existing` — dùng `worktree_path` có sẵn
- `none` — dùng `cwd` của issue

### `sessions`
```sql
CREATE TABLE sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    issue_id         INTEGER NOT NULL UNIQUE,
    shell            TEXT NOT NULL DEFAULT '/bin/zsh',
    cli              TEXT NOT NULL DEFAULT 'claude',   -- 'claude'|'shell'
    runtime_status   TEXT NOT NULL DEFAULT 'none',     -- xem bên dưới
    pid              INTEGER,
    exit_code        INTEGER,
    started_at       INTEGER,
    stopped_at       INTEGER,
    claude_session_id TEXT,
    plan_mode        INTEGER NOT NULL DEFAULT 0,       -- 0|1
    workspace_id     TEXT NOT NULL DEFAULT 'local',
    runner_uid       TEXT,                             -- collaborative: ai chạy
    runner_device_id TEXT,
    runner_heartbeat_at INTEGER,
    deleted_at       INTEGER,
    created_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL
);
```

**Runtime status values**: `none` → `starting` → `busy` | `awaiting_input` → `stopped`

**`plan_mode`**: khi = 1, Claude chạy với `--permission-mode plan` (không dùng `--enable-auto-mode`)

### `projects` + `project_components`
```sql
CREATE TABLE projects (
    id             TEXT PRIMARY KEY,    -- UUID
    display_id     INTEGER NOT NULL,
    workspace_id   TEXT NOT NULL DEFAULT 'local',
    name           TEXT NOT NULL,
    default_github_repo    TEXT,
    default_linear_team_id TEXT,
    ...
);

CREATE TABLE project_components (
    id         TEXT PRIMARY KEY,   -- UUID
    project_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    git_remote TEXT,
    sort_order REAL NOT NULL DEFAULT 0,
    ...
);
```

### `working_folders`
```sql
CREATE TABLE working_folders (
    id           TEXT PRIMARY KEY,
    path         TEXT NOT NULL UNIQUE,   -- absolute path
    component_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    detected_base TEXT,    -- auto-detected base branch
    git_remote    TEXT,
    last_used_at  INTEGER,
    ...
);
```

### `drafts`
Lưu trạng thái form "tạo issue mới" — 1 draft per `(workspace_id, created_by_uid)`.

### `labels`
```sql
-- default labels: feature (indigo), bug, enhancement
-- Seeded lần đầu khi app khởi động
```

### `quick_commands` (built-in prompts)
Từ binary — các quick action mặc định:

| ID | Name | Prompt |
|---|---|---|
| `review-changes` | Review changes | "Analyze the recent changes and... Cover happy paths, edge cases..." |
| `add-tests` | Add tests | "Analyze the recent changes and add comprehensive tests..." |
| `fix-lint` | Fix lint | "Check for and fix all linting errors in changed files." |
| `refactor` | Refactor | "Review the recent changes and refactor for clarity, simplicity..." |
| `test-worktree` | Test Worktree | `cd {{path}} && npm run dev` |
| `complete-merge` | Merge worktree | "Merge the worktree branch at {{path}} into {{baseBranch}}. Commit all pending..." |

Template syntax: `{{path}}`, `{{baseBranch}}`

### `cli_flags`
Per-workspace Claude CLI flags (grouped by `workspace_id, flag`).

---

## 5. Shell Integration — OSC 633

Lanes inject shell integration script vào mỗi PTY session để track session state.

**Files**:
```
/Applications/Lanes.app/Contents/Resources/resources/shell-integration/
├── shellIntegration-rc.zsh    # 4.7KB
└── shellIntegration-bash.sh   # 4.0KB
```

**Env vars inject**:
```bash
LANES_SHELL_INTEGRATION_DIR=/Applications/Lanes.app/.../shell-integration
LANES_DEBUG_SHELL=0|1
LANES_AUTOINJECT_CLI=0|1
```

**OSC 633 sequences**:
```
\e]633;A\a   → Prompt start     → status: awaiting_input
\e]633;B\a   → Prompt end (input ready)
\e]633;C\a   → Command start    → status: busy
\e]633;D;N\a → Command done (exit N) → status: awaiting_input
\e]633;P;Cwd=/path\a → CWD update
\a           → BEL (idle signal sau khi prompt render)
```

**OSC 1340** (Lanes-specific): diagnostic JSON khi `LANES_AUTOINJECT_CLI=1`.

---

## 6. MCP Server

| Thuộc tính | Giá trị |
|---|---|
| Port | **5353** |
| Transport | **SSE** (Server-Sent Events) |
| Tools | **27 tools** |

### Tool list
**Workspace tools (15)**:
```
lanes_list_issues       lanes_get_issue
lanes_create_issue      lanes_update_issue
lanes_delete_issue      lanes_get_issue_changes
lanes_get_issue_history lanes_start_session
lanes_stop_session      lanes_get_session_status
lanes_list_labels       lanes_list_components
lanes_read_terminal     lanes_get_session_stats
lanes_delete_worktree
```

**GitHub tools (6)**:
```
lanes_github_list_repos    lanes_github_list_issues
lanes_github_search_issues lanes_github_get_issue
lanes_github_create_issue  lanes_github_comment_on_issue
```

**Linear tools (6)**:
```
lanes_linear_list_teams    lanes_linear_list_issues
lanes_linear_search_issues lanes_linear_get_issue
lanes_linear_create_issue  lanes_linear_comment_on_issue
```

### Notable MCP tool details (từ binary docstrings)
```
lanes_start_session:
  - cli: 'claude' (default) | 'shell'
  - planMode: true → plan mode; false → implement mode  
  - prompt: override initial prompt ("" = no prompt injection)

lanes_read_terminal:
  - lines: default 200, max 2000 (scrollback)
  - Works with any CLI (Claude Code, Codex, shell...)

lanes_get_session_status:
  - Returns: issue_id, runtime_status, cli, started_at, stopped_at, has active PTY
```

---

## 7. PTY / Terminal Events

**Tauri event names** (colon separator, khác Argo dùng hyphen):
```
pty:exit    pty:bell    (vs Argo: pty-exit, pty-output)
```

**Tauri commands**:
```
pty_kill    pty_list
```

**Git operations** (qua Rust commands, không phải shell):
```
git_pull    git_push
git rev-list --cached
git ls-files --others
git checkout
git cat-file --staged
```

---

## 8. IDE Integration

Lanes detect và open files trong các IDE:

| Key | Display Name |
|---|---|
| `vscode` | Visual Studio Code |
| `vscode-insiders` | Visual Studio Code - Insiders |
| `cursor` | Cursor |
| `zed` | Zed |
| `sublime` | Sublime Text |
| `intellij` | IntelliJ IDEA |
| `pycharm` | PyCharm |
| `rustrover` | RustRover |
| `goland` | GoLand |
| `fleet` | Fleet |
| `xcode` | Xcode |
| `windsurf` | Windsurf |
| `webstorm` | WebStorm |

---

## 9. GitHub CLI Integration

Lanes dùng `gh` CLI (không phải GitHub API trực tiếp):

```bash
gh pr list --head --state --json url,title,state,isDraft,number --limit 20
gh pr create --title --body --base
gh auth login   # nếu chưa auth
```

Cần `gh` installed: `brew install gh`

---

## 10. Session JSONL Format

Mỗi session ghi lại history vào JSONL file:
```
session-state-issue-unknown.jsonl   # fallback name
```
Format: mỗi dòng là 1 JSON event (agent message, tool call, tool result, v.v.)

---

## 11. UI Layout (inferred từ binary + screenshots)

### Loading screen
- Dark background, striped square logo icon, "Preparing workspace..." text
- Hiện khi Firebase auth đang resolve

### Main layout
```
┌─────────────────────────────────────────────────────────┐
│ [window chrome]                                          │
├──────────┬──────────────────────────────────┬───────────┤
│          │    Top tab bar (browser-like)     │           │
│ Left     ├──────────────────────────────────┤  Right    │
│ sidebar  │                                  │  panel    │
│          │         Main content             │ (detail / │
│ Issues   │    (board / terminal / readme)   │  terminal)│
│ list     │                                  │           │
│          │                                  │           │
└──────────┴──────────────────────────────────┴───────────┘
```

### Kanban board columns (left → right)
`Backlog` → `Planning` → `Implementation` → `Review` → `Done` + `Misc`

- Multi-select: Shift+Click, Cmd+Click
- Right-click context menu: sort options, move to step, set worktree
- Columns collapsible (`collapsedStepIds` setting)

### Settings keys (UI state)
```
selectedBoardSteps    # which steps visible on board
boardFilterVersion
terminalFontFamily
defaultStartMode      # 'plan' | 'implement'
selectedCliFlags
collapsedStepIds
completionSound
```

---

## 12. Session Flow

```
Create Issue
  → Set cwd, step, worktree_strategy
  → Optionally link to GitHub/Linear issue
      ↓
Start Session (lanes_start_session)
  → runtime_status: 'starting'
  → Lanes spawns PTY with claude CLI
  → Injects shell integration (OSC 633)
  → Optionally creates git worktree
      ↓
OSC 633 signals:
  → 633;A → awaiting_input (at prompt)
  → 633;C → busy (command running)
  → 633;D → awaiting_input (done)
      ↓
Stop Session (lanes_stop_session)
  → runtime_status: 'stopped'
  → pid killed, exit_code recorded
```

---

## 13. Collaborative Features

Sessions có `runner_uid`, `runner_device_id`, `runner_heartbeat_at` — Lanes hỗ trợ nhiều người cùng xem/chạy một session (cloud workspace, không chỉ `local`).

---

## 14. So sánh với Argo (hiện tại)

| Feature | Lanes | Argo |
|---|---|---|
| PTY terminal per issue | ✅ | ✅ TerminalTab |
| OSC 633 shell integration | ✅ inject tự động | ✅ parse (không inject) |
| Kanban issue board | ✅ 6 columns | ✅ TaskBoard |
| Git worktree per issue | ✅ auto-create | ❌ |
| MCP server | ✅ 27 tools, port 5353 | ❌ |
| GitHub integration | ✅ via `gh` CLI | ✅ GitHubPanel |
| Linear integration | ✅ | ❌ |
| Plan mode | ✅ per-session toggle | ❌ |
| Multi-user / cloud | ✅ runner_uid sync | ❌ |
| Quick commands | ✅ templated prompts | ❌ |
| JSONL session history | ✅ | ❌ |
| Firebase auth | ✅ | ❌ (JWT local) |
| Session read via MCP | ✅ `lanes_read_terminal` | ❌ |

---

## 15. Files không đọc được

| Nguồn | Lý do |
|---|---|
| Source code JS/React | Compiled + embedded trong binary 44MB |
| Source code Rust | Compiled |
| Full UI component tree | Cần decompile WebView assets |
| Firebase Firestore data | Cloud, cần auth token |
| Session JSONL files | Chưa có session nào được tạo trên máy này |
