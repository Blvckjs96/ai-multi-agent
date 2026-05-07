import { useCallback, useState } from 'react'
import { AgentCard } from './components/AgentCard'
import { InputForm } from './components/InputForm'
import { Sidebar, saveRunToHistory } from './components/Sidebar'
import { SpecOutput } from './components/SpecOutput'
import { usePipeline } from './hooks/usePipeline'

const AGENT_NAMES = ['planner', 'engineer', 'cost_estimator', 'writer']

export default function App() {
  const { agents, spec, isRunning, error, runPipeline, reset } = usePipeline()
  const [description, setDescription] = useState('')

  const handleSubmit = useCallback(
    async (desc) => {
      setDescription(desc)
      saveRunToHistory(desc)
      window.dispatchEvent(new Event('pipeline_history_updated'))
      await runPipeline(desc)
    },
    [runPipeline],
  )

  const handleSelectRun = useCallback(
    (desc) => {
      reset()
      setDescription(desc)
    },
    [reset],
  )

  const handleNewRun = useCallback(() => {
    reset()
    setDescription('')
  }, [reset])

  const hasActivity = Object.values(agents).some(
    (a) => a.status === 'thinking' || a.status === 'done',
  )

  return (
    <div style={{ display: 'flex', minHeight: '100dvh' }}>
      {/* Sidebar */}
      <Sidebar onSelectRun={handleSelectRun} />

      {/* Main content */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          overflowY: 'auto',
        }}
      >
        {/* Top bar */}
        <header
          style={{
            borderBottom: '1px solid var(--border)',
            padding: '14px 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'rgba(15,15,15,0.85)',
            backdropFilter: 'blur(12px)',
            zIndex: 10,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              AI Spec Generator
            </h1>
            <p style={{ fontSize: '11.5px', color: 'var(--text-dim)', marginTop: '1px' }}>
              Planner · Engineer · Cost Estimator · Writer
            </p>
          </div>

          {hasActivity && (
            <button
              onClick={handleNewRun}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            >
              + New Run
            </button>
          )}
        </header>

        {/* Content area */}
        <div
          style={{
            flex: 1,
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            maxWidth: '860px',
            width: '100%',
            margin: '0 auto',
          }}
        >
          {/* Input */}
          <section>
            <div style={{ marginBottom: '10px' }}>
              <h2
                style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}
              >
                Project Description
              </h2>
            </div>
            <InputForm
              onSubmit={handleSubmit}
              isRunning={isRunning}
              initialValue={description}
            />
          </section>

          {/* Error state */}
          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--error-soft)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                fontSize: '13px',
                color: 'var(--error)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              <span style={{ flexShrink: 0 }}>⚠</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Pipeline error</strong>
                {error}
              </div>
            </div>
          )}

          {/* Agent cards — only show when pipeline has started */}
          {hasActivity && (
            <section>
              <div style={{ marginBottom: '10px' }}>
                <h2
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Agent Pipeline
                </h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {AGENT_NAMES.map((name) => (
                  <AgentCard
                    key={name}
                    name={name}
                    status={agents[name].status}
                    result={agents[name].result}
                    provider={agents[name].provider}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Final spec */}
          {spec && (
            <section>
              <div style={{ marginBottom: '10px' }}>
                <h2
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  Generated Specification
                </h2>
              </div>
              <SpecOutput spec={spec} />
            </section>
          )}

          {/* Empty state */}
          {!hasActivity && !error && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                gap: '16px',
                color: 'var(--text-dim)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  background: 'rgba(108,99,255,0.08)',
                  border: '1px solid rgba(108,99,255,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                ⬡
              </div>
              <div>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: '6px',
                  }}
                >
                  Describe your project above
                </p>
                <p style={{ fontSize: '12.5px', maxWidth: '340px', lineHeight: 1.6 }}>
                  Four specialised AI agents will collaborate to produce a full project
                  specification — phases, architecture, cost estimate, and a final document.
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  marginTop: '4px',
                }}
              >
                {['Planner', 'Engineer', 'Cost Estimator', 'Writer'].map((label) => (
                  <span
                    key={label}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-dim)',
                      padding: '3px 10px',
                      borderRadius: '99px',
                      fontSize: '11px',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
