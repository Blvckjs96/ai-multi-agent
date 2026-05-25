import { useState } from 'react'
import { Search, FileCode, Activity } from 'lucide-react'
import IndexStatus from './IndexStatus'
import SymbolSearch from './SymbolSearch'
import ContextViewer from './ContextViewer'

const TABS = [
  { id: 'search',  label: 'Symbols', Icon: Search },
  { id: 'context', label: 'Context', Icon: FileCode },
  { id: 'status',  label: 'Status',  Icon: Activity },
]

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  header: { padding: '12px 16px 0', flexShrink: 0 },
  titleRow: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px',
  },
  title: {
    fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '.07em',
  },
  tabs: {
    display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)',
  },
  tab: {
    padding: '7px 14px', fontSize: '13px', cursor: 'pointer',
    borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
    border: 'none', background: 'transparent', transition: 'color 150ms',
    borderBottom: '2px solid transparent', marginBottom: '-1px',
    display: 'flex', alignItems: 'center', gap: '5px',
  },
  content: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  splitPane: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },
  left: {
    width: '280px', flexShrink: 0, borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  right: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
}

export default function CodegraphPanel({ workspaceId, repoPath }) {
  const [activeTab, setActiveTab] = useState('search')
  const [indexStatus, setIndexStatus] = useState(null)
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const handleSymbolSelect = (sym) => {
    setSelectedSymbol(sym)
    setActiveTab('context')
  }

  return (
    <div style={s.root}>
      <IndexStatus
        workspaceId={workspaceId}
        repoPath={repoPath}
        onStatusChange={setIndexStatus}
      />

      <div style={s.header}>
        <div style={s.titleRow}>
          <span style={s.title}>Codegraph</span>
          {indexStatus?.running && (
            <span style={{ fontSize: '11px', color: 'var(--success)', background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.2)', borderRadius: '4px', padding: '1px 6px', fontFamily: 'var(--f-mono)' }}>
              indexed
            </span>
          )}
        </div>
        <div style={s.tabs} role="tablist">
          {TABS.map(({ id, label, Icon }) => {
            const isActive = id === activeTab
            return (
              <button
                key={id}
                role="tab"
                aria-selected={isActive}
                style={{
                  ...s.tab,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                  borderBottomColor: isActive ? 'var(--accent)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                }}
                onClick={() => setActiveTab(id)}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-dim)' }}
              >
                <Icon size={12} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={s.content} role="tabpanel">
        {activeTab === 'search' && (
          <div style={s.splitPane}>
            <div style={s.left}>
              <SymbolSearch workspaceId={workspaceId} onSymbolSelect={handleSymbolSelect} />
            </div>
            <div style={s.right}>
              <ContextViewer workspaceId={workspaceId} symbol={selectedSymbol} />
            </div>
          </div>
        )}

        {activeTab === 'context' && (
          <ContextViewer workspaceId={workspaceId} symbol={selectedSymbol} />
        )}

        {activeTab === 'status' && (
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '20px 24px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '12px' }}>Indexer</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Status', value: indexStatus?.running ? 'Running' : 'Stopped', color: indexStatus?.running ? 'var(--success)' : 'var(--text-dim)' },
                  { label: 'Port', value: indexStatus?.port ? String(indexStatus.port) : '—' },
                  { label: 'Binary', value: indexStatus?.bin_exists ? 'Found' : 'Not found', color: indexStatus?.bin_exists ? 'var(--success)' : 'var(--error)' },
                  { label: 'Workspace', value: workspaceId ? workspaceId.slice(0, 8) + '…' : '—' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
                    <span style={{ fontSize: '14px', fontFamily: 'var(--f-mono)', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {!indexStatus?.bin_exists && (
              <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>Build the indexer</div>
                <pre style={{ fontFamily: 'var(--f-mono)', fontSize: '12px', color: 'var(--accent)', background: 'var(--bg-overlay)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', margin: 0 }}>
                  cd codegraph && npm run build
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
