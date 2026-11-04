// Détecteur WebAssembly (zxing), chargé seulement si le navigateur n'en a pas.
// Le fichier .wasm est servi par l'application elle-même (et mis en cache pour
// le hors ligne), jamais par un CDN.
import { BarcodeDetector, setZXingModuleOverrides, type BarcodeFormat } from 'barcode-detector/ponyfill'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'
import type { Detector } from './barcode'

setZXingModuleOverrides({
  locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path),
})

export function createFallbackDetector(formats: BarcodeFormat[]): Detector {
  return new BarcodeDetector({ formats })
}
