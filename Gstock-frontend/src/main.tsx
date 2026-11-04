import './index.css'
import '@/lib/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'

async function start() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  } else if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // Application installable et utilisable sans réseau (ADR-005).
    void navigator.serviceWorker.register('/sw.js')
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
