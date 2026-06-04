"""API v1 router aggregation."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from fastapi import APIRouter

from app.api.routes.v1 import health
from app.api.routes.v1 import admin_ratings, auth, users
from app.api.routes.v1 import conversations
from app.api.routes.v1 import admin_conversations
from app.api.routes.v1 import agent
from app.api.routes.v1 import files
from app.api.routes.v1 import pipeline
from app.api.routes.v1 import chat
from app.api.routes.v1 import providers
from app.api.routes.v1 import triage
from app.api.routes.v1 import workspace
from app.api.routes.v1 import chiron
from app.api.routes.v1 import chiron_providers
from app.api.routes.v1 import change_log
from app.api.routes.v1 import task_board
from app.api.routes.v1 import task_sessions
from app.api.routes.v1 import github
from app.api.routes.v1 import provider_configs
from app.api.routes.v1 import settings
from app.api.routes.v1 import codegraph
from app.api.routes.v1 import argorouter
from app.api.routes.v1 import coworkers
from app.api.routes.v1 import feedback
from app.api.routes.v1 import notes
from app.api.routes.v1 import tools
from app.api.routes.v1 import workspace_skills
from app.api.routes.v1 import prompts

# Argon knowledge-base modules
from app.argon.api import (
    admin_embeddings as argon_admin_embeddings,
    admin_models as argon_admin_models,
    admin_settings as argon_admin_settings,
    admin_stats as argon_admin_stats,
    audit as argon_audit,
    knowledge_types as argon_knowledge_types,
    notes as argon_notes,
    notifications as argon_notifications,
    projects as argon_projects,
    rbac as argon_rbac,
    roles as argon_roles,
    skill_contributions as argon_skill_contributions,
    skills as argon_skills,
    sources as argon_sources,
    wiki as argon_wiki,
    wiki_drafts as argon_wiki_drafts,
    wiki_images as argon_wiki_images,
)

v1_router = APIRouter()

# Health check routes (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Authentication routes
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# User routes
v1_router.include_router(users.router, prefix="/users", tags=["users"])

# Admin routes
v1_router.include_router(admin_ratings.router, prefix="/admin/ratings", tags=["admin:ratings"])

# Conversation routes (AI chat persistence)
v1_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])

# AI Agent routes
v1_router.include_router(agent.router, tags=["agent"])

# File upload/download routes
v1_router.include_router(files.router, tags=["files"])

# Admin: conversation browser + user listing
v1_router.include_router(
    admin_conversations.router, prefix="/admin/conversations", tags=["admin-conversations"]
)

# Pipeline (no auth — portfolio demo)
v1_router.include_router(pipeline.router, tags=["pipeline"])

# Provider status + routing mode (Argo hybrid router)
v1_router.include_router(providers.router)

# Task Triage (3-layer classifier)
v1_router.include_router(triage.router)

# Chat — Claude CLI SSE streaming
v1_router.include_router(chat.router)

# Workspace management
v1_router.include_router(workspace.router)

# Chiron knowledge engine
v1_router.include_router(chiron.router)

# Chiron provider registry (hardware detection, model selection)
v1_router.include_router(chiron_providers.router)

# Change timeline (git-backed)
v1_router.include_router(change_log.router)

# Task board (Kanban)
v1_router.include_router(task_board.router)

# Task sessions (per-issue PTY/CLI session tracking)
v1_router.include_router(task_sessions.router)

# GitHub OAuth + API proxy
v1_router.include_router(github.router)

# User-configured providers + Claude model selector
v1_router.include_router(provider_configs.router)

# Desktop app settings (Claude auth, system info)
v1_router.include_router(settings.router)

# Codegraph — per-workspace code-intelligence MCP servers
v1_router.include_router(codegraph.router)
v1_router.include_router(argorouter.router)

# AI coworker personas
v1_router.include_router(coworkers.router)

# Message feedback (thumbs up/down ratings)
v1_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])

# Notes (personal notes with pin support)
v1_router.include_router(notes.router)

# Tools (user-defined Python functions callable by AI)
v1_router.include_router(tools.router)

# Workspace Skills (user-defined skill instructions)
v1_router.include_router(workspace_skills.router)

# Prompts (user-defined prompt templates with variable placeholders)
v1_router.include_router(prompts.router)

# ---------------------------------------------------------------------------
# Argon — knowledge-base engine (wiki, sources, MRP, skills, RBAC, admin)
# All endpoints are prefixed /argon/... to namespace from Argo's own routes.
# ---------------------------------------------------------------------------
argon_router = APIRouter(prefix="/argon", tags=["argon"])
argon_router.include_router(argon_wiki.router)
argon_router.include_router(argon_wiki_drafts.router)
argon_router.include_router(argon_wiki_images.router)
argon_router.include_router(argon_notes.router)
argon_router.include_router(argon_sources.router)
argon_router.include_router(argon_projects.router)
argon_router.include_router(argon_knowledge_types.router)
argon_router.include_router(argon_audit.router)
argon_router.include_router(argon_notifications.router)
argon_router.include_router(argon_rbac.router)
argon_router.include_router(argon_roles.router)
argon_router.include_router(argon_skill_contributions.router)
argon_router.include_router(argon_skills.router)
argon_router.include_router(argon_admin_settings.router)
argon_router.include_router(argon_admin_embeddings.router)
argon_router.include_router(argon_admin_models.router)
argon_router.include_router(argon_admin_stats.router)
v1_router.include_router(argon_router)
