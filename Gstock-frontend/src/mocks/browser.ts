import { setupWorker } from 'msw/browser'
import { seedHistory } from './data/sales-seed'
import { handlers } from './handlers'

export async function startMocks() {
  // Première visite ou remise à zéro : on génère l'historique de démonstration.
  seedHistory()
  const worker = setupWorker(...handlers)
  await worker.start({
    // Les fichiers de l'application (JS, polices, images) passent sans être simulés.
    onUnhandledFrame: 'bypass',
    quiet: true,
  })
}
