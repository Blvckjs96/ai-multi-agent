import { useCallback, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { FolderOpen, GitBranch } from 'lucide-react'
import { AgentLanes } from './AgentLanes'
import { IssueWorkspace } from './IssueWorkspace'
import ModelSelector from '../providers/ModelSelector'
import ClaudeAuthStatus from '../auth/ClaudeAuthStatus'

const TASK_API = '/api/v1/tasks'

const STATUS_TO_STEP = {
  busy:     'implementation',
  awaiting: 'implementation',
  exited:   'review',
}

// ── Slim IDE header (34px) ────────────────────────────────────────────────────

function IdeHeader({ workspaceName, activeBranch }) {
  return (
    <div style={{
      height: 34, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 12px',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
        {workspaceName ? (
          <>
            <FolderOpen size={12} strokeWidth={1.6} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160,
            }}>
              {workspaceName}
            </span>
            {activeBranch && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--f-mono)',
                background: 'var(--bg-overlay)', border: '1px solid var(--border)',
                borderRadius: 999, padding: '1px 6px', flexShrink: 0,
              }}>
                <GitBranch size={8} />
                {activeBranch.length > 24 ? activeBranch.slice(0, 24) + '…' : activeBranch}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No workspace selected</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <ModelSelector compact />
        <span style={{ width: 1, height: 14, background: 'var(--border)', flexShrink: 0 }} />
        <ClaudeAuthStatus />
      </div>
    </div>
  )
}

// ── IdeLayout ─────────────────────────────────────────────────────────────────

export function IdeLayout({ workspaceId, createWorkspace, workspacePath, workspaceName, branchName }) {
  // selectedEntry holds the currently open task with its resolved paths
  const [selectedEntry, setSelectedEntry] = useState(null)
  // { task, cwd, worktreePath, taskBranch, status }
  const [refreshKey, setRefreshKey] = useState(0)

  const patchTask = useCallback((taskId, fields) => {
    fetch(`${TASK_API}/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }).catch(() => {})
  }, [])

  const handleSelectTask = useCallback(async (task) => {
    if (!task) { setSelectedEntry(null); return }

    // If already selected, no-op
    if (selectedEntry?.task?.id === task.id) return

    // Resolve cwd from worktree, or create one
    let cwd          = workspacePath ?? null
    let worktreePath = null
    let taskBranch   = null

    if (workspacePath) {
      if (task.worktree_path) {
        cwd          = task.worktree_path
        worktreePath = task.worktree_path
        taskBranch   = task.worktree_name ?? null
      } else {
        const slug   = task.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28)
        const branch = `argo/${slug}-${task.id.slice(0, 6)}`
        const dest   = `${workspacePath}/.argo-worktrees/${task.id.slice(0, 8)}`
        try {
          const created = await invoke('git_worktree_create', { cwd: workspacePath, path: dest, branch })
          cwd          = created
          worktreePath = created
          taskBranch   = branch
          patchTask(task.id, { worktree_path: created, worktree_name: branch, step: 'planning' })
        } catch {
          cwd = workspacePath
        }
      }
    }

    setSelectedEntry({ task, cwd, worktreePath, taskBranch, status: 'idle' })
  }, [selectedEntry, workspacePath, patchTask])

  const handleStatusChange = useCallback((termStatus) => {
    setSelectedEntry((prev) => prev ? { ...prev, status: termStatus } : prev)
    if (selectedEntry?.task?.id) {
      const step = STATUS_TO_STEP[termStatus]
      if (step) patchTask(selectedEntry.task.id, { step })
    }
  }, [selectedEntry, patchTask])

  const handleAddFolder = useCallback(async () => {
    try {
      const path = await invoke('choose_folder')
      if (!path) return
      const name = path.split('/').filter(Boolean).pop() ?? 'workspace'
      await createWorkspace(name, path, '')
    } catch { /* dialog cancelled */ }
  }, [createWorkspace])

  const handleTaskRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  // The active branch shown in header = selected task's branch or workspace default
  const activeBranch = selectedEntry?.taskBranch ?? branchName ?? null

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <IdeHeader workspaceName={workspaceName} activeBranch={activeBranch} />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: agent monitor */}
        <AgentLanes
          workspaceId={workspaceId}
          selectedId={selectedEntry?.task?.id ?? null}
          onSelect={handleSelectTask}
          onAddFolder={handleAddFolder}
          refreshKey={refreshKey}
        />

        {/* Right: task workspace — Terminal / Chat / Description / Git / History / Meta */}
        <IssueWorkspace
          task={selectedEntry?.task ?? null}
          cwd={selectedEntry?.cwd ?? workspacePath ?? null}
          worktreePath={selectedEntry?.worktreePath ?? null}
          workspacePath={workspacePath ?? null}
          workspaceId={workspaceId}
          onTaskRefresh={handleTaskRefresh}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  )
}
