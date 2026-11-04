// Préparation d'une photo avant envoi : on la réduit sur l'appareil pour
// économiser les données mobiles et l'espace de stockage.

/** Types acceptés, comme le serveur (validation stricte des fichiers, §12.1). */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** Taille maximale du fichier choisi, avant réduction. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

export class ImageError extends Error {}

/**
 * Réduit une image à `maxSize` pixels sur son plus grand côté et la convertit en JPEG.
 * Lève ImageError (message en français) si le fichier n'est pas une image acceptée.
 */
export async function prepareImage(file: File, maxSize = 512): Promise<File> {
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ImageError('Choisissez une photo au format JPEG, PNG ou WebP.')
  }
  if (file.size > IMAGE_MAX_BYTES) throw new ImageError('Cette photo est trop lourde (10 Mo au maximum).')

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageError('Cette photo ne peut pas être lue. Essayez-en une autre.')
  }
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new ImageError('Cette photo ne peut pas être lue. Essayez-en une autre.')
  // Fond blanc : une image PNG transparente ne devient pas noire en JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new ImageError('Cette photo ne peut pas être lue. Essayez-en une autre.')
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' })
}
