import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_ORIGIN } from '../lib/api'

const API_BASE = `${API_ORIGIN}/api/v1/conversations`

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Fetch conversations on mount ───────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController()

    const fetchConversations = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(API_BASE, {
          headers: authHeaders(),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const mapped = (data.items || []).map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.created_at,
        }))
        setConversations(mapped)
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err?.message ?? 'Unknown error')
        setConversations([])
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
    return () => controller.abort()
  }, [])

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const createConversation = useCallback(async (title) => {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ title }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const item = await res.json()
    const conv = { id: item.id, title: item.title, createdAt: item.created_at }
    setConversations((prev) => [conv, ...prev])
    return conv
  }, [])

  const renameConversation = useCallback(async (id, newTitle) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, title: newTitle } : conv))
    )
    try {
      await fetch(`${API_BASE}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ title: newTitle }),
      })
    } catch {
      // non-fatal — optimistic update stays
    }
  }, [])

  const deleteConversation = useCallback(async (id) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id))
    setActiveId((prev) => (prev === id ? null : prev))
    try {
      await fetch(`${API_BASE}/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      })
    } catch {
      // non-fatal
    }
  }, [])

  const selectConversation = useCallback((id) => {
    setActiveId(id)
  }, [])

  // ── Load messages for a conversation ──────────────────────────────────────

  const loadMessages = useCallback(async (conversationId) => {
    try {
      const res = await fetch(`${API_BASE}/${conversationId}/messages?limit=200`, {
        headers: authHeaders(),
      })
      if (!res.ok) return []
      const data = await res.json()
      return (data.items || []).map((m) => ({
        id: m.id,
        role: m.role,
        type: m.type || 'text',
        text: m.content,
        createdAt: m.created_at,
      }))
    } catch {
      return []
    }
  }, [])

  // ── Grouping ───────────────────────────────────────────────────────────────

  const groupedConversations = useMemo(() => {
    const MS_PER_DAY = 86_400_000
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday - MS_PER_DAY)
    const startOfWeek = new Date(startOfToday - 6 * MS_PER_DAY)

    const groups = { today: [], yesterday: [], week: [], older: [] }

    conversations.forEach((conv) => {
      const d = new Date(conv.createdAt)
      if (d >= startOfToday)          groups.today.push(conv)
      else if (d >= startOfYesterday) groups.yesterday.push(conv)
      else if (d >= startOfWeek)      groups.week.push(conv)
      else                            groups.older.push(conv)
    })

    return groups
  }, [conversations])

  return {
    conversations,
    groupedConversations,
    activeId,
    loading,
    error,
    createConversation,
    renameConversation,
    deleteConversation,
    selectConversation,
    loadMessages,
  }
}
