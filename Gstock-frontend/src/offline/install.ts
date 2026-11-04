// Installation de l'application sur l'écran d'accueil (PWA) : le navigateur propose
// l'installation ; on garde sa proposition pour l'offrir dans le menu du compte.
import { create } from 'zustand'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export const useInstallStore = create<{ prompt: InstallPromptEvent | null }>(() => ({ prompt: null }))

export function startInstallWatch() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    useInstallStore.setState({ prompt: event as InstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstallStore.setState({ prompt: null }))
}

/** Ouvre la proposition d'installation ; vrai si la personne accepte. */
export async function promptInstall() {
  const event = useInstallStore.getState().prompt
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  useInstallStore.setState({ prompt: null })
  return outcome === 'accepted'
}
