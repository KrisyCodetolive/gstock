import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth, SplashScreen } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RequireWritable } from '@/features/onboarding/components/SubscriptionBanner'
import { HomePage } from '@/features/dashboard/pages/HomePage'
import { ANY_SETTINGS_PERMISSION, settingsSection } from '@/features/settings/sections'
import { lazy, Suspense, type ReactNode } from 'react'
import type { Permission } from '@/types/auth'
import { AppLayout } from './layout/AppLayout'
import { NAV_ITEMS } from './navigation'
import { ComingSoonPage, NotFoundPage, RouteErrorPage } from './pages/StatusPages'
import { RequirePermission } from './RequirePermission'


// Pages chargées à la demande : chaque rubrique est un fichier séparé.
const ShopFormPage = lazy(() => import('@/features/shops/pages/ShopFormPage').then((m) => ({ default: m.ShopFormPage })))
const ShopsListPage = lazy(() => import('@/features/shops/pages/ShopsListPage').then((m) => ({ default: m.ShopsListPage })))
const RoleFormPage = lazy(() => import('@/features/roles/pages/RoleFormPage').then((m) => ({ default: m.RoleFormPage })))
const RolesListPage = lazy(() => import('@/features/roles/pages/RolesListPage').then((m) => ({ default: m.RolesListPage })))
const UserFormPage = lazy(() => import('@/features/users/pages/UserFormPage').then((m) => ({ default: m.UserFormPage })))
const UsersListPage = lazy(() => import('@/features/users/pages/UsersListPage').then((m) => ({ default: m.UsersListPage })))
const CategoriesPage = lazy(() => import('@/features/referentials/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })))
const PaymentMethodsPage = lazy(() => import('@/features/referentials/pages/PaymentMethodsPage').then((m) => ({ default: m.PaymentMethodsPage })))
const BrandsPage = lazy(() => import('@/features/referentials/pages/SimpleReferentialPages').then((m) => ({ default: m.BrandsPage })))
const ExpenseCategoriesPage = lazy(() => import('@/features/referentials/pages/SimpleReferentialPages').then((m) => ({ default: m.ExpenseCategoriesPage })))
const UnitsPage = lazy(() => import('@/features/referentials/pages/UnitsPage').then((m) => ({ default: m.UnitsPage })))
const ProductFormPage = lazy(() => import('@/features/products/pages/ProductFormPage').then((m) => ({ default: m.ProductFormPage })))
const ProductsListPage = lazy(() => import('@/features/products/pages/ProductsListPage').then((m) => ({ default: m.ProductsListPage })))
const AdjustmentDetailPage = lazy(() => import('@/features/stock/pages/AdjustmentDetailPage').then((m) => ({ default: m.AdjustmentDetailPage })))
const AdjustmentFormPage = lazy(() => import('@/features/stock/pages/AdjustmentFormPage').then((m) => ({ default: m.AdjustmentFormPage })))
const MovementsPage = lazy(() => import('@/features/stock/pages/MovementsPage').then((m) => ({ default: m.MovementsPage })))
const StockPage = lazy(() => import('@/features/stock/pages/StockPage').then((m) => ({ default: m.StockPage })))
const PaymentSettingsPage = lazy(() => import('@/features/settings/pages/PaymentSettingsPage').then((m) => ({ default: m.PaymentSettingsPage })))
const SettingsHubPage = lazy(() => import('@/features/settings/pages/SettingsHubPage').then((m) => ({ default: m.SettingsHubPage })))
const TenantSettingsPage = lazy(() => import('@/features/settings/pages/TenantSettingsPage').then((m) => ({ default: m.TenantSettingsPage })))
const CustomersListPage = lazy(() => import('@/features/customers/pages/CustomersListPage').then((m) => ({ default: m.CustomersListPage })))
const CustomerPage = lazy(() => import('@/features/customers/pages/CustomerPage').then((m) => ({ default: m.CustomerPage })))
const PosPage = lazy(() => import('@/features/pos/pages/PosPage').then((m) => ({ default: m.PosPage })))
const SalesHistoryPage = lazy(() => import('@/features/sales/pages/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })))
const SaleDetailPage = lazy(() => import('@/features/sales/pages/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })))
const ReceiptPage = lazy(() => import('@/features/sales/pages/ReceiptPage').then((m) => ({ default: m.ReceiptPage })))
const PublicReceiptPage = lazy(() => import('@/features/sales/pages/PublicReceiptPage').then((m) => ({ default: m.PublicReceiptPage })))
const CreditsPage = lazy(() => import('@/features/credits/pages/CreditsPage').then((m) => ({ default: m.CreditsPage })))
const CustomerCreditsPage = lazy(() => import('@/features/credits/pages/CustomerCreditsPage').then((m) => ({ default: m.CustomerCreditsPage })))
const RepaymentFormPage = lazy(() => import('@/features/credits/pages/RepaymentFormPage').then((m) => ({ default: m.RepaymentFormPage })))
const RepaymentPage = lazy(() => import('@/features/credits/pages/RepaymentPage').then((m) => ({ default: m.RepaymentPage })))
const PurchasesListPage = lazy(() => import('@/features/purchases/pages/PurchasesListPage').then((m) => ({ default: m.PurchasesListPage })))
const PurchaseFormPage = lazy(() => import('@/features/purchases/pages/PurchaseFormPage').then((m) => ({ default: m.PurchaseFormPage })))
const PurchaseDetailPage = lazy(() => import('@/features/purchases/pages/PurchaseDetailPage').then((m) => ({ default: m.PurchaseDetailPage })))
const SuppliersListPage = lazy(() => import('@/features/purchases/pages/SuppliersListPage').then((m) => ({ default: m.SuppliersListPage })))
const SupplierPage = lazy(() => import('@/features/purchases/pages/SupplierPage').then((m) => ({ default: m.SupplierPage })))
const ExpensesPage = lazy(() => import('@/features/purchases/pages/ExpensesPage').then((m) => ({ default: m.ExpensesPage })))
const RegisterPage = lazy(() => import('@/features/onboarding/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const TokenLoginPage = lazy(() => import('@/features/onboarding/pages/TokenLoginPage').then((m) => ({ default: m.TokenLoginPage })))
const OnboardingPage = lazy(() => import('@/features/onboarding/pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const SubscriptionPage = lazy(() => import('@/features/onboarding/pages/SubscriptionPage').then((m) => ({ default: m.SubscriptionPage })))
// Page de paiement GeniusPay simulée : seulement avec les données simulées.
const GeniusPaySimulatorPage =
  import.meta.env.VITE_USE_MOCKS === 'true'
    ? lazy(() => import('@/mocks/components/GeniusPaySimulatorPage').then((m) => ({ default: m.GeniusPaySimulatorPage })))
    : null
const AuditPage = lazy(() => import('@/features/dashboard/pages/AuditPage').then((m) => ({ default: m.AuditPage })))

const ShowcasePage = lazy(() => import('./pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage })))

const guarded = (path: string, permissions: readonly Permission[], element: ReactNode): RouteObject => ({
  path,
  element: <RequirePermission permissions={permissions}>{element}</RequirePermission>,
})

/** Route d'une rubrique des paramètres, protégée par ses permissions. */
const section = (id: string, element: ReactNode, subpath = ''): RouteObject => {
  const s = settingsSection(id)
  return guarded(s.path + subpath, s.permissions, element)
}

// Rubriques pas encore livrées : page « Bientôt disponible », protégée par permission.
// Chaque phase remplace son entrée par la vraie page.
const upcoming: RouteObject[] = NAV_ITEMS.filter((item) => item.phase).map((item) =>
  guarded(item.path, item.permissions ?? [], <ComingSoonPage item={item} />),
)

const catalog: RouteObject[] = [
  guarded('/produits', ['products.view'], <ProductsListPage />),
  guarded('/produits/nouveau', ['products.create'], <ProductFormPage />),
  guarded('/produits/:id', ['products.view'], <ProductFormPage />),
  guarded('/stock', ['stock.view'], <StockPage />),
  guarded('/stock/entree', ['stock.entry'], <AdjustmentFormPage key="entry" kind="entry" />),
  guarded('/stock/sortie', ['stock.exit'], <AdjustmentFormPage key="exit" kind="exit" />),
  guarded('/stock/inventaire', ['stock.adjust'], <AdjustmentFormPage key="inventory" kind="inventory" />),
  guarded('/stock/mouvements', ['stock.view'], <MovementsPage />),
  guarded('/stock/operations/:id', ['stock.view'], <AdjustmentDetailPage />),
  guarded('/clients', ['customers.view'], <CustomersListPage />),
  guarded('/clients/nouveau', ['customers.create'], <CustomerPage />),
  guarded('/clients/:id', ['customers.view'], <CustomerPage />),
  guarded('/ventes', ['sales.view'], <SalesHistoryPage />),
  guarded('/ventes/:id', ['sales.view', 'sales.create'], <SaleDetailPage />),
  guarded('/ventes/:id/recu', ['sales.view', 'sales.create'], <ReceiptPage />),
  guarded('/credits', ['credits.view'], <CreditsPage />),
  guarded('/credits/clients/:id', ['credits.view'], <CustomerCreditsPage />),
  guarded('/credits/clients/:id/paiement', ['repayments.create'], <RepaymentFormPage />),
  guarded('/credits/paiements/:id', ['credits.view', 'repayments.create'], <RepaymentPage />),
  guarded('/approvisionnements', ['purchases.view'], <PurchasesListPage />),
  guarded('/approvisionnements/nouveau', ['purchases.create'], <PurchaseFormPage />),
  guarded('/approvisionnements/:id', ['purchases.view'], <PurchaseDetailPage />),
  guarded('/fournisseurs', ['suppliers.view'], <SuppliersListPage />),
  guarded('/fournisseurs/nouveau', ['suppliers.manage'], <SupplierPage />),
  guarded('/fournisseurs/:id', ['suppliers.view'], <SupplierPage />),
  guarded('/depenses', ['expenses.view'], <ExpensesPage />),
  guarded('/journal', ['audit.view'], <AuditPage />),
  // Assistant de démarrage : réservé au propriétaire (le serveur refuse les autres).
  guarded('/demarrage', ['subscription.manage'], <OnboardingPage />),
]

const settings: RouteObject[] = [
  guarded('/parametres', ANY_SETTINGS_PERMISSION, <SettingsHubPage />),
  section('tenant', <TenantSettingsPage />),
  section('subscription', <SubscriptionPage />),
  section('payment', <PaymentSettingsPage />),
  section('shops', <ShopsListPage />),
  section('shops', <ShopFormPage />, '/nouvelle'),
  section('shops', <ShopFormPage />, '/:id'),
  section('roles', <RolesListPage />),
  section('roles', <RoleFormPage />, '/nouveau'),
  section('roles', <RoleFormPage />, '/:id'),
  section('users', <UsersListPage />),
  section('users', <UserFormPage />, '/nouveau'),
  section('users', <UserFormPage />, '/:id'),
  section('categories', <CategoriesPage />),
  section('units', <UnitsPage />),
  section('payment-methods', <PaymentMethodsPage />),
  section('expense-categories', <ExpenseCategoriesPage />),
  section('brands', <BrandsPage />),
]

export const router = createBrowserRouter([
  { path: '/connexion', element: <LoginPage />, errorElement: <RouteErrorPage /> },
  // Domaine principal : inscription d'un nouveau commerçant (M00).
  { path: '/inscription', element: <Suspense fallback={<SplashScreen />}><RegisterPage /></Suspense>, errorElement: <RouteErrorPage /> },
  // Lien de connexion à usage unique, reçu à l'inscription.
  { path: '/connexion/lien', element: <Suspense fallback={<SplashScreen />}><TokenLoginPage /></Suspense>, errorElement: <RouteErrorPage /> },
  ...(GeniusPaySimulatorPage
    ? [{ path: '/simulation/geniuspay/:invoiceId', element: <Suspense fallback={<SplashScreen />}><GeniusPaySimulatorPage /></Suspense>, errorElement: <RouteErrorPage /> }]
    : []),
  // Reçu partagé par WhatsApp : public, protégé par un lien signé et expirant (ADR-013).
  {
    path: '/recu/:token',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <PublicReceiptPage />
      </Suspense>
    ),
    errorElement: <RouteErrorPage />,
  },
  // Caisse plein écran, hors de la mise en page habituelle (M08).
  {
    path: '/vendre',
    element: (
      <RequireAuth>
        <RequirePermission permissions={['sales.create']}>
          <RequireWritable>
            <Suspense fallback={<SplashScreen />}>
              <PosPage />
            </Suspense>
          </RequireWritable>
        </RequirePermission>
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      ...upcoming,
      ...catalog,
      ...settings,
      ...(import.meta.env.DEV ? [{ path: '/vitrine', element: <ShowcasePage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
