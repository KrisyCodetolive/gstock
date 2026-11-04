// Endpoints simulés du module M00 : inscription, abonnement, assistant de démarrage,
// et garde « lecture seule » des espaces suspendus.
import { delay, http, HttpResponse } from 'msw'
import type { CheckoutPayload, Onboarding, OnboardingStepId, RegisterPayload, SlugCheck, TokenLoginPayload } from '@/types/subscription'
import { db, newTenantDb, openTenantDb, persist, saveTenantDb } from '../db'
import { API, handle, isOwner, MockHttpError, normalize, paginate, requirePermission, requireUser, Validator } from '../http'
import {
  createInvoice,
  currentTenant,
  invoiceResource,
  isSlugTaken,
  persistPlatform,
  planResource,
  platform,
  PLATFORM_DOMAIN,
  subscriptionResource,
  subscriptionState,
  switchCurrentTenant,
} from '../platform'
import { startSession, toMe } from '../session'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
/** Sous-domaines réservés à la plateforme (site, back-office, API…). */
const RESERVED = ['www', 'admin', 'api', 'app', 'mail', 'support', 'aide', 'help', 'blog', 'static', 'cdn', 'gstock', 'genius', 'demo', 'status']
const DAY = 86_400_000

const normalizePhone = (value: string) => value.replace(/[\s.-]/g, '').replace(/^\+225/, '')

/** « Alimentation Koné & Fils » → « alimentation-kone-fils » */
function slugify(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '')
}

function slugProblem(slug: string): string | null {
  if (slug.length < 3 || slug.length > 30) return "L'adresse doit faire entre 3 et 30 caractères."
  if (!SLUG.test(slug)) return "Utilisez seulement des lettres minuscules sans accent, des chiffres et des tirets."
  if (RESERVED.includes(slug)) return 'Cette adresse est réservée. Choisissez-en une autre.'
  if (isSlugTaken(slug)) return 'Cette adresse est déjà prise par un autre commerce.'
  return null
}

function freeSlugNear(base: string) {
  const root = slugify(base) || 'ma-boutique'
  if (!slugProblem(root)) return root
  for (let n = 2; n < 100; n++) {
    const candidate = `${root.slice(0, 27)}-${n}`
    if (!slugProblem(candidate)) return candidate
  }
  return null
}

const tenantUrl = (slug: string) => `https://${slug}.${PLATFORM_DOMAIN}`

/** Utilisation actuelle, comparée aux limites du plan. */
const usage = () => ({
  shops: db.shops.filter((s) => s.is_active).length,
  users: db.users.length,
  products: db.products.filter((p) => p.is_active).length,
})

// Opérations encore permises à un espace suspendu : se connecter et payer.
const ALLOWED_WHEN_READ_ONLY = [/^\/auth\//, /^\/subscription\/checkout$/, /^\/register/, /^\/onboarding\//]

function onboardingOf(): Onboarding {
  const tenant = currentTenant()
  const firstSale = db.sales.find((s) => s.status === 'completed')
  // Indicateurs suivis par le back-office (M01) : espace activé, première vente.
  if (!tenant.activated_at && db.products.length > 0) tenant.activated_at = new Date().toISOString()
  if (!tenant.first_sale_at && firstSale) tenant.first_sale_at = firstSale.occurred_at
  persistPlatform()

  const done: Record<OnboardingStepId, boolean> = {
    products: db.products.length > 0,
    opening_balances: db.credits.some((c) => c.is_opening_balance && c.status !== 'cancelled'),
    first_sale: Boolean(firstSale),
  }
  const steps = (Object.keys(done) as OnboardingStepId[]).map((id) => ({ id, done: done[id], skipped: !done[id] && db.onboarding.skipped.includes(id) }))
  return {
    steps,
    completed: db.onboarding.dismissed || steps.every((s) => s.done || s.skipped),
    dismissed: db.onboarding.dismissed,
  }
}

function requireOwner() {
  const user = requireUser()
  if (!isOwner(user)) throw new MockHttpError(403, "Vous n'avez pas accès à cette action.")
  return user
}

export const platformHandlers = [
  // Appareil sans réseau (mode avion, coupure) : le serveur est injoignable, comme en vrai.
  http.all(`${API}/*`, () => (navigator.onLine ? undefined : HttpResponse.error())),
  http.all('/sanctum/*', () => (navigator.onLine ? undefined : HttpResponse.error())),

  // Espace suspendu (impayé après le délai de grâce) : consultable, mais aucune opération (M00).
  http.all(`${API}/*`, ({ request }) => {
    if (request.method === 'GET' || request.method === 'HEAD') return
    const path = new URL(request.url).pathname.slice(API.length)
    if (ALLOWED_WHEN_READ_ONLY.some((r) => r.test(path))) return
    if (!subscriptionState(currentTenant().slug).readOnly) return
    return HttpResponse.json(
      { message: "Votre abonnement est suspendu : l'espace est en lecture seule. Réglez l'abonnement pour enregistrer à nouveau des opérations." },
      { status: 402 },
    )
  }),

  // Domaine principal : offres et inscription, sans session.
  http.get(`${API}/plans`, async () => {
    await delay(200)
    return HttpResponse.json({ data: platform.plans.map(planResource) })
  }),

  http.get(`${API}/register/check-slug`, async ({ request }) => {
    await delay(250)
    const slug = (new URL(request.url).searchParams.get('slug') ?? '').trim().toLowerCase()
    const message = slugProblem(slug)
    const result: SlugCheck = { available: message === null, message, suggestion: message ? freeSlugNear(slug) : null }
    return HttpResponse.json({ data: result })
  }),

  http.post(`${API}/register`, ({ request }) =>
    handle(async () => {
      await delay(700)
      const body = (await request.json()) as Partial<RegisterPayload>
      const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
      const slug = text(body.slug).toLowerCase()
      const phone = normalizePhone(text(body.phone))
      const email = text(body.email).toLowerCase()
      const password = typeof body.password === 'string' ? body.password : ''

      const v = new Validator()
      v.required(text(body.tenant_name), 'tenant_name', 'Saisissez le nom de votre commerce.')
      const problem = slug ? slugProblem(slug) : 'Choisissez l’adresse de votre espace.'
      if (problem) v.add('slug', problem)
      v.required(text(body.shop_name), 'shop_name', 'Donnez un nom à votre boutique.')
      v.required(text(body.shop_city), 'shop_city', 'Indiquez la ville de la boutique.')
      v.required(text(body.firstname), 'firstname', 'Saisissez votre prénom.')
      v.required(text(body.lastname), 'lastname', 'Saisissez votre nom.')
      v.check(/^0\d{9}$/.test(phone), 'phone', 'Saisissez un numéro à 10 chiffres, par exemple 07 00 00 00 00.')
      v.check(EMAIL.test(email), 'email', 'Saisissez une adresse e-mail valide.')
      v.check(password.length >= 8, 'password', 'Le mot de passe doit faire au moins 8 caractères.')
      const plan = platform.plans.find((p) => p.id === Number(body.plan_id))
      v.check(Boolean(plan), 'plan_id', 'Choisissez une formule.')
      v.done()

      const now = new Date()
      const name = text(body.tenant_name)
      platform.tenants.push({ slug, name, owner_email: email, phone, closed: false, created_at: now.toISOString(), activated_at: null, first_sale_at: null })
      platform.subscriptions.push({
        tenant_slug: slug,
        plan_id: plan!.id,
        starts_at: now.toISOString(),
        trial_ends_at: new Date(now.getTime() + plan!.trial_days * DAY).toISOString(),
        ends_at: null,
      })
      saveTenantDb(
        slug,
        newTenantDb({
          name,
          phone,
          email,
          shop: { name: text(body.shop_name), city: text(body.shop_city) },
          owner: { firstname: text(body.firstname), lastname: text(body.lastname), email, phone, password },
        }),
      )
      // Lien de connexion à usage unique vers le sous-domaine du nouvel espace.
      const token = crypto.randomUUID()
      platform.loginTokens.push({ token, tenant_slug: slug, user_id: 1, expires_at: new Date(now.getTime() + 10 * 60_000).toISOString(), used: false })
      persistPlatform()

      // Sur le serveur : https://<slug>.gstock.app/connexion/lien?jeton=… ; ici, la même application.
      return HttpResponse.json({ data: { tenant: { name, slug, url: tenantUrl(slug) }, login_url: `/connexion/lien?jeton=${token}` } }, { status: 201 })
    }),
  ),

  http.post(`${API}/auth/token-login`, ({ request }) =>
    handle(async () => {
      await delay(400)
      const { token = '' } = (await request.json()) as Partial<TokenLoginPayload>
      const entry = platform.loginTokens.find((t) => t.token === token)
      if (!entry || entry.used || Date.parse(entry.expires_at) < Date.now()) {
        throw new MockHttpError(422, 'Ce lien de connexion a expiré ou a déjà servi. Connectez-vous avec votre e-mail et votre mot de passe.')
      }
      entry.used = true
      // Le lien ouvre le sous-domaine de l'espace : on bascule sur sa base.
      switchCurrentTenant(entry.tenant_slug)
      openTenantDb(entry.tenant_slug)
      const user = db.users.find((u) => u.id === entry.user_id)
      if (!user) throw new MockHttpError(422, 'Compte introuvable.')
      user.last_login_at = new Date().toISOString()
      persist()
      startSession(user.id)
      return HttpResponse.json({ data: toMe(user) })
    }),
  ),

  http.get(`${API}/subscription`, () =>
    handle(async () => {
      await delay(300)
      requirePermission('subscription.manage')
      return HttpResponse.json({ data: subscriptionResource(currentTenant().slug, usage()) })
    }),
  ),

  http.get(`${API}/subscription/invoices`, ({ request }) =>
    handle(async () => {
      await delay(250)
      requirePermission('subscription.manage')
      const slug = currentTenant().slug
      const rows = platform.invoices
        .filter((i) => i.tenant_slug === slug)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(invoiceResource)
      return paginate(request, rows)
    }),
  ),

  // Lance le paiement sur GeniusPay (clés de la plateforme, ADR-003). L'abonnement
  // n'est prolongé qu'au webhook, jamais sur le retour du navigateur.
  http.post(`${API}/subscription/checkout`, ({ request }) =>
    handle(async () => {
      await delay(500)
      requirePermission('subscription.manage')
      const { plan_id } = (await request.json()) as Partial<CheckoutPayload>
      const plan = platform.plans.find((p) => p.id === Number(plan_id))
      const v = new Validator()
      v.check(Boolean(plan), 'plan_id', 'Choisissez une formule.')
      v.done()
      // Passer à une formule plus petite : l'utilisation doit tenir dans ses limites.
      const u = usage()
      const over = [
        u.shops > plan!.max_shops && `${u.shops} boutiques ouvertes (cette formule en permet ${plan!.max_shops})`,
        u.users > plan!.max_users && `${u.users} utilisateurs (cette formule en permet ${plan!.max_users})`,
        u.products > plan!.max_products && `${u.products} produits (cette formule en permet ${plan!.max_products})`,
      ].filter(Boolean)
      if (over.length) {
        const message = `Vous avez ${over.join(', ')}. Réduisez-les avant de choisir cette formule.`
        throw new MockHttpError(422, message, { plan_id: [message] })
      }
      const invoice = createInvoice(currentTenant().slug, plan!.id)
      return HttpResponse.json({ data: { invoice: invoiceResource(invoice), checkout_url: `/simulation/geniuspay/${invoice.id}` } }, { status: 201 })
    }),
  ),

  http.get(`${API}/onboarding`, () =>
    handle(async () => {
      await delay(250)
      requireOwner()
      return HttpResponse.json({ data: onboardingOf() })
    }),
  ),

  http.post(`${API}/onboarding/steps/:step/skip`, ({ params }) =>
    handle(async () => {
      await delay(200)
      requireOwner()
      const step = String(params.step)
      if (!['products', 'opening_balances', 'first_sale'].includes(step)) throw new MockHttpError(404, "Cette étape n'existe pas.")
      if (!db.onboarding.skipped.includes(step)) db.onboarding.skipped.push(step)
      persist()
      return HttpResponse.json({ data: onboardingOf() })
    }),
  ),

  http.post(`${API}/onboarding/dismiss`, () =>
    handle(async () => {
      await delay(200)
      requireOwner()
      db.onboarding.dismissed = true
      persist()
      return HttpResponse.json({ data: onboardingOf() })
    }),
  ),
]
