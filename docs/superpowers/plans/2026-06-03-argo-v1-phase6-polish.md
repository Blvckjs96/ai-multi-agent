# Argo v1.0 Phase 6 — Polish + Scale Prep + Ship

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` or `superpowers:executing-plans`.

**Goal:** Tất cả panels wired. Tất cả dead buttons fixed. Image generation (feature flag). Channels panel UI. WebSocket reliability. E2E test suite. Tauri production build. Version bump to 1.0.0.

**Architecture:** Feature flags via `.env` for optional features (image gen, LDAP). Redis WebSocket for multi-tab. Final audit of all components to verify no orphaned buttons or missing handlers.

**Prerequisite:** Phase 5 complete.

---

## File Map

```
frontend/src/
├── App.jsx                              ~ Version bump status bar to v1.0.0
├── components/channel/                  (ALL NEW)
│   + ChannelsPanel.jsx                  Channel list + message feed + @model trigger
│   + ChannelView.jsx                    Message thread + input
├── components/providers/
│   ~ ProvidersPanel.jsx                 Kept for ArgoRouter status (accessible from Settings)
├── src-tauri/
│   ~ Cargo.toml                         version = "1.0.0"
│   ~ tauri.conf.json                    version "1.0.0"
│
backend/app/
├── api/routes/v1/
│   + images.py                          POST /api/v1/images/generate (FEATURE_IMAGE_GEN flag)
├── services/
│   + image_gen.py                       DALL-E 3 / ComfyUI image generation
├── core/
│   ~ config.py                          FEATURE_IMAGE_GEN, FEATURE_LDAP, FEATURE_SCIM flags
│
tests/e2e/                               (ALL NEW via Playwright)
│   + test_auth.spec.ts                  Login flow
│   + test_chat.spec.ts                  Send message, receive response
│   + test_tasks.spec.ts                 Create task, open workspace, terminal
│   + test_knowledge.spec.ts             Upload file, search
│   + test_settings.spec.ts              Change theme, save settings
```

---

## Task 6.1 — Channels panel wired

**Files:** `frontend/src/components/channel/ChannelsPanel.jsx`, `frontend/src/components/channel/ChannelView.jsx`

Backend `channels.py` route already exists. Wire it to a proper UI.

```jsx
// frontend/src/components/channel/ChannelsPanel.jsx
// Left: channel list (fetch /api/v1/channels)
// [+ New Channel] button → Modal with name input
// Right: ChannelView — message feed + input

// ChannelView:
// Messages: GET /api/v1/channels/{id}/messages
// Send: POST /api/v1/channels/{id}/messages
// @model trigger: when user types @, show model picker (reuse existing ModelSelector)
// When @model is selected, trigger AI response via chat stream
```

Key interaction: `@claude-sonnet` in channel message → backend triggers AI response in channel thread.

- [ ] `ChannelsPanel.jsx`
- [ ] `ChannelView.jsx`
- [ ] Backend: verify `channels.py` has message CRUD + @model trigger handler
- [ ] Wire `mode === 'channels'` or add Channels to nav (under Workspace section)
- [ ] Commit: `feat: wire Channels panel — message feed, @model AI trigger`

---

## Task 6.2 — Image generation (feature flag)

**Files:** `backend/app/services/image_gen.py`, `backend/app/api/routes/v1/images.py`

### Service:
```python
# backend/app/services/image_gen.py
import os, httpx

FEATURE_IMAGE_GEN = os.getenv("FEATURE_IMAGE_GEN", "false").lower() == "true"

async def generate_image(prompt: str, size: str = "1024x1024") -> dict:
    """Generate image via DALL-E 3. Returns {url, revised_prompt}."""
    if not FEATURE_IMAGE_GEN:
        raise ValueError("Image generation not enabled (set FEATURE_IMAGE_GEN=true)")
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError("OPENAI_API_KEY required for image generation")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post("https://api.openai.com/v1/images/generations",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"model": "dall-e-3", "prompt": prompt, "n": 1, "size": size})
        data = r.json()
    return {"url": data["data"][0]["url"], "revised_prompt": data["data"][0].get("revised_prompt", prompt)}
```

### Route:
```python
# backend/app/api/routes/v1/images.py
@router.post("/generate")
async def generate_image(body: ImageGenerateRequest, user: CurrentUser) -> Any:
    result = await image_gen_svc.generate_image(body.prompt, body.size or "1024x1024")
    return result
```

### Frontend: image generation button in ChatInput (shown only if feature enabled)
- Add image icon button to ChatInput toolbar
- On click: Modal with prompt input → calls `/api/v1/images/generate` → inserts image into chat

- [ ] Backend service + route
- [ ] Frontend: image gen button (hidden unless backend feature flag returns enabled)
- [ ] Add `FEATURE_IMAGE_GEN=false` to `.env.example`
- [ ] Commit: `feat: add image generation (DALL-E 3) behind FEATURE_IMAGE_GEN flag`

---

## Task 6.3 — LDAP auth (feature flag)

**Files:** `backend/app/api/routes/v1/auth.py`, `backend/app/services/ldap_auth.py`

```python
# backend/app/services/ldap_auth.py
import os
FEATURE_LDAP = os.getenv("FEATURE_LDAP", "false").lower() == "true"

async def authenticate_ldap(username: str, password: str) -> dict | None:
    """Authenticate via LDAP. Returns user_info dict or None."""
    if not FEATURE_LDAP:
        return None
    try:
        from ldap3 import Server, Connection, ALL
        server = Server(os.getenv("LDAP_HOST", "ldap://localhost:389"), get_info=ALL)
        dn = os.getenv("LDAP_USER_DN_TEMPLATE", "uid={username},dc=example,dc=com").format(username=username)
        conn = Connection(server, user=dn, password=password, auto_bind=True)
        return {"username": username, "email": f"{username}@{os.getenv('LDAP_EMAIL_DOMAIN', 'example.com')}"}
    except Exception:
        return None
```

### Add to auth.py:
```python
@router.post("/ldap")
async def ldap_login(body: LdapLoginBody, db: DBSession) -> Any:
    """LDAP login — only available when FEATURE_LDAP=true."""
    user_info = await ldap_auth_svc.authenticate_ldap(body.username, body.password)
    if not user_info:
        raise AuthenticationError(message="LDAP authentication failed")
    # Find or create user by email, issue JWT
    ...
```

### Frontend: Settings > Connections tab shows LDAP config section when feature flag enabled

- [ ] `ldap_auth.py` service
- [ ] LDAP route in auth.py
- [ ] Add env vars: `FEATURE_LDAP=false`, `LDAP_HOST`, `LDAP_USER_DN_TEMPLATE`
- [ ] `uv add ldap3`
- [ ] Commit: `feat: add LDAP auth behind FEATURE_LDAP flag`

---

## Task 6.4 — Dead button audit + fixes

Run a final audit of all interactive elements to ensure nothing is orphaned.

```bash
# Find buttons/links with no handler
grep -rn "onClick={}" frontend/src/components/ --include="*.jsx"
grep -rn "href=\"#\"" frontend/src/components/ --include="*.jsx"
grep -rn "// TODO\|// FIXME\|coming soon" frontend/src/components/ --include="*.jsx"
```

For each finding:
- Wire the handler if the feature exists in backend
- Add placeholder modal "Coming in Phase X" if feature is future
- Remove button entirely if feature is not planned

- [ ] Run audit grep commands
- [ ] Fix all dead buttons
- [ ] Commit: `fix: wire all dead buttons — full UI audit`

---

## Task 6.5 — E2E test suite (Playwright)

**Files:** `frontend/tests/e2e/` directory (create)

```bash
cd frontend
pnpm add -D @playwright/test
npx playwright install chromium
```

```ts
// frontend/tests/e2e/test_auth.spec.ts
import { test, expect } from '@playwright/test'

test('login flow', async ({ page }) => {
  await page.goto('http://localhost:5001')
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await page.fill('input[type="email"]', process.env.TEST_EMAIL ?? 'test@argo.local')
  await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? 'password')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Argo')).toBeVisible({ timeout: 5000 })
})
```

```ts
// frontend/tests/e2e/test_chat.spec.ts
import { test, expect } from '@playwright/test'

test('send a chat message', async ({ page }) => {
  // Login first
  await page.goto('http://localhost:5001')
  // ... auth
  // Click Chat nav
  await page.click('button[title="Chat"]')
  // Click New Chat
  await page.click('button:has-text("New Chat")')
  // Type message
  await page.fill('textarea', 'Hello Argo')
  await page.keyboard.press('Enter')
  // Wait for response (bubble appears)
  await expect(page.locator('[class*="bubble"]').last()).toBeVisible({ timeout: 15000 })
})
```

```ts
// frontend/tests/e2e/test_tasks.spec.ts
test('create a task', async ({ page }) => {
  // Navigate to Issues
  await page.click('[title="Issues"]')
  // Click Add issue in Backlog
  await page.click('button:has-text("Add issue")')
  await page.fill('input[placeholder="Issue title…"]', 'Test task from E2E')
  await page.click('button:has-text("Add")')
  // Verify task appears
  await expect(page.locator('text=Test task from E2E')).toBeVisible()
})
```

```ts
// frontend/tests/e2e/test_settings.spec.ts
test('open settings and navigate tabs', async ({ page }) => {
  // ...auth
  await page.click('[aria-label="Settings"]')
  await expect(page.locator('text=Profile')).toBeVisible()
  await page.click('button:has-text("Interface")')
  await expect(page.locator('text=Theme')).toBeVisible()
})
```

- [ ] Install Playwright
- [ ] Create `playwright.config.ts`
- [ ] Create 4 spec files (auth, chat, tasks, settings)
- [ ] Run: `npx playwright test --reporter=line`
- [ ] All critical paths pass
- [ ] Commit: `test: add Playwright E2E suite — auth, chat, tasks, settings`

---

## Task 6.6 — Tauri build + version 1.0.0

**Files:** `frontend/src-tauri/Cargo.toml`, `frontend/src-tauri/tauri.conf.json`, `frontend/src/App.jsx`

- [ ] Update `Cargo.toml`: `version = "1.0.0"`
- [ ] Update `tauri.conf.json`: `"version": "1.0.0"`
- [ ] Update StatusBar in `App.jsx`: `Argo v1.0.0`
- [ ] Run Tauri build: `cd frontend && npm run tauri build`
- [ ] Verify `.dmg` produced in `frontend/src-tauri/target/release/bundle/dmg/`
- [ ] Commit: `chore: bump version to 1.0.0, Tauri production build verified`

---

## Task 6.7 — Final branch + tag

- [ ] Run full backend test suite: `PYTHONPATH="." .venv/bin/python -m pytest tests/ -v --tb=short`
- [ ] Run frontend build: `pnpm run build` — no errors
- [ ] Run E2E tests: `npx playwright test`
- [ ] Merge `feat/argo-v1-phase0` into `main` (or create PR via `gh pr create`)
- [ ] Tag: `git tag v1.0.0 && git push origin v1.0.0`
- [ ] Update MEMORY.md with v1.0.0 release note

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Post-v1.0 Backlog (không thuộc scope)

Features được note lại cho v1.1+:
- SCIM 2.0 automated user provisioning (Okta, Azure AD)
- Multi-workspace tab system (nhiều repos mở cùng lúc)
- Channels multi-user real-time
- Calendar integrations (automations + scheduling)
- Model arena / A-B testing evaluations
- Mobile PWA (Phase 0 `darkMode: 'class'` đã ready)
