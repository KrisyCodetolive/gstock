import { useState } from 'react'

/**
 * Suit le chargement d'une photo : `ok` devient faux si le fichier est introuvable,
 * pour afficher le repli (initiale, teinte de catégorie…) au lieu d'une image cassée.
 */
export function useImageOk(url: string | null | undefined) {
  const [failed, setFailed] = useState<string | null>(null)
  return {
    ok: !!url && failed !== url,
    onError: () => setFailed(url ?? null),
  }
}
