// Lecture des codes-barres par la caméra (M06, M08). Pas de React ici.
// Le détecteur natif du navigateur est utilisé s'il existe (Chrome Android) ;
// sinon, un détecteur WebAssembly est chargé à la demande (iPhone, Firefox).

/** Formats des produits du quotidien (§F03.6 de l'ancien GStock) et QR codes. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] as const

export interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}

interface NativeDetectorClass {
  new (options: { formats: string[] }): Detector
  getSupportedFormats(): Promise<string[]>
}

/** La caméra est-elle utilisable ici ? (adresse sécurisée et navigateur récent) */
export function cameraAvailable(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext
}

let detector: Promise<Detector> | undefined

export function getBarcodeDetector(): Promise<Detector> {
  detector ??= (async () => {
    const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
    if (Native) {
      const supported = await Native.getSupportedFormats().catch(() => [] as string[])
      const formats = BARCODE_FORMATS.filter((f) => supported.includes(f))
      if (formats.includes('ean_13')) return new Native({ formats })
    }
    const { createFallbackDetector } = await import('./barcode-fallback')
    return createFallbackDetector([...BARCODE_FORMATS])
  })()
  // Un échec (réseau pendant le premier chargement) ne doit pas être gardé.
  detector.catch(() => (detector = undefined))
  return detector
}
