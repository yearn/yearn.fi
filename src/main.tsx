import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import '../style.css'
import { disableServiceWorkerDev } from './utils/disableServiceWorkerDev'

// In dev, proactively disable any existing ServiceWorkers that could intercept cross-origin requests
if (import.meta.env.DEV) {
  void disableServiceWorkerDev()
}

// Handle stale chunk errors during deployments
// When a new deployment happens, chunk hashes change and old chunks return 404 or HTML instead of JS
// This catches those errors and reloads the page to get fresh chunks
window.addEventListener('vite:preloadError', (event) => {
  const RELOAD_KEY = 'vite-preload-error-reload-attempt'
  const MAX_RETRIES = 1
  const RETRY_WINDOW_MS = 10000 // Reset counter after 10 seconds

  const now = Date.now()
  const stored = sessionStorage.getItem(RELOAD_KEY)
  const data = stored ? JSON.parse(stored) : { count: 0, timestamp: now }

  // Reset counter if enough time has passed
  if (now - data.timestamp > RETRY_WINDOW_MS) {
    data.count = 0
    data.timestamp = now
  }

  if (data.count < MAX_RETRIES) {
    console.warn('Vite preload error detected, reloading page...', event)
    data.count++
    sessionStorage.setItem(RELOAD_KEY, JSON.stringify(data))
    window.location.reload()
  } else {
    console.error('Vite preload error: Max reload attempts reached. Please manually refresh the page.', event)
    sessionStorage.removeItem(RELOAD_KEY)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
