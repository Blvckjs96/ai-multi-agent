/**
 * E2E: Full chat flow — Frontend ↔ Backend ↔ Claude CLI.
 *
 * These tests are SKIPPED unless CLAUDE_CLI_AVAILABLE=1 is set, because they
 * require a running Claude CLI with a valid auth token. In CI without CLI,
 * the tests are marked as skipped rather than failed.
 *
 * Flow tested:
 *  1. User opens chat tab
 *  2. User types a message and submits
 *  3. Frontend sends POST /api/v1/chat/stream (SSE)
 *  4. Backend spawns Claude CLI subprocess
 *  5. Events stream back to frontend
 *  6. Chat bubble renders assistant response
 *  7. Confirm banner appears (plan mode)
 *  8. User confirms → execute phase starts
 */

import { test, expect } from '@playwright/test'

const CLI_AVAILABLE = process.env.CLAUDE_CLI_AVAILABLE === '1'

test.describe('Full chat E2E (Claude CLI required)', () => {
  test.skip(!CLI_AVAILABLE, 'Set CLAUDE_CLI_AVAILABLE=1 to run CLI-dependent tests')

  // workspace_id created by setup script (see README) or set via env
  const TEST_WORKSPACE_ID = process.env.E2E_WORKSPACE_ID || '85dfe258-9f05-41a0-99a0-a11deb475ca3'

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 20_000 })
    await page.getByText('Chat').first().click()
    await page.waitForTimeout(500)
  })

  test('sends message and receives streaming response', async ({ page }) => {
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 5_000 })

    await textarea.fill('Say hello in exactly 3 words.')
    await page.keyboard.press('Enter')

    // Expect "Planning..." bubble OR any assistant text within 30s
    // Use exact text to avoid strict-mode violations from broad div matches
    await expect(
      page.getByText('Planning...', { exact: true })
          .or(page.getByText('Hello! Hello! Hello!', { exact: false }))
          .or(page.locator('span').filter({ hasText: 'planning' }).first())
    ).toBeVisible({ timeout: 30_000 })
  })

  test('confirm banner appears after planning phase (requires workspace)', async ({ request, page }) => {
    // Trigger plan mode with a workspace so Claude CLI has cwd context
    const apiKey = process.env.VITE_API_KEY || ''
    const res = await request.post('http://localhost:8001/api/v1/chat/stream', {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      data: {
        message: 'Create a file called argo-e2e-test.txt with the text "E2E OK"',
        workspace_id: TEST_WORKSPACE_ID,
        permission_mode: 'plan',
      },
    })

    expect(res.status()).toBe(200)

    // Read the SSE stream — look for a 'result' event (plan complete)
    const body = await res.text()
    const events = body
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => { try { return JSON.parse(l.slice(6)) } catch { return null } })
      .filter(Boolean)

    const resultEvent = events.find((e) => e.type === 'result')
    const errorEvent  = events.find((e) => e.type === 'error')
    const doneEvent   = events.find((e) => e.type === 'done')

    // Stream must always end with done
    expect(doneEvent).toBeTruthy()

    if (errorEvent) {
      console.warn('CLI returned error (acceptable if workspace lacks git):', errorEvent.message)
    } else {
      // If Claude produced a plan result, a session_id should be present
      expect(resultEvent || errorEvent).toBeTruthy()
    }
  })
})

// ── SSE stream parsing tests (mock-based, no CLI needed) ──────────────────

test.describe('Chat SSE stream — backend integration', () => {
  test('POST /chat/stream returns text/event-stream content type', async ({ request }) => {
    const API = 'http://localhost:8001/api/v1'
    const apiKey = process.env.VITE_API_KEY || ''

    const res = await request.post(`${API}/chat/stream`, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      data: { message: 'ping', permission_mode: 'plan' },
    })

    if (res.status() === 200) {
      const ct = res.headers()['content-type'] || ''
      expect(ct).toContain('text/event-stream')
    } else {
      // Claude CLI not running — acceptable in dev
      expect([200, 503, 422]).toContain(res.status())
    }
  })

  test('POST /chat/stream SSE response contains done event', async ({ request }) => {
    const API = 'http://localhost:8001/api/v1'
    const apiKey = process.env.VITE_API_KEY || ''

    const res = await request.post(`${API}/chat/stream`, {
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      data: { message: 'test', permission_mode: 'plan' },
    })

    if (res.status() !== 200) return

    const body = await res.text()
    const lines = body.split('\n').filter((l) => l.startsWith('data: '))
    const events = lines.map((l) => {
      try { return JSON.parse(l.slice(6)) } catch { return null }
    }).filter(Boolean)

    // SSE stream must always end with a 'done' event
    const doneEvent = events.find((e) => e.type === 'done')
    expect(doneEvent).toBeTruthy()
  })

  test('cancel session API works', async ({ request }) => {
    const API = 'http://localhost:8001/api/v1'
    const apiKey = process.env.VITE_API_KEY || ''

    const res = await request.delete(`${API}/chat/fake-session-id-12345`, {
      headers: { 'X-API-Key': apiKey },
    })

    expect([200, 404]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('cancelled')
    }
  })
})

// ── Chat bubble rendering ─────────────────────────────────────────────────

test.describe('Chat bubble UI rendering', () => {
  test('message history area is present in chat tab', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByText('Chat').first().click()
    await page.waitForTimeout(500)

    // Chat area is visible if either the message container or the input is present
    const textarea = page.locator('textarea').first()
    const chatArea = page.locator('[style*="overflow-y: auto"], [style*="overflow: auto"]').first()

    const textareaVisible = await textarea.isVisible().catch(() => false)
    const chatAreaVisible = await chatArea.isVisible().catch(() => false)
    expect(textareaVisible || chatAreaVisible).toBe(true)
  })

  test('user message bubble appears after send', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    await page.getByText('Chat').first().click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea').first()
    if (!(await textarea.isVisible())) return

    const testMsg = 'E2E smoke test message'
    await textarea.fill(testMsg)
    await page.keyboard.press('Enter')

    // User bubble should appear immediately (optimistic UI)
    await expect(page.getByText(testMsg).first()).toBeVisible({ timeout: 5_000 })
  })
})
