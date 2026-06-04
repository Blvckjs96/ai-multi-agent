import { useEffect, useState } from 'react'
import { API_ORIGIN } from '../lib/api'

function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function useAnalytics(workspaceId, period = 7) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ period: String(period) })
    if (workspaceId) params.set('workspace_id', workspaceId)

    fetch(`${API_ORIGIN}/api/v1/analytics/usage?${params}`, { headers: authHeaders() })
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [workspaceId, period])

  return { data, loading }
}
