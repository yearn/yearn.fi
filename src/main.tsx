import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import '../style.css'
import { disableServiceWorkerDev } from './utils/disableServiceWorkerDev'

// In dev, proactively disable any existing ServiceWorkers that could intercept cross-origin requests
if (import.meta.env.DEV) {
  void disableServiceWorkerDev()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
)
