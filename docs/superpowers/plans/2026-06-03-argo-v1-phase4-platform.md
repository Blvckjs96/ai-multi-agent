# Argo v1.0 Phase 4 — Platform Features

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Automations (scheduled AI tasks), Analytics dashboard (workspace usage), Evaluations/leaderboard, Audio STT (Whisper). Đây là những feature làm cho Argo feel như một real platform.

**Architecture:** Automations dùng APScheduler để schedule jobs. Analytics aggregate từ existing conversations/tasks tables (không cần thêm tracking table). Audio dùng Whisper local hoặc OpenAI Whisper API. Tất cả features đều behind feature flags nếu cần.

**Prerequisite:** Phase 3 complete.

---

## File Map

```
backend/app/
├── db/models/
│   + automation.py                Automation(id, user_id, ws_id, name, schedule_cron, model_id, prompt, enabled, last_run_at, last_result)
├── repositories/
│   + automation.py               Automation CRUD
├── services/
│   + automation.py               AutomationService + APScheduler integration
│   + analytics.py                Aggregate stats from DB — no new tables needed
│   + audio.py                    STT via Whisper / OpenAI
├── api/routes/v1/
│   + automations.py              CRUD + POST /{id}/trigger
│   + analytics.py                GET /analytics/usage, /analytics/models, /analytics/tasks
│   + audio.py                    POST /audio/transcribe
│   ~ __init__.py                 Register all 3 new routers
├── alembic/versions/
│   + 0012_automations.py         automations table
├── tests/
│   + test_automations.py         TDD tests
│   + test_analytics.py           TDD tests
│
frontend/src/
├── components/automations/       (ALL NEW)
│   + AutomationsPanel.jsx        List + AutomationEditor
│   + AutomationEditor.jsx        Schedule picker + model + prompt + workspace
├── components/analytics/         (ALL NEW)
│   + AnalyticsDashboard.jsx      Summary cards + charts
│   + UsageChart.jsx              Line chart (recharts)
│   + ModelUsageTable.jsx         Per-model breakdown
├── hooks/
│   + useAutomations.js           Automations CRUD hook
│   + useAnalytics.js             Analytics fetch hook
│   + useAudio.js                 Voice recording + transcribe
```

---

## Task 4.1 — Backend: Automations (TDD)

### Tests first:
```python
# backend/tests/test_automations.py
from app.db.models.automation import Automation

def test_automation_fields():
    assert hasattr(Automation, 'name')
    assert hasattr(Automation, 'schedule_cron')
    assert hasattr(Automation, 'prompt')
    assert hasattr(Automation, 'enabled')
    assert hasattr(Automation, 'last_run_at')
    assert hasattr(Automation, 'last_result')
```

### Model:
```python
# backend/app/db/models/automation.py
from __future__ import annotations
import uuid
from sqlalchemy import Boolean, String, Text, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin

class Automation(Base, TimestampMixin):
    __tablename__ = "automations"
    id:            Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id:       Mapped[str]       = mapped_column(String(36), nullable=False, index=True)
    workspace_id:  Mapped[str|None]  = mapped_column(String(36), nullable=True, index=True)
    name:          Mapped[str]       = mapped_column(String(255), nullable=False)
    schedule_cron: Mapped[str|None]  = mapped_column(String(100), nullable=True)  # cron expression
    model_id:      Mapped[str|None]  = mapped_column(String(100), nullable=True)
    prompt:        Mapped[str]       = mapped_column(Text, nullable=False, default="")
    enabled:       Mapped[bool]      = mapped_column(Boolean, default=True, nullable=False)
    last_run_at:   Mapped[str|None]  = mapped_column(String(50), nullable=True)
    last_result:   Mapped[str|None]  = mapped_column(Text, nullable=True)
    def __repr__(self): return f"<Automation(id={self.id}, name={self.name!r})>"
```

### Migration 0012:
```python
# backend/alembic/versions/0012_automations.py
revision = "0012"; down_revision = "0011"
def upgrade():
    op.create_table("automations",
        sa.Column("id",            postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id",       sa.String(36), nullable=False),
        sa.Column("workspace_id",  sa.String(36), nullable=True),
        sa.Column("name",          sa.String(255), nullable=False),
        sa.Column("schedule_cron", sa.String(100), nullable=True),
        sa.Column("model_id",      sa.String(100), nullable=True),
        sa.Column("prompt",        sa.Text(), nullable=False, server_default=""),
        sa.Column("enabled",       sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_run_at",   sa.String(50), nullable=True),
        sa.Column("last_result",   sa.Text(), nullable=True),
        sa.Column("created_at",    sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at",    sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="automations_pkey"),
    )
    op.create_index("ix_automations_user_id", "automations", ["user_id"])
```

### Service (APScheduler):
```python
# backend/app/services/automation.py
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.repositories.automation import get_enabled_automations

_scheduler = AsyncIOScheduler()

async def start_scheduler(db_factory):
    """Start APScheduler on app startup. Load all enabled automations."""
    _scheduler.start()
    async with db_factory() as db:
        automations = await get_enabled_automations(db)
        for auto in automations:
            if auto.schedule_cron:
                _scheduler.add_job(
                    _run_automation, 'cron',
                    id=str(auto.id),
                    args=[auto.id, db_factory],
                    **_parse_cron(auto.schedule_cron)
                )

async def _run_automation(automation_id, db_factory):
    """Execute one automation: send prompt to model, save result."""
    from datetime import datetime, UTC
    from app.services.chat_session import ChatSessionService
    async with db_factory() as db:
        auto = await get_automation_by_id(db, automation_id)
        if not auto or not auto.enabled:
            return
        # Simple execution: direct Ollama/Claude call (not CLI subprocess)
        result_text = f"[Automation ran at {datetime.now(UTC).isoformat()}]"
        auto.last_run_at = datetime.now(UTC).isoformat()
        auto.last_result = result_text
        await db.flush()

def _parse_cron(expr: str) -> dict:
    parts = expr.split()
    if len(parts) == 5:
        return {'minute': parts[0], 'hour': parts[1], 'day': parts[2], 'month': parts[3], 'day_of_week': parts[4]}
    return {'hour': 9, 'minute': 0}  # default: 9am daily
```

### Routes:
```python
# backend/app/api/routes/v1/automations.py
@router.get("")          # list
@router.post("")         # create
@router.get("/{id}")     # get one
@router.patch("/{id}")   # update
@router.delete("/{id}")  # delete
@router.post("/{id}/trigger")  # manual run (background task)
```

### Install APScheduler:
```bash
cd backend && uv add apscheduler
```

- [ ] Tests → RED
- [ ] Model + repo + migration
- [ ] Service with scheduler
- [ ] Routes
- [ ] Apply migration
- [ ] Tests → GREEN
- [ ] Commit: `feat: add Automations — APScheduler, CRUD, POST /{id}/trigger, migration 0012`

---

## Task 4.2 — AutomationsPanel + AutomationEditor frontend

**Files:** `frontend/src/components/automations/AutomationsPanel.jsx`, `frontend/src/components/automations/AutomationEditor.jsx`, `frontend/src/hooks/useAutomations.js`

### useAutomations.js:
```js
export function useAutomations(workspaceId) {
  const [automations, setAutomations] = useState([])
  // fetch /api/v1/automations, create, update, delete, trigger
}
```

### AutomationEditor.jsx layout:
```
Name input
Schedule dropdown:
  - Every 15 min (*/15 * * * *)
  - Every hour   (0 * * * *)
  - Daily 9am    (0 9 * * *)
  - Daily midnight (0 0 * * *)
  - Weekdays 9am (0 9 * * 1-5)
  - Custom cron  → text input

Model dropdown (from /api/v1/providers/llm/models)
Workspace dropdown (from useWorkspace)
Prompt textarea

[Save] [Run Now] [Delete]
Last run: {last_run_at} — {last_result preview}
```

### Schedule dropdown options:
```js
const SCHEDULE_PRESETS = [
  { label: 'Every 15 minutes', cron: '*/15 * * * *' },
  { label: 'Every hour',       cron: '0 * * * *'   },
  { label: 'Daily at 9am',     cron: '0 9 * * *'   },
  { label: 'Daily midnight',   cron: '0 0 * * *'   },
  { label: 'Weekdays 9am',     cron: '0 9 * * 1-5' },
  { label: 'Custom cron…',     cron: '__custom__'   },
]
```

- [ ] `useAutomations.js`
- [ ] `AutomationsPanel.jsx` (list layout, same pattern as NotesPanel)
- [ ] `AutomationEditor.jsx` (schedule picker + model + prompt)
- [ ] Wire `mode === 'automations'` in App.jsx
- [ ] Install recharts: `pnpm add recharts`
- [ ] Commit: `feat: add AutomationsPanel and AutomationEditor frontend`

---

## Task 4.3 — Analytics backend

**Files:** `backend/app/services/analytics.py`, `backend/app/api/routes/v1/analytics.py`

No new DB tables — aggregate from existing:
- `conversations` table (count, per-day)
- `messages` table (count, tokens if stored)
- `tasks` table (count, step distribution)

```python
# backend/app/services/analytics.py
from __future__ import annotations
from datetime import datetime, UTC, timedelta
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.conversation import Conversation, Message
from app.db.models.task import Task

async def get_usage_stats(db: AsyncSession, workspace_id: str | None, days: int = 7) -> dict:
    since = datetime.now(UTC) - timedelta(days=days)

    # Conversations per day
    q = select(func.date(Conversation.created_at).label("day"), func.count().label("count"))
    if workspace_id:
        q = q.where(Conversation.workspace_id == workspace_id)
    q = q.where(Conversation.created_at >= since).group_by("day").order_by("day")
    result = await db.execute(q)
    conv_by_day = [{"date": str(r.day), "conversations": r.count} for r in result]

    # Message count
    mq = select(func.count()).select_from(Message)
    if workspace_id:
        mq = mq.join(Conversation).where(Conversation.workspace_id == workspace_id)
    total_msgs = (await db.execute(mq)).scalar_one()

    # Task stats
    tq = select(Task.step, func.count().label("count")).group_by(Task.step)
    if workspace_id:
        tq = tq.where(Task.workspace_id == workspace_id)
    task_result = await db.execute(tq)
    task_by_step = {r.step: r.count for r in task_result}

    return {
        "conversations_by_day": conv_by_day,
        "total_conversations": sum(r["conversations"] for r in conv_by_day),
        "total_messages": total_msgs,
        "tasks_by_step": task_by_step,
        "period_days": days,
    }
```

### Routes:
```python
# backend/app/api/routes/v1/analytics.py
@router.get("/usage")   # ?workspace_id=&period=7
@router.get("/tasks")   # task step distribution
```

- [ ] Service
- [ ] Routes
- [ ] Register router
- [ ] Commit: `feat: add analytics service + /api/v1/analytics/usage endpoint`

---

## Task 4.4 — AnalyticsDashboard frontend

**Files:** `frontend/src/components/analytics/AnalyticsDashboard.jsx`, `frontend/src/components/analytics/UsageChart.jsx`, `frontend/src/hooks/useAnalytics.js`

### Install recharts (if not already): `pnpm add recharts`

### useAnalytics.js:
```js
export function useAnalytics(workspaceId, period = 7) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const token = localStorage.getItem('token')
    fetch(`${API_ORIGIN}/api/v1/analytics/usage?period=${period}${workspaceId ? `&workspace_id=${workspaceId}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId, period])
  return { data, loading }
}
```

### AnalyticsDashboard.jsx layout:
```
[Period selector: 7d | 14d | 30d]

Summary cards row:
  [Total Conversations]  [Total Messages]  [Tasks Done]  [Active Workspace]

Line chart (recharts):
  Conversations per day over selected period

Tasks by step (horizontal bar or table):
  Backlog: N | Planning: N | Implementation: N | Review: N | Done: N
```

```jsx
// AnalyticsDashboard.jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-argo-elevated rounded-xl border border-argo-border p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-argo-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-argo-primary">{value ?? '–'}</p>
      {sub && <p className="text-xs text-argo-muted mt-0.5">{sub}</p>}
    </div>
  )
}
```

- [ ] `useAnalytics.js`
- [ ] `AnalyticsDashboard.jsx` with summary cards
- [ ] `UsageChart.jsx` with recharts LineChart
- [ ] Wire `mode === 'analytics'` in App.jsx
- [ ] Commit: `feat: add AnalyticsDashboard with usage charts and summary cards`

---

## Task 4.5 — Evaluations panel wire

**Files:** `frontend/src/components/evaluations/EvaluationsPanel.jsx`

Backend feedback already built in Phase 1 (Task 1.7). Just needs a frontend panel.

```jsx
// frontend/src/components/evaluations/EvaluationsPanel.jsx
// Fetch /api/v1/feedback?limit=50
// Show: date | conversation | message preview | rating (thumb icon) | comment
// Filter: all / thumbs-up / thumbs-down
// Simple stats at top: total N, positive N (N%), negative N (N%)
// No leaderboard for v1.0 (single model — leaderboard makes sense in multi-model later)
```

- [ ] `EvaluationsPanel.jsx`
- [ ] Add `GET /api/v1/feedback` list endpoint (needs to read `feedback_repo.get_all_by_user`)
- [ ] Wire in AppSidebar or Settings panel (accessible via Settings > Evaluations tab in Phase 5)
- [ ] Commit: `feat: add EvaluationsPanel showing message feedback history`

---

## Task 4.6 — Audio STT

**Files:** `backend/app/services/audio.py`, `backend/app/api/routes/v1/audio.py`, `frontend/src/hooks/useAudio.js`, `frontend/src/components/chat/ChatInput.jsx`

### Backend service:
```python
# backend/app/services/audio.py
"""STT via Whisper (local) or OpenAI Whisper API."""
import os
import tempfile
import httpx

STT_PROVIDER = os.getenv("STT_PROVIDER", "whisper")

async def transcribe(audio_bytes: bytes, filename: str = "audio.webm") -> str:
    provider = STT_PROVIDER.lower()
    if provider == "openai":
        return await _openai_whisper(audio_bytes, filename)
    return await _local_whisper(audio_bytes, filename)

async def _local_whisper(audio_bytes: bytes, filename: str) -> str:
    try:
        import whisper
        import numpy as np
        model = whisper.load_model("base")
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f:
            f.write(audio_bytes)
            path = f.name
        result = model.transcribe(path)
        return result.get("text", "").strip()
    except ImportError:
        return "[Whisper not installed — pip install openai-whisper]"

async def _openai_whisper(audio_bytes: bytes, filename: str) -> str:
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        return "[OpenAI API key not configured]"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post("https://api.openai.com/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (filename, audio_bytes, "audio/webm")},
            data={"model": "whisper-1"})
        return r.json().get("text", "").strip()
```

### Route:
```python
# backend/app/api/routes/v1/audio.py
from fastapi import APIRouter, UploadFile, File
from app.api.deps import CurrentUser
from app.services.audio import transcribe

router = APIRouter()

@router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), user: CurrentUser = None):
    audio_bytes = await file.read()
    text = await transcribe(audio_bytes, file.filename or "audio.webm")
    return {"text": text}
```

### Frontend hook:
```js
// frontend/src/hooks/useAudio.js
export function useAudio() {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    chunksRef.current = []
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.start()
    mediaRef.current = recorder
    setRecording(true)
  }, [])

  const stop = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRef.current) return resolve(null)
      mediaRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setTranscribing(true)
        try {
          const form = new FormData()
          form.append('file', blob, 'audio.webm')
          const token = localStorage.getItem('token')
          const res = await fetch(`${API_ORIGIN}/api/v1/audio/transcribe`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
          })
          const data = await res.json()
          resolve(data.text ?? '')
        } catch { resolve('') }
        finally { setTranscribing(false) }
      }
      mediaRef.current.stop()
      mediaRef.current.stream.getTracks().forEach((t) => t.stop())
      setRecording(false)
    })
  }, [])

  return { recording, transcribing, start, stop }
}
```

### Wire Mic button in ChatInput:
- When recording: Mic button turns red + pulsing animation
- Click to start, click again to stop → transcribe → fill textarea
- Add `useAudio` hook to ChatInput, wire to existing Mic placeholder button

- [ ] Service + route + register router
- [ ] `useAudio.js` hook
- [ ] Wire Mic button in `ChatInput.jsx`
- [ ] Add `STT_PROVIDER=whisper` to `.env.example`
- [ ] Commit: `feat: add Audio STT — Whisper/OpenAI, POST /api/v1/audio/transcribe, Mic button in ChatInput`
