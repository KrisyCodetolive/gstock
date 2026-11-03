import './index.css'
import '@/lib/i18n'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'

async function start() {
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
