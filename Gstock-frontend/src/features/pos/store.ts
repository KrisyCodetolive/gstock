// Panier de la caisse, gardé par boutique sur l'appareil : il survit à un
// rechargement, et les paniers mis en attente se reprennent plus tard (M08).
// Il ne contient que des quantités et des choix ; les montants viennent du serveur.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Id } from '@/types/api'
import type { DiscountMethod } from '@/types/sales'

export interface CartLine {
  productId: Id
  quantity: number
  /** Prix modifié (sales.edit_price), sinon celui du produit. */
  price?: string
  discount?: string
  discountMethod?: DiscountMethod
}

export interface CartCustomer {
  id: Id
  name: string
  phone: string | null
  balance: string
}

export interface Cart {
  lines: CartLine[]
  customer: CartCustomer | null
  /** Remise sur le total (montant). */
  discount?: string
}

export interface HeldCart extends Cart {
  id: string
  heldAt: string
}

const EMPTY: Cart = { lines: [], customer: null }

interface PosState {
  carts: Record<string, Cart>
  held: Record<string, HeldCart[]>
  add: (shopId: Id, productId: Id) => void
  setQuantity: (shopId: Id, productId: Id, quantity: number) => void
  updateLine: (shopId: Id, productId: Id, changes: Partial<CartLine>) => void
  remove: (shopId: Id, productId: Id) => void
  setCustomer: (shopId: Id, customer: CartCustomer | null) => void
  setDiscount: (shopId: Id, discount: string | undefined) => void
  clear: (shopId: Id) => void
  hold: (shopId: Id) => void
  resume: (shopId: Id, heldId: string) => void
  drop: (shopId: Id, heldId: string) => void
}

const key = (shopId: Id) => String(shopId)

export const usePosStore = create<PosState>()(
  persist(
    (set) => {
      const patch = (shopId: Id, fn: (cart: Cart) => Cart) =>
        set((s) => ({ carts: { ...s.carts, [key(shopId)]: fn(s.carts[key(shopId)] ?? EMPTY) } }))

      return {
        carts: {},
        held: {},
        add: (shopId, productId) =>
          patch(shopId, (c) => {
            const existing = c.lines.find((l) => l.productId === productId)
            return existing
              ? { ...c, lines: c.lines.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l)) }
              : { ...c, lines: [...c.lines, { productId, quantity: 1 }] }
          }),
        setQuantity: (shopId, productId, quantity) =>
          patch(shopId, (c) => ({
            ...c,
            lines: quantity <= 0 ? c.lines.filter((l) => l.productId !== productId) : c.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
          })),
        updateLine: (shopId, productId, changes) =>
          patch(shopId, (c) => ({ ...c, lines: c.lines.map((l) => (l.productId === productId ? { ...l, ...changes } : l)) })),
        remove: (shopId, productId) => patch(shopId, (c) => ({ ...c, lines: c.lines.filter((l) => l.productId !== productId) })),
        setCustomer: (shopId, customer) => patch(shopId, (c) => ({ ...c, customer })),
        setDiscount: (shopId, discount) => patch(shopId, (c) => ({ ...c, discount })),
        clear: (shopId) => patch(shopId, () => EMPTY),
        hold: (shopId) =>
          set((s) => {
            const cart = s.carts[key(shopId)]
            if (!cart || cart.lines.length === 0) return s
            const held: HeldCart = { ...cart, id: crypto.randomUUID(), heldAt: new Date().toISOString() }
            return {
              carts: { ...s.carts, [key(shopId)]: EMPTY },
              held: { ...s.held, [key(shopId)]: [held, ...(s.held[key(shopId)] ?? [])] },
            }
          }),
        resume: (shopId, heldId) =>
          set((s) => {
            const list = s.held[key(shopId)] ?? []
            const target = list.find((h) => h.id === heldId)
            if (!target) return s
            const current = s.carts[key(shopId)]
            // Le panier en cours, s'il n'est pas vide, passe en attente à son tour.
            const rest = list.filter((h) => h.id !== heldId)
            const parked = current && current.lines.length ? [{ ...current, id: crypto.randomUUID(), heldAt: new Date().toISOString() }] : []
            const { id: _id, heldAt: _at, ...cart } = target
            return { carts: { ...s.carts, [key(shopId)]: cart }, held: { ...s.held, [key(shopId)]: [...parked, ...rest] } }
          }),
        drop: (shopId, heldId) => set((s) => ({ held: { ...s.held, [key(shopId)]: (s.held[key(shopId)] ?? []).filter((h) => h.id !== heldId) } })),
      }
    },
    { name: 'gstock.pos' },
  ),
)

/** Panier de la boutique (vide si aucun). */
export function useCart(shopId: Id | undefined): Cart {
  return usePosStore((s) => (shopId === undefined ? EMPTY : (s.carts[key(shopId)] ?? EMPTY)))
}

export function useHeldCarts(shopId: Id | undefined): HeldCart[] {
  return usePosStore((s) => (shopId === undefined ? NO_HELD : (s.held[key(shopId)] ?? NO_HELD)))
}

const NO_HELD: HeldCart[] = []
