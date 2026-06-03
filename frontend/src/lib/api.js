// In dev: Vite proxy forwards /api → backend (API_ORIGIN is empty, proxy handles it)
// In prod Tauri build: must use absolute backend URL (Vite proxy doesn't exist)
export const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? ''

export function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token')
  const headers = {
    ...(options.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  return fetch(`${API_ORIGIN}${path}`, { ...options, headers })
}
