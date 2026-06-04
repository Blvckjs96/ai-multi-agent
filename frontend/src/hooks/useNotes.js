import { useCallback, useEffect, useRef, useState } from 'react'
import { API_ORIGIN } from '../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useNotes(workspaceId) {
  const [notes, setNotes]       = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading]   = useState(false)
  const saveTimer = useRef(null)

  const active = notes.find((n) => n.id === activeId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = workspaceId ? `?workspace_id=${workspaceId}` : ''
      const r = await fetch(`${API_ORIGIN}/api/v1/notes${params}`, { headers: authHeaders() })
      if (r.ok) {
        const d = await r.json()
        setNotes(d.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => { load() }, [load])

  const createNote = useCallback(async () => {
    const r = await fetch(`${API_ORIGIN}/api/v1/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title: 'Untitled', content: '', workspace_id: workspaceId ?? null }),
    })
    if (r.ok) {
      const note = await r.json()
      setNotes((prev) => [note, ...prev])
      setActiveId(note.id)
      return note
    }
  }, [workspaceId])

  const updateNote = useCallback(async (id, patch) => {
    // Optimistic update
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n))
    const r = await fetch(`${API_ORIGIN}/api/v1/notes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    })
    if (r.ok) {
      const updated = await r.json()
      setNotes((prev) => prev.map((n) => n.id === id ? updated : n))
    }
  }, [])

  // Debounced auto-save (1s delay)
  const debouncedUpdate = useCallback((id, patch) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    // Optimistic local update immediately
    setNotes((prev) => prev.map((n) => n.id === id ? { ...n, ...patch } : n))
    saveTimer.current = setTimeout(() => {
      fetch(`${API_ORIGIN}/api/v1/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(patch),
      })
        .then((r) => r.ok ? r.json() : null)
        .then((updated) => { if (updated) setNotes((prev) => prev.map((n) => n.id === id ? updated : n)) })
        .catch(() => {})
    }, 1000)
  }, [])

  const deleteNote = useCallback(async (id) => {
    await fetch(`${API_ORIGIN}/api/v1/notes/${id}`, { method: 'DELETE', headers: authHeaders() })
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setActiveId((prev) => prev === id ? null : prev)
  }, [])

  const togglePin = useCallback(async (id) => {
    const r = await fetch(`${API_ORIGIN}/api/v1/notes/${id}/pin`, { method: 'POST', headers: authHeaders() })
    if (r.ok) {
      const updated = await r.json()
      setNotes((prev) => prev.map((n) => n.id === id ? updated : n))
    }
  }, [])

  // Sorted: pinned first, then by updated/created desc
  const sorted = [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    const aTime = a.updated_at ?? a.created_at
    const bTime = b.updated_at ?? b.created_at
    return new Date(bTime) - new Date(aTime)
  })

  const pinned  = sorted.filter((n) => n.pinned)
  const regular = sorted.filter((n) => !n.pinned)

  return {
    notes: sorted,
    pinned,
    regular,
    active,
    activeId,
    setActiveId,
    loading,
    createNote,
    updateNote,
    debouncedUpdate,
    deleteNote,
    togglePin,
    reload: load,
  }
}
