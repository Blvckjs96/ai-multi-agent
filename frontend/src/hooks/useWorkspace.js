import { useCallback, useEffect, useState } from 'react'

const OPEN_KEY   = 'argo:open-workspaces'
const ACTIVE_KEY = 'argo:active-workspace'

function loadIds() {
  try { return JSON.parse(localStorage.getItem(OPEN_KEY)) ?? [] } catch { return [] }
}

export function useWorkspace() {
  const [all, setAll]           = useState([])
  const [openIds, setOpenIds]   = useState(loadIds)
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_KEY) ?? null)

  const reload = useCallback(() => {
    fetch('/api/v1/workspaces')
      .then((r) => r.json())
      .then((ws) => {
        setAll(ws)
        // Auto-open the first workspace if nothing is open yet
        if (loadIds().length === 0 && ws.length > 0) {
          const firstId = ws[0].id
          setOpenIds([firstId])
          setActiveId(firstId)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    localStorage.setItem(OPEN_KEY, JSON.stringify(openIds))
  }, [openIds])

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)
  }, [activeId])

  const openWorkspaces  = all.filter((ws) => openIds.includes(ws.id))
  const activeWorkspace = all.find((ws) => ws.id === activeId) ?? null

  const openWorkspace = useCallback((id) => {
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setActiveId(id)
  }, [])

  const closeWorkspace = useCallback((id) => {
    setOpenIds((prev) => {
      const next = prev.filter((x) => x !== id)
      setActiveId((cur) => {
        if (cur !== id) return cur
        return next[next.length - 1] ?? null
      })
      return next
    })
  }, [])

  const switchWorkspace = useCallback((id) => { setActiveId(id) }, [])

  const createWorkspace = useCallback(async (name, path, description) => {
    const res = await fetch('/api/v1/workspaces', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, path, description }),
    })
    if (!res.ok) throw new Error('Failed to create workspace')
    const ws = await res.json()
    reload()
    setTimeout(() => openWorkspace(ws.id), 100)
    return ws
  }, [reload, openWorkspace])

  return {
    all,
    openWorkspaces,
    openIds,
    activeId,
    activeWorkspace,
    openWorkspace,
    closeWorkspace,
    switchWorkspace,
    createWorkspace,
    reload,
  }
}
