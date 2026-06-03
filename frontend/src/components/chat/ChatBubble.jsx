import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { Settings2, ThumbsUp, ThumbsDown } from 'lucide-react'
import CodeBlock from './CodeBlock'

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: '#00d4ff',
        padding: '2px 10px',
        borderRadius: '9999px',
        border: '1px solid rgba(0,212,255,0.25)',
        background: 'rgba(0,212,255,0.06)',
      }}>
        {text}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

const MARKDOWN_COMPONENTS = {
  code({ node, inline, className, children, ...props }) {
    if (inline) {
      return (
        <code
          style={{
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'var(--f-mono)',
            background: 'rgba(255,255,255,0.08)',
            color: 'var(--accent-cyan)',
          }}
          {...props}
        >
          {children}
        </code>
      )
    }
    return <CodeBlock className={className}>{children}</CodeBlock>
  },
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{
      padding: '6px 12px',
      textAlign: 'left',
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-muted)',
      borderBottom: '1px solid var(--border)',
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      padding: '6px 12px',
      fontSize: '13px',
      color: 'var(--text-secondary)',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      {children}
    </td>
  ),
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '2px solid var(--accent-cyan)',
      paddingLeft: '12px',
      margin: '8px 0',
      color: 'var(--text-secondary)',
      fontStyle: 'italic',
      fontSize: '13px',
    }}>
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--accent-cyan)', textDecoration: 'underline', textUnderlineOffset: '2px' }}
    >
      {children}
    </a>
  ),
}

export function ChatBubble({ message, onFeedback, feedback }) {
  const { role, type, subtype, text, tool, input, content } = message

  if (type === 'phase_separator') return <PhaseSeparator text={text} />
  if (type === 'tool_use') return <ToolUseBubble tool={tool} input={input} />
  if (type === 'tool_result') return <ToolResultBubble content={content} />

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
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--accent-purple)',
            marginBottom: 4,
          }}>
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
          <div className="group relative">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={MARKDOWN_COMPONENTS}
            >
              {text || ''}
            </ReactMarkdown>
            {onFeedback && (
              <div className="absolute -bottom-6 right-0 hidden group-hover:flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onFeedback('up')}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: feedback === 'up' ? 'var(--accent-green)' : 'var(--text-muted)',
                    transition: 'color 150ms',
                  }}
                  aria-label="Helpful"
                >
                  <ThumbsUp size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback('down')}
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: feedback === 'down' ? '#f87171' : 'var(--text-muted)',
                    transition: 'color 150ms',
                  }}
                  aria-label="Not helpful"
                >
                  <ThumbsDown size={12} />
                </button>
              </div>
            )}
          </div>
        ) : (
          <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
        )}
      </div>
    </div>
  )
}
