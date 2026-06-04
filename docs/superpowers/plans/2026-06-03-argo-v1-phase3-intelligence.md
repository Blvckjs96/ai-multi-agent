# Argo v1.0 Phase 3 — Intelligence (RAG + Web Search)

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Chiron RAG upgraded to hybrid BM25 + vector search với reranking. Web search wired end-to-end. `[kb: name]` tag trong chat triggers knowledge injection. Citations hiển thị trong ChatBubble.

**Architecture:** Backend `chiron.py` gets a new `hybrid_search` endpoint. `web_search.py` service được thêm. Chat stream handler trong `chat.py` parse `[kb: name]` tags và prepend relevant chunks. Frontend ChatBubble shows `sources[]` from stream as citation chips.

**Prerequisite:** Phase 2 complete.

---

## File Map

```
backend/app/
├── services/
│   + web_search.py                   Multi-provider: SearXNG / Brave / DuckDuckGo
│   ~ chiron.py                       Add BM25 index + hybrid_search() + reranking
├── api/routes/v1/
│   + web_search.py                   POST /api/v1/web-search?q=&provider=&limit=5
│   ~ chiron.py                       Add POST /{ws_id}/hybrid-search endpoint
│   ~ chat.py                         Parse [kb: name] tags → inject chunks → return sources[]
│   ~ __init__.py                     Register web_search router
│
frontend/src/
├── components/chat/
│   ~ ChatBubble.jsx                  Render sources[] as citation chips below response
│   + Citations.jsx                   Citation chip + modal showing full source excerpt
│   ~ ChatView.jsx                    Pass sources from stream to ChatBubble
│   ~ ChatInput.jsx                   Wire webSearch toggle → send web_search flag to backend
├── hooks/
│   + useWebSearch.js                 Toggle state + fetch /api/v1/web-search
```

---

## Task 3.1 — BM25 hybrid search in Chiron backend

**Files:** `backend/app/services/chiron.py`, `backend/pyproject.toml`

### Install:
```bash
cd backend
uv add rank-bm25
```

### New `hybrid_search` function in `chiron.py`:
```python
# backend/app/services/chiron.py — add method to ChironService

async def hybrid_search(
    self, workspace_id: UUID, query: str, top_k: int = 8, alpha: float = 0.7
) -> list[dict]:
    """
    Hybrid search: alpha * dense_score + (1-alpha) * bm25_score.
    Returns list of {source_id, source_name, chunk, score, page}.
    """
    from rank_bm25 import BM25Okapi

    # 1. Dense vector search (existing)
    dense_results = await self._vector_search(workspace_id, query, top_k=top_k * 2)

    # 2. BM25 over same corpus
    corpus = [r["chunk"] for r in dense_results]
    if not corpus:
        return []
    tokenized = [c.lower().split() for c in corpus]
    bm25 = BM25Okapi(tokenized)
    bm25_scores = bm25.get_scores(query.lower().split())

    # 3. Normalize + combine scores
    max_dense = max((r["score"] for r in dense_results), default=1.0) or 1.0
    max_bm25  = max(bm25_scores, default=1.0) or 1.0

    combined = []
    for i, r in enumerate(dense_results):
        hybrid_score = (
            alpha * (r["score"] / max_dense) +
            (1 - alpha) * (bm25_scores[i] / max_bm25)
        )
        combined.append({**r, "score": hybrid_score})

    # 4. Sort by hybrid score, return top_k
    combined.sort(key=lambda x: x["score"], reverse=True)
    return combined[:top_k]
```

### Add endpoint to `chiron.py` route:
```python
@router.post("/{workspace_id}/hybrid-search")
async def hybrid_search(workspace_id: UUID, body: SearchRequest, user: CurrentUser, service: ChironSvc) -> Any:
    results = await service.hybrid_search(workspace_id, body.query, top_k=body.top_k or 8)
    return {"items": results, "total": len(results)}
```

- [ ] Install `rank-bm25`
- [ ] Implement `hybrid_search` in ChironService
- [ ] Add route endpoint
- [ ] Test manually: `curl -X POST /api/v1/chiron/{ws_id}/hybrid-search -d '{"query": "test"}'`
- [ ] Commit: `feat: add BM25 hybrid search to Chiron — alpha=0.7 dense + 0.3 BM25`

---

## Task 3.2 — Reranking layer

**Files:** `backend/app/services/chiron.py`, `backend/pyproject.toml`

### Install (optional — heavy model):
```bash
uv add sentence-transformers
```

### Add reranking to hybrid_search (enabled via env var `CHIRON_RERANK=true`):
```python
# In chiron.py hybrid_search, after step 4:
import os
if os.getenv("CHIRON_RERANK") == "true":
    try:
        from sentence_transformers import CrossEncoder
        model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
        pairs = [[query, r["chunk"]] for r in combined]
        rerank_scores = model.predict(pairs)
        for i, r in enumerate(combined):
            r["score"] = float(rerank_scores[i])
        combined.sort(key=lambda x: x["score"], reverse=True)
    except ImportError:
        pass  # reranker not installed, skip silently
```

- [ ] Implement reranking behind `CHIRON_RERANK` flag
- [ ] Add `CHIRON_RERANK=false` to `backend/.env.example`
- [ ] Commit: `feat: add optional cross-encoder reranking to Chiron hybrid search`

---

## Task 3.3 — Web search service

**Files:** `backend/app/services/web_search.py`, `backend/app/api/routes/v1/web_search.py`, `backend/app/core/config.py`

### Service:
```python
# backend/app/services/web_search.py
"""Multi-provider web search. Provider selected via WEB_SEARCH_PROVIDER env var."""
from __future__ import annotations
import httpx
import os
from typing import Any

WEB_SEARCH_PROVIDER = os.getenv("WEB_SEARCH_PROVIDER", "duckduckgo")

async def search(query: str, limit: int = 5) -> list[dict[str, Any]]:
    provider = WEB_SEARCH_PROVIDER.lower()
    if provider == "searxng":
        return await _searxng(query, limit)
    elif provider == "brave":
        return await _brave(query, limit)
    else:
        return await _duckduckgo(query, limit)

async def _duckduckgo(query: str, limit: int) -> list[dict]:
    """DuckDuckGo instant answer API — free, no key needed."""
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get("https://api.duckduckgo.com/", params={"q": query, "format": "json", "no_html": 1})
        data = r.json()
    results = []
    for item in data.get("RelatedTopics", [])[:limit]:
        if "Text" in item:
            results.append({"title": item.get("Text", "")[:100], "url": item.get("FirstURL", ""), "snippet": item.get("Text", "")})
    return results[:limit]

async def _brave(query: str, limit: int) -> list[dict]:
    api_key = os.getenv("WEB_SEARCH_BRAVE_API_KEY", "")
    if not api_key:
        return []
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get("https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": limit},
            headers={"Accept": "application/json", "X-Subscription-Token": api_key})
        data = r.json()
    return [{"title": i.get("title"), "url": i.get("url"), "snippet": i.get("description", "")}
            for i in data.get("web", {}).get("results", [])[:limit]]

async def _searxng(query: str, limit: int) -> list[dict]:
    base = os.getenv("WEB_SEARCH_SEARXNG_URL", "http://localhost:8080")
    async with httpx.AsyncClient(timeout=8) as client:
        r = await client.get(f"{base}/search", params={"q": query, "format": "json", "pageno": 1})
        data = r.json()
    return [{"title": i.get("title"), "url": i.get("url"), "snippet": i.get("content", "")}
            for i in data.get("results", [])[:limit]]
```

### Route:
```python
# backend/app/api/routes/v1/web_search.py
from fastapi import APIRouter, Query
from app.api.deps import CurrentUser
from app.services.web_search import search as web_search
from typing import Any

router = APIRouter()

@router.get("")
async def search_web(q: str = Query(..., min_length=1), limit: int = Query(5, ge=1, le=10), user: CurrentUser = None) -> Any:
    results = await web_search(q, limit)
    return {"results": results, "query": q, "provider": __import__('os').getenv("WEB_SEARCH_PROVIDER", "duckduckgo")}
```

### Add to config.py:
```python
WEB_SEARCH_PROVIDER: str = "duckduckgo"
WEB_SEARCH_BRAVE_API_KEY: str = ""
WEB_SEARCH_SEARXNG_URL: str = "http://localhost:8080"
```

- [ ] Create `web_search.py` service
- [ ] Create `web_search.py` route
- [ ] Register router in `__init__.py`
- [ ] Add env vars to `.env.example`
- [ ] Test: `curl /api/v1/web-search?q=hello`
- [ ] Commit: `feat: add web search service (DuckDuckGo/Brave/SearXNG) + GET /api/v1/web-search`

---

## Task 3.4 — `[kb: name]` injection in chat stream

**Files:** `backend/app/api/routes/v1/chat.py` or `backend/app/services/chat_session.py`

In the chat stream handler, before sending to Claude CLI:
1. Parse user message for `[kb: name]` tags
2. For each tag, call `chiron_service.hybrid_search(workspace_id, original_query, top_k=4)`
3. Prepend results as system context: `"[Knowledge: {name}]\n{chunk1}\n{chunk2}…"`
4. Remove `[kb: name]` tags from message sent to Claude
5. Include `sources` array in SSE `result` event

```python
# In chat_session.py or chat.py stream handler, add before claude_cli call:

import re

KB_TAG_RE = re.compile(r'\[kb:\s*([^\]]+)\]', re.IGNORECASE)

async def _inject_knowledge(message: str, workspace_id, chiron_svc) -> tuple[str, list[dict]]:
    """Extract [kb: name] tags, fetch chunks, return (enriched_message, sources)."""
    tags = KB_TAG_RE.findall(message)
    if not tags or not workspace_id:
        return message, []

    clean_message = KB_TAG_RE.sub('', message).strip()
    all_sources = []
    context_blocks = []

    for tag_name in tags:
        results = await chiron_svc.hybrid_search(workspace_id, clean_message, top_k=3)
        for r in results:
            context_blocks.append(f"[Source: {r.get('source_name', tag_name)}]\n{r['chunk']}")
            all_sources.append({"name": r.get('source_name', tag_name), "chunk": r['chunk'][:200], "score": r['score']})

    if context_blocks:
        context_str = "\n\n".join(context_blocks)
        enriched = f"Context from knowledge base:\n{context_str}\n\n---\n\nUser question: {clean_message}"
        return enriched, all_sources

    return clean_message, []
```

- [ ] Implement `_inject_knowledge` helper
- [ ] Wire into stream handler: call before Claude CLI, include `sources` in result SSE event
- [ ] Commit: `feat: wire [kb: name] tag → Chiron hybrid search → context injection in chat`

---

## Task 3.5 — Citations component frontend

**Files:** `frontend/src/components/chat/Citations.jsx`, `frontend/src/components/chat/ChatBubble.jsx`

### Citations.jsx:
```jsx
// frontend/src/components/chat/Citations.jsx
import { useState } from 'react'
import { BookOpen, X } from 'lucide-react'
import Modal from '../ui/Modal'

export default function Citations({ sources }) {
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  if (!sources?.length) return null

  return (
    <>
      <div className="flex flex-wrap gap-1 mt-2">
        {sources.map((s, i) => (
          <button key={i} type="button"
            onClick={() => { setActiveIdx(i); setOpen(true) }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-argo-border bg-argo-elevated text-argo-muted hover:text-argo-primary hover:border-argo-cyan transition-colors">
            <BookOpen size={9} />
            <span>{s.name}</span>
            <span className="text-[9px] opacity-60">[{i + 1}]</span>
          </button>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Source" size="md">
        <div className="p-5">
          <div className="flex gap-2 mb-4 flex-wrap">
            {sources.map((s, i) => (
              <button key={i} type="button" onClick={() => setActiveIdx(i)}
                className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                  i === activeIdx ? 'border-argo-cyan text-argo-cyan bg-cyan-500/10' : 'border-argo-border text-argo-muted hover:text-argo-secondary'
                }`}>
                [{i + 1}] {s.name}
              </button>
            ))}
          </div>
          {sources[activeIdx] && (
            <div className="bg-argo-elevated rounded-lg p-4 text-sm text-argo-secondary leading-relaxed font-mono">
              {sources[activeIdx].chunk}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
```

### Wire into ChatBubble:
- ChatBubble receives `sources` prop
- Below the Markdown content, render `<Citations sources={sources} />`
- ChatView passes `message.sources` to each ChatBubble

- [ ] Create Citations.jsx
- [ ] Update ChatBubble to render Citations below response
- [ ] Update ChatView to extract sources from stream events
- [ ] Commit: `feat: add Citations component — source chips + modal for KB references in chat`

---

## Task 3.6 — Web search toggle wired end-to-end

**Files:** `frontend/src/hooks/useChat.js`, `frontend/src/components/chat/ChatView.jsx`

- [ ] `ChatView` has `webSearchEnabled` state, passes toggle to `ChatInput`
- [ ] `useChat.send()` accepts `webSearch: boolean` param
- [ ] Chat stream POST body includes `"web_search": true` when enabled
- [ ] `chat.py` backend: if `web_search=True`, call `web_search_svc.search(message)` and prepend results
- [ ] In response, include `web_sources[]` alongside `sources[]`
- [ ] ChatBubble renders web sources with a Globe icon (different from KB citations)
- [ ] Commit: `feat: wire web search toggle — search results injected as context in chat stream`
