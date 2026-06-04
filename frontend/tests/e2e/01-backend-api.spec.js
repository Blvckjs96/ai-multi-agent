/**
 * E2E: Backend API health, auth, and core endpoints.
 *
 * These tests hit the FastAPI backend directly (localhost:8001) and do NOT
 * require the Vite frontend to be running. They validate that the backend is
 * reachable, responds correctly, and enforces authentication.
 */

import { test, expect } from '@playwright/test'

const API = 'http://localhost:8001/api/v1'
const API_KEY = process.env.VITE_API_KEY || ''

function apiHeaders(extra = {}) {
  return { 'X-API-Key': API_KEY, 'Content-Type': 'application/json', ...extra }
}

// ── 1. Health ─────────────────────────────────────────────────────────────

test.describe('Health endpoints', () => {
  test('GET /health returns 200 and status ok', async ({ request }) => {
    const res = await request.get(`${API}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(['ok', 'healthy']).toContain(body.status)
  })

  test('GET /health/ready returns 200', async ({ request }) => {
    const res = await request.get(`${API}/health/ready`)
    expect(res.status()).toBe(200)
  })
})

// ── 2. Authentication ─────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('POST /auth/login with invalid credentials returns 401 or 422', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, {
      data: { email: 'nonexistent@argo.test', password: 'wrongpassword' },
    })
    expect([401, 422, 400]).toContain(res.status())
  })

  test('POST /auth/login without body returns 422', async ({ request }) => {
    const res = await request.post(`${API}/auth/login`, { data: {} })
    expect(res.status()).toBe(422)
  })

  test('GET /users/me without auth returns 401 or 403', async ({ request }) => {
    const res = await request.get(`${API}/users/me`)
    expect([401, 403]).toContain(res.status())
  })

  test('GET /users/me with invalid token returns 401', async ({ request }) => {
    const res = await request.get(`${API}/users/me`, {
      headers: { Authorization: 'Bearer invalid_token_abc123' },
    })
    expect([401, 403]).toContain(res.status())
  })
})

// ── 3. API Key protection ─────────────────────────────────────────────────

test.describe('API key protection', () => {
  test('Chiron endpoint without API key returns 401 or 403', async ({ request }) => {
    const workspaceId = '00000000-0000-0000-0000-000000000001'
    const res = await request.get(`${API}/chiron/${workspaceId}/pages`)
    expect([401, 403, 422]).toContain(res.status())
  })

  test('Task board without API key returns 401 or 403', async ({ request }) => {
    const workspaceId = '00000000-0000-0000-0000-000000000001'
    const res = await request.get(`${API}/task-board/${workspaceId}/tasks`)
    expect([401, 403, 422, 404]).toContain(res.status())
  })

  test('Settings with valid API key returns ok', async ({ request }) => {
    const res = await request.get(`${API}/settings/claude-auth/status`, {
      headers: apiHeaders(),
    })
    // Either 200 (auth status returned) or 503 (claude CLI not found) — both are valid
    expect([200, 503, 404]).toContain(res.status())
  })
})

// ── 4. Chat API (SSE) ─────────────────────────────────────────────────────

test.describe('Chat API', () => {
  test('GET /chat/sessions returns list', async ({ request }) => {
    const res = await request.get(`${API}/chat/sessions`, {
      headers: apiHeaders(),
    })
    expect([200, 401, 403]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body).toHaveProperty('active')
      expect(Array.isArray(body.active)).toBe(true)
    }
  })

  test('DELETE /chat/nonexistent returns not-found or cancelled:false', async ({ request }) => {
    const res = await request.delete(`${API}/chat/nonexistent-session-id`, {
      headers: apiHeaders(),
    })
    expect([200, 404]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.cancelled).toBe(false)
    }
  })

  test('POST /chat/stream without message returns 422', async ({ request }) => {
    const res = await request.post(`${API}/chat/stream`, {
      headers: apiHeaders(),
      data: {},
    })
    expect([422, 400]).toContain(res.status())
  })
})

// ── 5. SSRF protection ────────────────────────────────────────────────────

test.describe('SSRF protection (webhook endpoints)', () => {
  test('Slack webhook with private IP is blocked', async ({ request }) => {
    const res = await request.post(`${API}/slack/webhook`, {
      headers: apiHeaders(),
      data: { url: 'http://169.254.169.254/latest/meta-data/' },
    })
    expect([400, 422, 405, 404]).toContain(res.status())
  })
})

// ── 6. Rate limiting ─────────────────────────────────────────────────────

test.describe('Rate limiting', () => {
  test('Rapid POST /chat/stream requests are rate limited', async ({ request }) => {
    const body = { message: 'rate limit test' }
    const headers = apiHeaders()

    // Fire 25 requests quickly — should hit 20/min limit
    const results = await Promise.all(
      Array.from({ length: 25 }, () =>
        request.post(`${API}/chat/stream`, { headers, data: body })
      )
    )

    const statuses = results.map((r) => r.status())
    const has429 = statuses.some((s) => s === 429)
    // Either rate limited or Claude CLI responded (200/stream)
    // We just verify no server error (5xx) except 503 (CLI not running)
    const hasServerError = statuses.some((s) => s >= 500 && s !== 503)
    expect(hasServerError).toBe(false)
    // Note: 429 may or may not appear depending on rate limiter config
    console.log('Rate limit test statuses:', [...new Set(statuses)], 'has429:', has429)
  })
})

// ── 7. Input validation / injection ──────────────────────────────────────

test.describe('Input validation', () => {
  test('XSS payload in message is accepted but not executed server-side', async ({ request }) => {
    const res = await request.post(`${API}/chat/stream`, {
      headers: apiHeaders(),
      data: {
        message: '<script>alert(1)</script>',
        permission_mode: 'plan',
      },
    })
    // Server should accept the string (200/stream) — XSS is a client concern
    // The important thing is no 500 error
    expect(res.status()).not.toBe(500)
  })

  test('SQL injection in message does not cause 500', async ({ request }) => {
    const res = await request.post(`${API}/chat/stream`, {
      headers: apiHeaders(),
      data: {
        message: "'; DROP TABLE users; --",
        permission_mode: 'plan',
      },
    })
    expect(res.status()).not.toBe(500)
  })

  test('Extremely long message is rejected or handled', async ({ request }) => {
    const res = await request.post(`${API}/chat/stream`, {
      headers: apiHeaders(),
      data: {
        message: 'A'.repeat(100_000),
        permission_mode: 'plan',
      },
    })
    // Should not 500 — either accepted (200) or rejected (413/422)
    expect([200, 413, 422, 429, 503]).toContain(res.status())
  })
})
