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

// react-helmet-async has issues with StrictMode's double-rendering in development
// but works fine in production where StrictMode doesn't double-render
const AppWithRouter = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

createRoot(document.getElementById('root')!).render(
  import.meta.env.PROD ? (
    <StrictMode>{AppWithRouter}</StrictMode>
  ) : (
    AppWithRouter
  )
)
