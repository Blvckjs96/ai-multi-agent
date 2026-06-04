import { useState } from 'react'
import { Bot, BookOpen, Wrench, Star, AlignLeft } from 'lucide-react'
import ModelEditor from './ModelEditor'
import KnowledgeWorkspace from './KnowledgeWorkspace'
import ToolkitEditor from './ToolkitEditor'
import SkillEditor from './SkillEditor'
import PromptEditor from './PromptEditor'

const TABS = [
  { id: 'models',    label: 'Models',    icon: Bot },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen },
  { id: 'tools',     label: 'Tools',     icon: Wrench },
  { id: 'skills',    label: 'Skills',    icon: Star },
  { id: 'prompts',   label: 'Prompts',   icon: AlignLeft },
]

export default function WorkspacePanel({ workspaceId }) {
  const [tab, setTab] = useState('models')
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-1 px-4 border-b border-argo-border bg-argo-surface flex-shrink-0 h-11">
        {TABS.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={['flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-b-2',
                tab === t.id ? 'border-argo-cyan text-argo-cyan' : 'border-transparent text-argo-muted hover:text-argo-secondary',
              ].join(' ')}>
              <Icon size={13} strokeWidth={1.8} />
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'models'    && <ModelEditor workspaceId={workspaceId} />}
        {tab === 'knowledge' && <KnowledgeWorkspace workspaceId={workspaceId} />}
        {tab === 'tools'     && <ToolkitEditor workspaceId={workspaceId} />}
        {tab === 'skills'    && <SkillEditor workspaceId={workspaceId} />}
        {tab === 'prompts'   && <PromptEditor workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
