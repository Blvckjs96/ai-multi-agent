/**
 * useChat — manages Claude CLI chat sessions via SSE.
 *
 * Status lifecycle:
 *   idle
 *     → planning      (permission_mode=plan, Claude writes its plan)
 *     → awaiting_confirm  (plan result event received, waiting for user)
 *     → executing     (permission_mode=auto, Claude executes the plan)
 *     → done
 *     → error
 *
 * Any state → idle  (via reset)
 * Any state → idle  (via cancel)
 */

import { useCallback, useRef, useState } from 'react'

const API_BASE = '/api/v1/chat'

export const STATUS = {
  IDLE: 'idle',
  PLANNING: 'planning',
  AWAITING_CONFIRM: 'awaiting_confirm',
  EXECUTING: 'executing',
  DONE: 'done',
  ERROR: 'error',
}

function parseSseLine(line) {
  if (!line.startsWith('data: ')) return null
  try {
    return JSON.parse(line.slice(6))
  } catch {
    return null
  }
}

export function useChat() {
  const [messages, setMessages] = useState([])   // { id, role, text, type, tool, input, content, phase? }
  const [rawEvents, setRawEvents] = useState([]) // all CLIEvents for terminal view
  const [sessionId, setSessionId] = useState(null)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [error, setError] = useState(null)
  const [activeTools, setActiveTools] = useState([])
  const [stats, setStats] = useState(null)  // { inputTokens, outputTokens, costUsd } from result event

  const abortRef = useRef(null)
  const assistantBufRef = useRef('')   // accumulate streaming text chunks
  const streamingMsgRef = useRef(null) // id of the currently-streaming assistant message

  // ── helpers ──────────────────────────────────────────────────────────────

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
        // Start new bubble
        appendMsg({ role: 'assistant', type: 'text', text: assistantBufRef.current })
        streamingMsgRef.current = 'active'
      } else {
        patchLastAssistant(assistantBufRef.current)
      }
    }
    assistantBufRef.current = ''
    streamingMsgRef.current = null
  }, [appendMsg, patchLastAssistant])

  // ── Core SSE consumer ─────────────────────────────────────────────────────
  // phase: 'plan' | 'execute'
  // On 'plan' phase: result → AWAITING_CONFIRM
  // On 'execute' phase: result → DONE

  const consumeStream = useCallback(
    async (endpoint, body, phase = 'plan') => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      // Reset per-stream state
      assistantBufRef.current = ''
      streamingMsgRef.current = null
      setError(null)
      setActiveTools([])
      setStatus(phase === 'plan' ? STATUS.PLANNING : STATUS.EXECUTING)

      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)

        const reader = res.body.getReader()
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

            // ── Text tokens ──
            if (evt.type === 'assistant' && evt.text) {
              assistantBufRef.current += evt.text
              if (streamingMsgRef.current === null) {
                appendMsg({ role: 'assistant', type: 'text', text: assistantBufRef.current, phase })
                streamingMsgRef.current = 'active'
              } else {
                patchLastAssistant(assistantBufRef.current)
              }
            }

            // ── Tool use ──
            if (evt.type === 'tool_use') {
              flushBuffer()
              setActiveTools((t) => [...new Set([...t, evt.tool])])
              appendMsg({ role: 'tool', type: 'tool_use', tool: evt.tool, input: evt.input, phase })
            }

            // ── Tool result ──
            if (evt.type === 'tool_result') {
              appendMsg({ role: 'tool', type: 'tool_result', content: evt.content, phase })
              setActiveTools([])
            }

            // ── Session complete ──
            if (evt.type === 'result') {
              flushBuffer()
              setStats({
                inputTokens: evt.input_tokens ?? 0,
                outputTokens: evt.output_tokens ?? 0,
                costUsd: evt.cost_usd ?? 0,
              })
              if (phase === 'plan') {
                setStatus(STATUS.AWAITING_CONFIRM)
              } else {
                setStatus(STATUS.DONE)
              }
            }

            if (evt.type === 'error') {
              setError(evt.message || 'An error occurred')
              setStatus(STATUS.ERROR)
            }

            // Server signals end-of-stream — flush any remaining buffer and
            // unblock the UI if no terminal state was set (e.g. Claude CLI
            // exited before sending a result event).
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
    [appendMsg, flushBuffer, patchLastAssistant],
  )

  // ── Public API ────────────────────────────────────────────────────────────

  /** Send a new user message (always starts in plan mode). */
  const send = useCallback(
    async (message, workspaceId) => {
      appendMsg({ role: 'user', type: 'text', text: message })
      const body = { message, session_id: sessionId, permission_mode: 'plan' }
      if (workspaceId) body.workspace_id = workspaceId
      await consumeStream(`${API_BASE}/stream`, body, 'plan')
    },
    [appendMsg, consumeStream, sessionId],
  )

  /** Confirm the plan — resume the session in auto (execute) mode. */
  const confirm = useCallback(async () => {
    if (!sessionId) return
    // Insert a visual phase separator into the message list
    appendMsg({ role: 'system', type: 'phase_separator', text: 'Executing…' })
    await consumeStream(
      `${API_BASE}/confirm`,
      { session_id: sessionId },
      'execute',
    )
  }, [appendMsg, consumeStream, sessionId])

  /** Cancel an in-flight stream and/or the remote session. */
  const cancel = useCallback(async () => {
    abortRef.current?.abort()
    if (sessionId) {
      fetch(`${API_BASE}/${sessionId}`, { method: 'DELETE' }).catch(() => {})
    }
    setActiveTools([])
    setStatus(STATUS.IDLE)
  }, [sessionId])

  /** Full conversation reset. */
  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setRawEvents([])
    setSessionId(null)
    setStatus(STATUS.IDLE)
    setError(null)
    setActiveTools([])
    setStats(null)
    assistantBufRef.current = ''
    streamingMsgRef.current = null
  }, [])

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
  }
}
