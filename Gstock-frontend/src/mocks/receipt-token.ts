// Liens de reçu signés et expirants (ADR-013) : jeton opaque, valable 7 jours.
// `kind` : « s » pour une vente, « r » pour un remboursement.
const SECRET = 'gstock-demo'

function hash(s: string) {
  let h = 0
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0
  return (h >>> 0).toString(36)
}

export function signReceiptToken(kind: 's' | 'r', shopId: number, id: number) {
  const exp = Date.now() + 7 * 86_400_000
  const payload = `${kind}.${shopId}.${id}.${exp}`
  return { token: btoa(`${payload}.${hash(payload + SECRET)}`).replace(/=+$/, ''), exp }
}

export function readReceiptToken(token: string) {
  try {
    const [kind, shopId, id, exp, sig] = atob(token).split('.')
    if ((kind !== 's' && kind !== 'r') || hash(`${kind}.${shopId}.${id}.${exp}` + SECRET) !== sig) return null
    return { kind: kind as 's' | 'r', shopId: Number(shopId), id: Number(id), exp: Number(exp) }
  } catch {
    return null
  }
}
