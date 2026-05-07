# ai_multi_agent

A FastAPI project

Generated with [Full-Stack AI Agent Template](https://github.com/vstorm-co/full-stack-ai-agent-template).

## Stack

| Component | Technology |
|-----------|-----------|
| **Backend** | FastAPI + Pydantic v2 |
| **Database** | PostgreSQL (async) |
| **Auth** | JWT + API Key + refresh tokens |
| **Cache** | Redis |
| **AI Framework** | pydantic_ai (anthropic) |
| **Tasks** | celery |

## Quick Start

```bash
# Install dependencies
make install
# One-command setup (Docker required)
make quickstart
```
This will:
1. Install Python dependencies
2. Start all Docker services (database, Redis, vector store, etc.)
3. Run database migrations
4. Create an admin user (`admin@example.com` / `admin123`)

**Access:**
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- Admin: http://localhost:8000/admin

## Manual Setup

If you prefer to set up step by step:

```bash
# 1. Install dependencies
make install
# 2. Start database
make docker-db
# 3. Create and apply migrations
make db-migrate    # Enter: "Initial migration"
make db-upgrade

# 4. Create admin user
make create-admin

# 5. Start backend
make run
```

## Commands

Run `make help` for all available commands. Key ones:

| Command | Description |
|---------|-------------|
| `make run` | Start dev server with hot reload |
| `make test` | Run tests |
| `make lint` | Check code quality |
| `make format` | Auto-format code |
| `make db-migrate` | Create new migration |
| `make db-upgrade` | Apply migrations |
| `make create-admin` | Create admin user |
| `make quickstart` | Full setup (install + docker + db + admin) |
| `make docker-up` | Start all Docker services |
| `make docker-down` | Stop all services |


## AI Agent

Using **pydantic_ai** with **anthropic** provider.

### Customize

- **System prompt:** `app/agents/prompts.py`
- **Add tools:** See `docs/howto/add-agent-tool.md`
- **Agent config:** `.env` → `AI_MODEL`, `AI_TEMPERATURE`

## Message Ratings

Users can rate AI responses with 👍/👎 and optional feedback comments.
Administrators can view analytics and export rating data.

See `docs/howto/use-ratings.md` for full documentation.

## Project Structure

```
backend/app/
├── api/routes/v1/        # API endpoints
├── core/config.py        # Settings (from .env)
├── services/             # Business logic
├── repositories/         # Data access
├── schemas/              # Pydantic models
├── db/models/            # Database models
├── agents/               # AI agents & tools
├── commands/             # CLI commands (auto-discovered)
└── worker/               # Background tasks
```

## Guides

| Guide | Description |
|-------|-------------|
| `docs/howto/add-api-endpoint.md` | Add a new API endpoint |
| `docs/howto/add-agent-tool.md` | Create a new agent tool |
| `docs/howto/customize-agent-prompt.md` | Customize agent behavior |
| `docs/howto/add-background-task.md` | Add background tasks |

## Environment Variables

All config is in `backend/.env`. Key variables:

```bash
POSTGRES_HOST=localhost
POSTGRES_PASSWORD=postgres
ANTHROPIC_API_KEY=sk-ant-...
```

See `backend/.env.example` for all available variables.

---

*Generated with [Full-Stack AI Agent Template](https://github.com/vstorm-co/full-stack-ai-agent-template) v0.2.6*
