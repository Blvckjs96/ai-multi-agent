import { useCallback, useEffect, useState } from 'react'

const API = '/api/v1'

export function useTaskSession(taskId, workspaceId) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!taskId) return
    try {
      const res = await fetch(`${API}/task-sessions?task_id=${taskId}`)
      if (res.ok) {
        const data = await res.json()
        setSession(data?.items?.[0] ?? null)
      }
    } catch { /* ignore */ }
  }, [taskId])

  useEffect(() => { load() }, [load])

  const create = useCallback(async ({ cli = 'claude', shell = 'zsh', planMode = false } = {}) => {
    if (!taskId || !workspaceId) return null
    setLoading(true)
    try {
      const res = await fetch(`${API}/task-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, workspace_id: workspaceId, cli, shell, plan_mode: planMode }),
      })
      if (res.ok) {
        const data = await res.json()
        setSession(data)
        return data
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
    return null
  }, [taskId, workspaceId])

  const remove = useCallback(async () => {
    if (!session?.id) return
    await fetch(`${API}/task-sessions/${session.id}`, { method: 'DELETE' }).catch(() => {})
    setSession(null)
  }, [session?.id])

  const updateStatus = useCallback((status) => {
    setSession((s) => s ? { ...s, runtime_status: status } : s)
  }, [])

  return { session, loading, create, remove, updateStatus, reload: load }
}
