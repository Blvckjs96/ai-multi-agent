import { useState } from 'react'
import { BookMarked, FolderOpen, Wrench } from 'lucide-react'
import WikiBrowser from './WikiBrowser'
import SourcesManager from './sources/SourcesManager'
import SkillsBrowser from './skills/SkillsBrowser'

const TABS = [
  { id: 'wiki',    label: 'Wiki',    Icon: BookMarked,  title: 'Knowledge Base' },
  { id: 'sources', label: 'Sources', Icon: FolderOpen,  title: 'Document Sources' },
  { id: 'skills',  label: 'Skills',  Icon: Wrench,      title: 'Skill Library' },
]

const s = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  header: {
    padding: '12px 16px 0', flexShrink: 0,
  },
  title: {
    fontSize: '12px', fontWeight: 700, color: 'var(--text-dim)',
    textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px',
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
  content: { flex: 1, overflow: 'hidden' },
}

export default function WikiPanel({ workspaceId }) {
  const [activeTab, setActiveTab] = useState('wiki')

  const activeTabMeta = TABS.find((t) => t.id === activeTab)

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.title}>{activeTabMeta?.title}</div>
        <div style={s.tabs} role="tablist">
          {TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                style={{
                  ...s.tab,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-dim)',
                  borderBottomColor: isActive ? 'var(--accent)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'var(--text-dim)'
                }}
              >
                <tab.Icon size={12} style={{ flexShrink: 0 }} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div style={s.content} role="tabpanel">
        {activeTab === 'wiki' && <WikiBrowser workspaceId={workspaceId} />}
        {activeTab === 'sources' && <SourcesManager workspaceId={workspaceId} />}
        {activeTab === 'skills' && <SkillsBrowser />}
      </div>
    </div>
  )
}
