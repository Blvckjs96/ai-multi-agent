import { useEffect, useRef } from 'react'

const TYPE_COLOR = {
  system: '#888',
  assistant: '#00ff9d',
  tool_use: '#00d4ff',
  tool_result: '#a78bfa',
  result: '#fbbf24',
  error: '#f87171',
  done: '#888',
  heartbeat: '#333',
  thinking: '#6ee7b7',
}

export function TerminalView({ events }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Gradient top border strip */}
      <div style={{ height: 2, background: 'var(--accent-grad)', flexShrink: 0 }} />
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--bg-deep)',
        fontFamily: 'var(--f-mono)',
        fontSize: '12px',
        lineHeight: 1.65,
        padding: '14px 20px',
      }}
    >
      {events.length === 0 && (
        <span style={{ color: '#444' }}>{'// stream events will appear here'}</span>
      )}
      {events.map((evt, i) => (
        <TerminalLine key={i} event={evt} />
      ))}
      <div ref={bottomRef} />
    </div>
    </div>
  )
}

function TerminalLine({ event }) {
  const color = TYPE_COLOR[event.type] || '#ccc'
  const timestamp = new Date().toISOString().slice(11, 23)

  const summary = formatEvent(event)
  if (!summary) return null

  return (
    <div style={{ marginBottom: '2px' }}>
      <span style={{ color: '#444', userSelect: 'none' }}>{timestamp} </span>
      <span style={{ color, fontWeight: 600 }}>[{event.type}]</span>
      <span style={{ color: '#ccc' }}> {summary}</span>
    </div>
  )
}

function formatEvent(evt) {
  switch (evt.type) {
    case 'system':
      return `init session_id=${evt.session_id || '?'}`
    case 'assistant':
      if (!evt.text) return null
      return evt.text.length > 120 ? evt.text.slice(0, 120) + '…' : evt.text
    case 'tool_use':
      return `${evt.tool} ${evt.input?.file_path || evt.input?.command || JSON.stringify(evt.input || {}).slice(0, 60)}`
    case 'tool_result':
      const c = typeof evt.content === 'string' ? evt.content : JSON.stringify(evt.content)
      return c.slice(0, 120).replace(/\n/g, '↵')
    case 'result':
      return `session=${evt.session_id} in=${evt.input_tokens} out=${evt.output_tokens} cost=$${(evt.cost_usd || 0).toFixed(4)}`
    case 'error':
      return evt.message
    case 'done':
      return '--- stream closed ---'
    default:
      return JSON.stringify(evt).slice(0, 100)
  }
}
