import { useState, useEffect, useCallback, useMemo } from 'react'

const API_BASE = '/api/v1/conversations'

export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch conversations on mount
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true)
        setError(null)
        const token = localStorage.getItem('token')
        const res = await fetch(API_BASE, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }

        const data = await res.json()
        const mapped = (data.items || []).map((item) => ({
          id: item.id,
          title: item.title,
          createdAt: item.created_at,
        }))
        setConversations(mapped)
      } catch (err) {
        setError(err.message)
        setConversations([])
      } finally {
        setLoading(false)
      }
    }

    fetchConversations()
  }, [])

  const createConversation = useCallback((title) => {
    const newConversation = {
      id: crypto.randomUUID(),
      title,
      createdAt: new Date().toISOString(),
    }
    setConversations((prev) => [...prev, newConversation])
    return newConversation
  }, [])

  const renameConversation = useCallback((id, newTitle) => {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, title: newTitle } : conv))
    )
  }, [])

  const deleteConversation = useCallback((id) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id))
    if (activeId === id) {
      setActiveId(null)
    }
  }, [activeId])

  const selectConversation = useCallback((id) => {
    setActiveId(id)
  }, [])

  const groupedConversations = useMemo(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfYesterday = new Date(startOfToday - 86400000)
    const startOfWeek = new Date(startOfToday - 6 * 86400000)

    const groups = {
      today: [],
      yesterday: [],
      week: [],
      older: [],
    }

    conversations.forEach((conv) => {
      const convDate = new Date(conv.createdAt)
      if (convDate >= startOfToday) {
        groups.today.push(conv)
      } else if (convDate >= startOfYesterday) {
        groups.yesterday.push(conv)
      } else if (convDate >= startOfWeek) {
        groups.week.push(conv)
      } else {
        groups.older.push(conv)
      }
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
  }
}
