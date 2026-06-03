import ReactMarkdown from 'react-markdown'
import { Settings2 } from 'lucide-react'

const styles = {
  row: (role) => ({
    display: 'flex',
    justifyContent: role === 'user' ? 'flex-end' : 'flex-start',
    marginBottom: '4px',
  }),
  bubble: (role) => ({
    maxWidth: '72%',
    padding: '9px 14px',
    borderRadius: role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
    background: role === 'user' ? 'var(--bg-elevated)' : 'rgba(255,255,255,0.04)',
    border: role === 'user' ? '1px solid var(--border-active)' : '1px solid rgba(255,255,255,0.06)',
    color: 'var(--text-primary)',
    fontSize: '13px',
    lineHeight: 1.6,
    wordBreak: 'break-word',
  }),
  toolBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '5px',
    padding: '3px 9px',
    borderRadius: '9999px',
    background: 'rgba(0,212,255,0.08)',
    border: '1px solid rgba(0,212,255,0.2)',
    fontSize: '12px',
    color: '#00d4ff',
    fontFamily: 'monospace',
    marginBottom: '4px',
  },
  toolResult: {
    maxWidth: '78%',
    padding: '8px 13px',
    borderRadius: '8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: 'var(--text-dim)',
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
    maxHeight: '200px',
    overflow: 'auto',
  },
  prose: {
    margin: 0,
  },
}

function ToolUseBubble({ tool, input }) {
  const inputStr = input ? JSON.stringify(input, null, 2) : ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '4px' }}>
      <div style={styles.toolBadge}>
        <Settings2 size={12} style={{ flexShrink: 0 }} />
        <span>{tool}</span>
        {input?.file_path && (
          <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>{input.file_path}</span>
        )}
      </div>
      {inputStr && !input?.file_path && (
        <div style={{ ...styles.toolResult, maxHeight: '80px', fontSize: '11px' }}>
          {inputStr.slice(0, 300)}
          {inputStr.length > 300 ? '…' : ''}
        </div>
      )}
    </div>
  )
}

function ToolResultBubble({ content }) {
  if (!content) return null
  const text = typeof content === 'string' ? content : JSON.stringify(content)
  return (
    <div style={{ marginBottom: '4px' }}>
      <div style={styles.toolResult}>
        {text.slice(0, 500)}
        {text.length > 500 ? '\n…' : ''}
      </div>
    </div>
  )
}

function PhaseSeparator({ text }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        margin: '14px 0 10px',
      }}
    >
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
          color: '#00d4ff',
          padding: '2px 10px',
          borderRadius: '9999px',
          border: '1px solid rgba(0,212,255,0.25)',
          background: 'rgba(0,212,255,0.06)',
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

export function ChatBubble({ message }) {
  const { role, type, subtype, text, tool, input, content } = message

  if (type === 'phase_separator') return <PhaseSeparator text={text} />
  if (type === 'tool_use') return <ToolUseBubble tool={tool} input={input} />
  if (type === 'tool_result') return <ToolResultBubble content={content} />

  // Thinking bubbles — model reasoning, visually distinct
  if (role === 'assistant' && subtype === 'thinking') {
    return (
      <div style={{ ...styles.row('assistant'), marginBottom: 2 }}>
        <div style={{
          maxWidth: '72%',
          padding: '8px 14px',
          borderRadius: '12px 12px 12px 4px',
          background: 'rgba(167,139,250,0.06)',
          border: '1px solid rgba(167,139,250,0.2)',
          borderLeft: '2px solid var(--accent-purple)',
          opacity: 0.75,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-purple)', marginBottom: 4 }}>
            thinking
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.55 }}>
            {text || ''}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...styles.row(role), animation: 'bubble-in 160ms var(--ease-out) both' }}>
      <div style={styles.bubble(role)}>
        {role === 'assistant' ? (
          <ReactMarkdown>{text || ''}</ReactMarkdown>
        ) : (
          <span>{text}</span>
        )}
      </div>
    </div>
  )
}
