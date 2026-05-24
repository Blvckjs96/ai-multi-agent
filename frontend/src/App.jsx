import { useCallback, useState } from 'react'

// Pipeline mode
import { AgentCard } from './components/AgentCard'
import { InputForm } from './components/InputForm'
import { saveRunToHistory } from './components/Sidebar'
import { SpecOutput } from './components/SpecOutput'
import { usePipeline } from './hooks/usePipeline'

// Chat mode (standalone)
import { ChatView } from './components/chat/ChatView'
import { TerminalView } from './components/chat/TerminalView'
import { useChat, STATUS } from './hooks/useChat'

// Panels
import WikiPanel from './components/wiki/WikiPanel'
import { ChironPanel } from './components/chiron/ChironPanel'
import { ChangeTimeline } from './components/timeline/ChangeTimeline'
import { GitHubPanel } from './components/github/GitHubPanel'
import ProvidersPanel from './components/providers/ProvidersPanel'
import ModelSelector from './components/providers/ModelSelector'
import SettingsPanel from './components/settings/SettingsPanel'
import ClaudeAuthStatus from './components/auth/ClaudeAuthStatus'
import ArgorouterPanel from './components/argorouter/ArgorouterPanel'
import CodegraphPanel from './components/codegraph/CodegraphPanel'

// Argo 2-column layout
import { IssueBoard } from './components/layout/IssueBoard'
import { IssueWorkspace } from './components/layout/IssueWorkspace'

// Workspace tab management
import { WorkspaceTabs } from './components/WorkspaceTabs'
import { useWorkspace } from './hooks/useWorkspace'

// New sidebar components
import AppSidebar from './components/AppSidebar'
import ConversationSidebar from './components/chat/ConversationSidebar'
import { useConversations } from './hooks/useConversations'

const AGENT_NAMES = ['planner', 'engineer', 'cost_estimator', 'writer']

// ── Chat standalone panel ─────────────────────────────────────────────────────

function ChatPanel({ workspaceId }) {
  const [view, setView] = useState('chat')
  const chat = useChat()

  const sendWithWorkspace = useCallback(
    (msg) => chat.send(msg, workspaceId),
    [chat.send, workspaceId],
  )

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ borderBottom: '1px solid var(--border)', padding: '7px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10,10,11,0.85)', backdropFilter: 'blur(12px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {chat.sessionId && <span className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{chat.sessionId.slice(0, 8)}…</span>}
          {chat.status === STATUS.PLANNING && <span style={{ fontSize: 11, color: 'var(--accent-cyan)' }}>planning</span>}
          {chat.status === STATUS.EXECUTING && <span style={{ fontSize: 11, color: 'var(--accent-green)' }}>executing</span>}
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--bg-elevated)', borderRadius: 8, padding: 2, border: '1px solid var(--border)', gap: 1 }}>
          {['chat', 'terminal'].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{ fontFamily: 'inherit', fontSize: 11, fontWeight: 500, border: 0, padding: '3px 10px', borderRadius: 6, cursor: 'pointer', background: view === v ? 'var(--bg-overlay)' : 'transparent', color: view === v ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'all 120ms', textTransform: 'capitalize' }}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: view === 'chat' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <ChatView messages={chat.messages} status={chat.status} error={chat.error} activeTools={chat.activeTools} stats={chat.stats} onSend={sendWithWorkspace} onConfirm={chat.confirm} onCancel={chat.cancel} onReset={chat.reset} workspaceId={workspaceId} />
        </div>
        <div style={{ flex: 1, display: view === 'terminal' ? 'flex' : 'none', flexDirection: 'column', overflow: 'hidden' }}>
          <TerminalView events={chat.rawEvents} />
        </div>
      </div>
    </div>
  )
}

// ── Pipeline panel ────────────────────────────────────────────────────────────

function PipelinePanel() {
  const { agents, spec, isRunning, error, pipelineStats, runPipeline, reset } = usePipeline()
  const [description, setDescription] = useState('')

  const handleSubmit = useCallback(async (desc) => {
    setDescription(desc)
    saveRunToHistory(desc)
    window.dispatchEvent(new Event('pipeline_history_updated'))
    await runPipeline(desc)
  }, [runPipeline])

  const handleNewRun = useCallback(() => { reset(); setDescription('') }, [reset])
  const hasActivity = Object.values(agents).some((a) => a.status === 'thinking' || a.status === 'done')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
      <div style={{ flex: 1, padding: '32px 28px 48px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '820px', width: '100%', margin: '0 auto' }}>
        {!hasActivity && !error && (
          <div style={{ textAlign: 'center', padding: '48px 0 24px' }}>
            <h1 className="display" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 8, background: 'var(--accent-grad)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>What should we build?</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>Describe your project and four AI agents will produce a full specification.</p>
          </div>
        )}
        {hasActivity && description && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: '-0.01em', borderLeft: '2px solid var(--border-active)', paddingLeft: 12 }}>
            {description.slice(0, 100)}{description.length > 100 ? '…' : ''}
          </div>
        )}
        <InputForm onSubmit={handleSubmit} isRunning={isRunning} initialValue={description} />
        {pipelineStats && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { label: 'Tokens in', value: pipelineStats.tokensBefore.toLocaleString() },
              { label: 'Compressed', value: pipelineStats.tokensAfter.toLocaleString(), badge: pipelineStats.tokensBefore > pipelineStats.tokensAfter ? `−${Math.round((1 - pipelineStats.tokensAfter / pipelineStats.tokensBefore) * 100)}%` : null },
              { label: 'RAG chunks', value: pipelineStats.ragChunks, dim: pipelineStats.ragChunks === 0 },
            ].map(({ label, value, badge, dim }) => (
              <div key={label} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '7px 14px', fontSize: 12, color: dim ? 'var(--text-muted)' : 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span>{label}:</span>
                <span style={{ fontWeight: 600, color: dim ? 'var(--text-muted)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
                {badge && <span style={{ color: 'var(--accent-cyan)', fontSize: 11, fontWeight: 700 }}>{badge}</span>}
              </div>
            ))}
          </div>
        )}
        {error && (
          <div role="alert" style={{ background: 'var(--error-soft)', border: '1px solid rgba(255,77,106,0.2)', borderRadius: 'var(--r-md)', padding: '12px 16px', fontSize: 13, color: 'var(--status-error)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <div><strong style={{ display: 'block', marginBottom: 2 }}>Pipeline error</strong>{error}</div>
          </div>
        )}
        {hasActivity && (
          <section>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Agent Pipeline</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {AGENT_NAMES.map((name) => <AgentCard key={name} name={name} status={agents[name].status} result={agents[name].result} provider={agents[name].provider} />)}
            </div>
            <button onClick={handleNewRun} style={{ marginTop: 12, background: 'transparent', border: '1px solid var(--border-active)', color: 'var(--text-secondary)', padding: '5px 14px', borderRadius: 'var(--r-lg)', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>+ New run</button>
          </section>
        )}
        {spec && (
          <section>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 10 }}>Generated Specification</p>
            <SpecOutput spec={spec} />
          </section>
        )}
        {!hasActivity && !error && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
            {['SaaS todo app', 'E-commerce API', 'Real-time chat service', 'Mobile fitness tracker'].map((label) => (
              <button key={label} onClick={() => setDescription(label)} style={{ background: 'transparent', border: '1px solid var(--border-active)', color: 'var(--text-muted)', padding: '4px 12px', borderRadius: 'var(--r-lg)', fontSize: 12, cursor: 'pointer', letterSpacing: '-0.01em' }}>{label}</button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tasks 2-column layout ─────────────────────────────────────────────────────

function TasksLayout({ workspaceId }) {
  const [selectedTask, setSelectedTask] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleSelect = useCallback((task) => {
    setSelectedTask(task)
  }, [])

  const handleTaskRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      <IssueBoard
        key={refreshKey}
        workspaceId={workspaceId}
        selectedId={selectedTask?.id}
        onSelect={handleSelect}
      />
      <IssueWorkspace
        task={selectedTask}
        workspaceId={workspaceId}
        onTaskRefresh={handleTaskRefresh}
      />
    </div>
  )
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusBar({ mode }) {
  return (
    <div
      style={{
        height: 24,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 12,
        fontSize: 10,
        color: 'var(--text-muted)',
        flexShrink: 0,
      }}
    >
      <span className="mono">Argo v0.5.0</span>
      <span>·</span>
      <span>{mode}</span>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [mode, setMode] = useState('tasks')
  const ws = useWorkspace()
  const convs = useConversations()
  const workspaceId = ws.activeId

  return (
    <div
      className="grain"
      style={{ display: 'flex', flexDirection: 'row', height: '100dvh', overflow: 'hidden', background: 'var(--bg-base)' }}
    >
      <AppSidebar mode={mode} onModeChange={setMode} />

      {mode === 'chat' && (
        <ConversationSidebar
          conversations={convs.conversations}
          groupedConversations={convs.groupedConversations}
          activeId={convs.activeId}
          onSelect={convs.selectConversation}
          onNew={() => convs.createConversation('New conversation')}
          onRename={convs.renameConversation}
          onDelete={convs.deleteConversation}
        />
      )}

      {/* Main content column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar: workspace tabs + model selector + auth */}
        <div style={{ height: 36, flexShrink: 0, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <WorkspaceTabs
              openWorkspaces={ws.openWorkspaces}
              activeId={ws.activeId}
              all={ws.all}
              openIds={ws.openIds}
              onSwitch={ws.switchWorkspace}
              onClose={ws.closeWorkspace}
              onCreate={ws.createWorkspace}
              onOpen={ws.openWorkspace}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderLeft: '1px solid var(--border)', flexShrink: 0 }}>
            <ModelSelector compact />
            <span style={{ color: 'var(--border)', fontSize: 14 }}>|</span>
            <ClaudeAuthStatus />
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {mode === 'tasks'       && <TasksLayout workspaceId={workspaceId} />}
          {mode === 'chat'        && <ChatPanel workspaceId={workspaceId} />}
          {mode === 'pipeline'    && <PipelinePanel />}
          {mode === 'chiron'      && <ChironPanel workspaceId={workspaceId} />}
          {mode === 'wiki'        && <WikiPanel workspaceId={workspaceId} />}
          {mode === 'argorouter'  && <ArgorouterPanel />}
          {mode === 'codegraph'   && <CodegraphPanel workspaceId={workspaceId} repoPath={ws.activeWorkspace?.repo_path ?? null} />}
          {mode === 'timeline'    && <ChangeTimeline workspaceId={workspaceId} />}
          {mode === 'github'      && <GitHubPanel />}
          {mode === 'providers'   && <ProvidersPanel />}
          {mode === 'settings'    && <SettingsPanel />}
        </div>

        <StatusBar mode={mode} />
      </div>
    </div>
  )
}
