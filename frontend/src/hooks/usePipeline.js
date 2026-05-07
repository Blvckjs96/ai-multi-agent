/**
 * usePipeline — manages SSE streaming from the pipeline endpoint.
 *
 * Returns:
 *   agents      — map of agent name → { status, result }
 *   spec        — final markdown string (or null)
 *   isRunning   — boolean
 *   error       — string or null
 *   runPipeline(description) — kick off a run
 *   reset()     — clear state for a new run
 */

import { useCallback, useRef, useState } from 'react'

const AGENT_NAMES = ['planner', 'engineer', 'cost_estimator', 'writer']

const initialAgentState = () =>
  Object.fromEntries(AGENT_NAMES.map((name) => [name, { status: 'waiting', result: null }]))

export function usePipeline() {
  const [agents, setAgents] = useState(initialAgentState)
  const [spec, setSpec] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setAgents(initialAgentState())
    setSpec(null)
    setIsRunning(false)
    setError(null)
  }, [])

  const updateAgent = useCallback((name, patch) => {
    setAgents((prev) => ({
      ...prev,
      [name]: { ...prev[name], ...patch },
    }))
  }, [])

  const runPipeline = useCallback(
    async (description) => {
      reset()
      setIsRunning(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch('/api/v1/pipeline/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const text = await response.text()
          throw new Error(`Server error ${response.status}: ${text}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // SSE lines: "data: {...}\n\n"
          const lines = buffer.split('\n')
          buffer = lines.pop() // keep incomplete last line

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ')) continue

            let event
            try {
              event = JSON.parse(trimmed.slice(6))
            } catch {
              continue
            }

            if (event.type === 'agent_start') {
              updateAgent(event.agent, { status: 'thinking' })
            } else if (event.type === 'agent_done') {
              updateAgent(event.agent, { status: 'done', result: event.result })
            } else if (event.type === 'complete') {
              setSpec(event.spec)
              setIsRunning(false)
            } else if (event.type === 'error') {
              setError(event.message)
              setIsRunning(false)
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message)
        setIsRunning(false)
      }
    },
    [reset, updateAgent],
  )

  return { agents, spec, isRunning, error, runPipeline, reset }
}
