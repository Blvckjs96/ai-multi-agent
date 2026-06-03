import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@xterm/xterm/css/xterm.css'
import App from './App.jsx'

const _nativeFetch = window.fetch
window.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (typeof url === 'string' && url.startsWith('/api') && import.meta.env.VITE_API_KEY) {
    const headers = new Headers(init.headers || {})
    if (!headers.has('X-API-Key')) headers.set('X-API-Key', import.meta.env.VITE_API_KEY)
    init = { ...init, headers }
  }
  return _nativeFetch(input, init)
}

document.documentElement.classList.add('dark')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
