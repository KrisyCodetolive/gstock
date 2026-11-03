import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export async function startMocks() {
  const worker = setupWorker(...handlers)
  await worker.start({
    // Les fichiers de l'application (JS, polices, images) passent sans être simulés.
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
