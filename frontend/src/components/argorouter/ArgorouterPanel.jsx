import { useState } from 'react'
import { Activity, Plug, BarChart3 } from 'lucide-react'
import ArgorouterStatus from './ArgorouterStatus'
import ProviderConnections from './ProviderConnections'
import UsageStats from './UsageStats'

const TABS = [
  { id: 'status',    label: 'Status',    Icon: Activity },
  { id: 'providers', label: 'Providers', Icon: Plug },
  { id: 'usage',     label: 'Usage',     Icon: BarChart3 },
]

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    background: 'var(--bg-primary)', animation: 'scale-in 180ms var(--ease-out) both',
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
  content: { flex: 1, overflow: 'auto' },
}

export default function ArgorouterPanel() {
  const [activeTab, setActiveTab] = useState('status')

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.titleRow}>
          <span style={s.title}>Argorouter</span>
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg-overlay)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 6px', fontFamily: 'var(--f-mono)' }}>
            :20128
          </span>
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
        {activeTab === 'status'    && <ArgorouterStatus />}
        {activeTab === 'providers' && <ProviderConnections />}
        {activeTab === 'usage'     && <UsageStats />}
      </div>
    </div>
  )
}
