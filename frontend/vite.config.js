import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_'])
  const apiKey = env.VITE_API_KEY || ''

  return {
    plugins: [react(), tailwindcss()],

    // Tauri expects a fixed port and no host remapping
    server: {
      port: 5001,
      strictPort: true,
      // Ignore macOS AppleDouble files (._*) — they trigger spurious HMR reloads in
      // the Tauri webview when chokidar picks up metadata writes from the OS.
      watch: {
        ignored: ['**/.DS_Store', '**/._*'],
      },
      // Proxy /api to backend in both browser and Tauri dev mode.
      // Tauri webview loads from http://localhost:5001 in dev, so the proxy is required.
      //
      // VITE_BACKEND_URL controls the target:
      //   (default) http://127.0.0.1:8001  — local uvicorn, needed for Argo so the
      //                                       backend can spawn the claude CLI on the host
      //   http://127.0.0.1:8007            — Docker backend (no claude CLI access)
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://127.0.0.1:8001',
          changeOrigin: true,
          configure: (proxy) => {
            // Inject the API key into every proxied request so all desktop
            // endpoints work without per-component auth headers.
            proxy.on('proxyReq', (proxyReq) => {
              if (apiKey) proxyReq.setHeader('X-API-Key', apiKey)
            })
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                proxyRes.headers['x-accel-buffering'] = 'no'
                proxyRes.headers['cache-control'] = 'no-cache'
              }
            })
          },
        },
      },
    },

    // Prevent Vite from clearing the terminal so Tauri logs are visible
    clearScreen: false,

    envPrefix: ['VITE_', 'TAURI_ENV_'],
  }
})
