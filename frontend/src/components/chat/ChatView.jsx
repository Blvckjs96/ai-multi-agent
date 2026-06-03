import { useEffect, useRef } from 'react'
import { ChatBubble } from './ChatBubble'
import { ChatInput } from './ChatInput'
import { ConfirmBanner } from './ConfirmBanner'
import { STATUS } from '../../hooks/useChat'

// ── Spinner animation (keyframe in index.css) ─────────────────────────────
function Spinner({ color = '#00d4ff', size = 14 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid rgba(255,255,255,0.12)`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'argo-spin 0.75s linear infinite',
        flexShrink: 0,
      }}
    />
  )
}

// ── Typing indicator (three bouncing dots) ───────────────────────────────
function TypingIndicator() {
  const dotStyle = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--accent-cyan)',
    display: 'inline-block',
    animation: 'argo-typing-bounce 1.2s ease-in-out infinite',
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 0 4px' }}>
      {[0, 0.15, 0.3].map((delay, i) => (
        <span key={i} style={{ ...dotStyle, animationDelay: `${delay}s` }} />
      ))}
    </div>
  )
}

// ── Phase indicator shown while planning / executing ──────────────────────
function PhaseIndicator({ status, activeTools, onAbort }) {
  const isPlanning = status === STATUS.PLANNING
  const isExecuting = status === STATUS.EXECUTING

  if (!isPlanning && !isExecuting) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '9px 14px',
        borderRadius: '10px',
        background: isExecuting ? 'rgba(0,255,157,0.04)' : 'rgba(0,212,255,0.04)',
        border: `1px solid ${isExecuting ? 'rgba(0,255,157,0.15)' : 'rgba(0,212,255,0.15)'}`,
        margin: '6px 0 2px',
        alignSelf: 'flex-start',
        maxWidth: '340px',
      }}
    >
      <Spinner color={isExecuting ? '#00ff9d' : '#00d4ff'} />
      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flex: 1 }}>
        {isExecuting ? (
          activeTools.length > 0 ? (
            <>
              Using{' '}
              <span style={{ color: '#00ff9d', fontFamily: 'monospace' }}>
                {activeTools.join(', ')}
              </span>
              …
            </>
          ) : (
            'Executing…'
          )
        ) : activeTools.length > 0 ? (
          <>
            Planning with{' '}
            <span style={{ color: '#00d4ff', fontFamily: 'monospace' }}>
              {activeTools.join(', ')}
            </span>
            …
          </>
        ) : (
          'Planning…'
        )}
      </span>
      {isExecuting && (
        <button
          onClick={onAbort}
          title="Stop execution"
          style={{
            background: 'rgba(255,77,106,0.12)',
            border: '1px solid rgba(255,77,106,0.3)',
            color: 'var(--status-error)',
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '11px',
            fontWeight: 600,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          Stop
        </button>
      )}
    </div>
  )
}

// ── Session stats shown after done ────────────────────────────────────────
function SessionStats({ stats }) {
  if (!stats) return null
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px',
        fontSize: '11px',
        color: 'var(--text-dim)',
        fontVariantNumeric: 'tabular-nums',
        padding: '4px 0',
        flexWrap: 'wrap',
      }}
    >
      <span>in {stats.inputTokens.toLocaleString()} tok</span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span>out {stats.outputTokens.toLocaleString()} tok</span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span>${(stats.costUsd || 0).toFixed(4)}</span>
    </div>
  )
}

// ── Main ChatView ─────────────────────────────────────────────────────────
export function ChatView({
  messages,
  status,
  error,
  activeTools,
  stats,
  onSend,
  onConfirm,
  onCancel,
  onReset,
  onFileSelect,
  workspaceId,
}) {
  const bottomRef = useRef(null)
  const isPlanning = status === STATUS.PLANNING
  const isExecuting = status === STATUS.EXECUTING
  const isBusy = isPlanning || isExecuting
  const awaitingConfirm = status === STATUS.AWAITING_CONFIRM
  const isDone = status === STATUS.DONE
  const isEmpty = messages.length === 0 && status === STATUS.IDLE

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, status])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', animation: 'scale-in 200ms var(--ease-out) both' }}>
      {/* Message scroll area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
      >
        {/* Empty state */}
        {isEmpty && (
          <div style={{ textAlign: 'center', marginTop: '80px', userSelect: 'none' }}>
            <div
              style={{
                fontSize: '34px',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00d4ff, #00ff9d)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                letterSpacing: '-0.03em',
                marginBottom: '10px',
              }}
            >
              Argo
            </div>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-dim)',
                lineHeight: 1.6,
                maxWidth: '320px',
                margin: '0 auto',
              }}
            >
              Your AI workspace. Ask anything or start a task — Argo will plan first, then
              execute once you confirm.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                justifyContent: 'center',
                marginTop: '24px',
              }}
            >
              {[
                'Review my auth middleware',
                'Write tests for UserService',
                'Debug the login 500 error',
                'Explain the triage pipeline',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--border-strong)',
                    color: 'var(--text-dim)',
                    padding: '5px 13px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-hover)'
                    e.currentTarget.style.color = 'var(--text-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-dim)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}

        {/* Typing indicator while planning (shows between user message and assistant response) */}
        {status === STATUS.PLANNING && (messages.length === 0 || messages[messages.length - 1]?.role === 'user') && (
          <TypingIndicator />
        )}

        {/* Live phase indicator (planning / executing) */}
        <PhaseIndicator status={status} activeTools={activeTools} onAbort={onCancel} />

        {/* Plan gate — user must confirm before execution */}
        {awaitingConfirm && (
          <ConfirmBanner onConfirm={onConfirm} onCancel={onCancel} workspaceId={workspaceId} />
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'var(--error-soft)',
              border: '1px solid rgba(255,77,106,0.2)',
              color: 'var(--status-error)',
              fontSize: '13px',
              marginTop: '6px',
            }}
          >
            {error}
          </div>
        )}

        {/* Post-execution stats + new conversation button */}
        {isDone && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <SessionStats stats={stats} />
            <button
              onClick={onReset}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                color: 'var(--text-dim)',
                padding: '5px 16px',
                borderRadius: '9999px',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-dim)'
              }}
            >
              + New conversation
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Sticky input */}
      <ChatInput
        onSend={onSend}
        onFileSelect={onFileSelect}
        disabled={isBusy || awaitingConfirm}
        placeholder={
          awaitingConfirm
            ? 'Review the plan above, then confirm or cancel…'
            : isBusy
              ? 'Argo is working…'
              : 'Ask Argo anything… (Shift+Enter for new line)'
        }
      />
    </div>
  )
}
