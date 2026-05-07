# AI Spec Generator — Multi-Agent Pipeline

A portfolio project that chains **four specialised AI agents** to turn a plain-English project description into a complete software specification. Planner → Engineer → Cost Estimator → Writer, streamed live to a dark-luxury React frontend via Server-Sent Events.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  Browser (React + Vite)                          │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ Sidebar │  │  Input   │  │  4 Agent Cards   │ │
│  │ History │  │  Form    │  │  + Spec Output   │ │
│  └─────────┘  └──────────┘  └──────────────────┘ │
└────────────────────┬─────────────────────────────┘
                     │  POST /api/v1/pipeline/run
                     │  ← SSE stream
┌────────────────────▼─────────────────────────────┐
│  FastAPI Backend                                  │
│  /api/v1/pipeline/run  (no auth — public demo)   │
│                                                   │
│  ┌──────────────────────────────────────────────┐ │
│  │  Pipeline Runner  (sequential async chain)   │ │
│  │                                              │ │
│  │  1. Planner Agent   → phases JSON            │ │
│  │  2. Engineer Agent  → tech stack + arch JSON │ │
│  │  3. Cost Estimator  → budget + breakdown JSON│ │
│  │  4. Writer Agent    → Markdown spec string   │ │
│  └──────────────────────────────────────────────┘ │
│                                                   │
│  pydantic_ai · AnthropicModel (claude-haiku-4-5) │
└──────────────────────────────────────────────────┘
```

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, pydantic_ai, Anthropic Claude |
| AI Model | claude-haiku-4-5 (fast, cheap for chaining) |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React 18, Vite 8, Tailwind CSS v4 |
| Markdown | react-markdown |

## Setup

### Prerequisites

- Python ≥ 3.12 with [uv](https://docs.astral.sh/uv/)
- Node.js ≥ 18
- An **Anthropic API key**

### 1. Backend

```bash
cd backend

# Copy env file
cp .env.example .env

# Add your Anthropic API key
echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env

# Install deps
uv sync

# Start server (no database required for the pipeline endpoint)
uv run uvicorn app.main:app --reload --port 8000
```

The pipeline endpoint is at `POST /api/v1/pipeline/run` — no auth needed.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite starts at http://localhost:5173 and proxies `/api` to `localhost:8000`.

### 3. Set your Anthropic API key

Open `backend/.env` and set:

```env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Usage

1. Open http://localhost:5173
2. Describe your project in the textarea
3. Click **Generate Spec** (or Cmd+Enter)
4. Watch four agents run sequentially, each card expanding with live results
5. Read the final Markdown spec — click **Copy Spec** to grab it

## SSE Event Format

```
data: {"type": "agent_start",  "agent": "planner"}
data: {"type": "agent_done",   "agent": "planner", "result": {"phases": [...]}}
data: {"type": "agent_start",  "agent": "engineer"}
data: {"type": "agent_done",   "agent": "engineer", "result": {"techStack": [...], ...}}
data: {"type": "agent_start",  "agent": "cost_estimator"}
data: {"type": "agent_done",   "agent": "cost_estimator", "result": {"low": 5000, ...}}
data: {"type": "agent_start",  "agent": "writer"}
data: {"type": "agent_done",   "agent": "writer", "result": {"preview": "..."}}
data: {"type": "complete",     "spec": "# Project Specification: ..."}
```

## Project Structure

```
ai_multi_agent/
├── backend/
│   └── app/
│       ├── agents/
│       │   ├── assistant.py          # Existing chat agent
│       │   └── pipeline/
│       │       ├── planner.py        # Phase planning agent
│       │       ├── engineer.py       # Architecture agent
│       │       ├── cost_estimator.py # Budget agent
│       │       ├── writer.py         # Spec writer agent
│       │       └── runner.py         # SSE pipeline orchestrator
│       └── api/routes/v1/
│           └── pipeline.py           # POST /api/v1/pipeline/run
└── frontend/
    └── src/
        ├── components/
        │   ├── AgentCard.jsx         # Per-agent status + result card
        │   ├── InputForm.jsx         # Project description form
        │   ├── Sidebar.jsx           # Run history (localStorage)
        │   └── SpecOutput.jsx        # Rendered Markdown + copy button
        ├── hooks/
        │   └── usePipeline.js        # SSE streaming hook
        └── App.jsx                   # App layout
```

## Demo Screenshot

![Demo screenshot placeholder — add your own after running the app]

---

*Portfolio project — AI Multi-Agent Pipeline*
