import { useCallback, useEffect, useState } from 'react'
import { API_ORIGIN } from '../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useAutomations(workspaceId) {
  const [automations, setAutomations] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const active = automations.find((a) => a.id === activeId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`${API_ORIGIN}/api/v1/automations`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        setAutomations(d.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const create = useCallback(async (data) => {
    const r = await fetch(`${API_ORIGIN}/api/v1/automations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ workspace_id: workspaceId ?? null, ...data }),
    })
    if (r.ok) {
      const item = await r.json()
      setAutomations((prev) => [item, ...prev])
      setActiveId(item.id)
      return item
    }
  }, [workspaceId])

  const update = useCallback(async (id, patch) => {
    setAutomations((prev) => prev.map((a) => a.id === id ? { ...a, ...patch } : a))
    const r = await fetch(`${API_ORIGIN}/api/v1/automations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    })
    if (r.ok) {
      const updated = await r.json()
      setAutomations((prev) => prev.map((a) => a.id === id ? updated : a))
    }
  }, [])

  const remove = useCallback(async (id) => {
    await fetch(`${API_ORIGIN}/api/v1/automations/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    setAutomations((prev) => prev.filter((a) => a.id !== id))
    setActiveId((prev) => prev === id ? null : prev)
  }, [])

  const trigger = useCallback(async (id) => {
    const r = await fetch(`${API_ORIGIN}/api/v1/automations/${id}/trigger`, {
      method: 'POST',
      headers: authHeaders(),
    })
    if (r.ok) {
      const updated = await r.json()
      setAutomations((prev) => prev.map((a) => a.id === id ? updated : a))
      return updated
    }
  }, [])

  return {
    automations,
    active,
    activeId,
    setActiveId,
    loading,
    create,
    update,
    remove,
    trigger,
    reload: load,
  }
}
