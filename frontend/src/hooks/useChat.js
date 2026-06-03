/**
 * useChat — manages Claude CLI chat sessions via SSE.
 *
 * Status lifecycle:
 *   idle → planning → awaiting_confirm → executing → done | error
 *   Any state → idle (via reset or cancel)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_ORIGIN } from '../lib/api'
import { checkPromptInjection } from '../lib/promptInjectionGuard'

const API_BASE = `${API_ORIGIN}/api/v1/chat`
const CONV_API  = `${API_ORIGIN}/api/v1/conversations`

export const STATUS = {
  IDLE:             'idle',
  PLANNING:         'planning',
  AWAITING_CONFIRM: 'awaiting_confirm',
  EXECUTING:        'executing',
  DONE:             'done',
  ERROR:            'error',
}

function parseSseLine(line) {
  if (!line.startsWith('data: ')) return null
  try { return JSON.parse(line.slice(6)) } catch { return null }
}

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useChat(conversationId = null) {
  const [messages,    setMessages]    = useState([])
  const [rawEvents,   setRawEvents]   = useState([])
  const [sessionId,   setSessionId]   = useState(null)
  const [status,      setStatus]      = useState(STATUS.IDLE)
  const [error,       setError]       = useState(null)
  const [activeTools, setActiveTools] = useState([])
  const [stats,       setStats]       = useState(null)

  const abortRef         = useRef(null)
  const assistantBufRef  = useRef('')
  const streamingMsgRef  = useRef(null)
  const toolCallMapRef   = useRef({})

  // ── Session ID localStorage persist (Step 3) ─────────────────────────────

  useEffect(() => {
    if (!conversationId) return
    const stored = localStorage.getItem(`session_${conversationId}`)
    if (stored) setSessionId(stored)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !sessionId) return
    localStorage.setItem(`session_${conversationId}`, sessionId)
  }, [conversationId, sessionId])

  // ── Message helpers ───────────────────────────────────────────────────────

  const appendMsg = useCallback((msg) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), ...msg }])
  }, [])

  const patchLastAssistant = useCallback((text) => {
    setMessages((prev) => {
      const idx = [...prev].reverse().findIndex((m) => m.role === 'assistant' && m.type === 'text')
      if (idx === -1) return prev
      const realIdx = prev.length - 1 - idx
      return prev.map((m, i) => (i === realIdx ? { ...m, text } : m))
    })
  }, [])

  const flushBuffer = useCallback(() => {
    if (assistantBufRef.current) {
      if (streamingMsgRef.current === null) {
        appendMsg({ role: 'assistant', type: 'text', text: assistantBufRef.current })
        streamingMsgRef.current = 'active'
      } else {
        patchLastAssistant(assistantBufRef.current)
      }
    }
    assistantBufRef.current = ''
    streamingMsgRef.current = null
  }, [appendMsg, patchLastAssistant])

  // ── Persist a message to the backend (fire-and-forget) ───────────────────

  const saveMessage = useCallback((role, content, type = 'text') => {
    if (!conversationId) return
    fetch(`${CONV_API}/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ role, content, type }),
    }).catch(() => {})
  }, [conversationId])

  // ── Load history from outside ─────────────────────────────────────────────

  const loadHistory = useCallback((msgs) => {
    setMessages(msgs)
  }, [])

  // ── Core SSE consumer ─────────────────────────────────────────────────────

  const consumeStream = useCallback(
    async (endpoint, body, phase = 'plan') => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      assistantBufRef.current = ''
      streamingMsgRef.current = null
      toolCallMapRef.current  = {}
      setError(null)
      setActiveTools([])
      setStatus(phase === 'plan' ? STATUS.PLANNING : STATUS.EXECUTING)

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

        const reader  = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop()

          for (const line of lines) {
            const evt = parseSseLine(line.trim())
            if (!evt) continue

            setRawEvents((prev) => [...prev, evt])
            if (evt.session_id) setSessionId(evt.session_id)

            // ── Thinking block (Phase 2) ──
            if (evt.type === 'assistant' && evt.text) {
              if (evt.subtype === 'thinking') {
                flushBuffer()
                appendMsg({ role: 'assistant', type: 'thinking', text: evt.text, phase })
              } else {
                assistantBufRef.current += evt.text
                if (streamingMsgRef.current === null) {
                  appendMsg({ role: 'assistant', type: 'text', text: assistantBufRef.current, phase })
                  streamingMsgRef.current = 'active'
                } else {
                  patchLastAssistant(assistantBufRef.current)
                }
              }
            }

            // ── Tool use — linked timeline (Phase 2) ──
            if (evt.type === 'tool_use') {
              flushBuffer()
              const toolIndex = evt.tool_index ?? Object.keys(toolCallMapRef.current).length
              const id = crypto.randomUUID()
              toolCallMapRef.current[toolIndex] = id
              setActiveTools((t) => [...new Set([...t, evt.tool])])
              appendMsg({ id, role: 'tool', type: 'tool_use', tool: evt.tool, input: evt.input, phase, status: 'running' })
            }

            // ── Tool result — patch linked tool_use ──
            if (evt.type === 'tool_result') {
              const toolIndex = evt.tool_index ?? (Object.keys(toolCallMapRef.current).length - 1)
              const linkedId  = toolCallMapRef.current[toolIndex]
              if (linkedId) {
                setMessages((prev) =>
                  prev.map((m) => m.id === linkedId ? { ...m, status: 'done', result: evt.content } : m)
                )
              } else {
                appendMsg({ role: 'tool', type: 'tool_result', content: evt.content, phase })
              }
              setActiveTools([])
            }

            // ── Session complete ──
            if (evt.type === 'result') {
              flushBuffer()
              const finishedText = assistantBufRef.current
              setStats({
                inputTokens:  evt.input_tokens  ?? 0,
                outputTokens: evt.output_tokens ?? 0,
                costUsd:      evt.cost_usd      ?? 0,
              })
              // Persist assistant reply
              if (finishedText) saveMessage('assistant', finishedText)

              if (phase === 'plan') setStatus(STATUS.AWAITING_CONFIRM)
              else                  setStatus(STATUS.DONE)
            }

            if (evt.type === 'error') {
              setError(evt.message || 'An error occurred')
              setStatus(STATUS.ERROR)
            }

            if (evt.type === 'done') {
              flushBuffer()
              setStatus((prev) =>
                prev === STATUS.PLANNING || prev === STATUS.EXECUTING ? STATUS.IDLE : prev
              )
            }
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message)
          setStatus(STATUS.ERROR)
        }
      }
    },
    [appendMsg, flushBuffer, patchLastAssistant, saveMessage],
  )

  // ── Public API ────────────────────────────────────────────────────────────

  const send = useCallback(
    async (message, workspaceId, coworkerId = null, userModel = null) => {
      if (checkPromptInjection(message)) {
        setError('Message blocked: potential prompt injection detected.')
        setStatus(STATUS.ERROR)
        return
      }
      appendMsg({ role: 'user', type: 'text', text: message })
      saveMessage('user', message)
      const body = { message, session_id: sessionId, permission_mode: 'plan' }
      if (workspaceId) body.workspace_id = workspaceId
      if (coworkerId)  body.coworker_id  = coworkerId
      if (userModel)   body.user_model   = userModel   // ArgoHarness local model override
      await consumeStream(`${API_BASE}/stream`, body, 'plan')
    },
    [appendMsg, consumeStream, saveMessage, sessionId],
  )

  const confirm = useCallback(async () => {
    if (!sessionId) return
    appendMsg({ role: 'system', type: 'phase_separator', text: 'Executing…' })
    await consumeStream(`${API_BASE}/confirm`, { session_id: sessionId }, 'execute')
  }, [appendMsg, consumeStream, sessionId])

  const cancel = useCallback(async () => {
    abortRef.current?.abort()
    if (sessionId) fetch(`${API_BASE}/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    setActiveTools([])
    setStatus(STATUS.IDLE)
  }, [sessionId])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    if (conversationId) localStorage.removeItem(`session_${conversationId}`)
    setMessages([])
    setRawEvents([])
    setSessionId(null)
    setStatus(STATUS.IDLE)
    setError(null)
    setActiveTools([])
    setStats(null)
    assistantBufRef.current = ''
    streamingMsgRef.current = null
    toolCallMapRef.current  = {}
  }, [conversationId])

  return {
    messages,
    rawEvents,
    sessionId,
    status,
    error,
    activeTools,
    stats,
    send,
    confirm,
    cancel,
    reset,
    loadHistory,
  }
}
