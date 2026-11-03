import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { HomePage } from '@/features/dashboard/pages/HomePage'
import { ShopFormPage } from '@/features/shops/pages/ShopFormPage'
import { ShopsListPage } from '@/features/shops/pages/ShopsListPage'
import { RoleFormPage } from '@/features/roles/pages/RoleFormPage'
import { RolesListPage } from '@/features/roles/pages/RolesListPage'
import { UserFormPage } from '@/features/users/pages/UserFormPage'
import { UsersListPage } from '@/features/users/pages/UsersListPage'
import { CategoriesPage } from '@/features/referentials/pages/CategoriesPage'
import { PaymentMethodsPage } from '@/features/referentials/pages/PaymentMethodsPage'
import { BrandsPage, ExpenseCategoriesPage } from '@/features/referentials/pages/SimpleReferentialPages'
import { UnitsPage } from '@/features/referentials/pages/UnitsPage'
import { ProductFormPage } from '@/features/products/pages/ProductFormPage'
import { ProductsListPage } from '@/features/products/pages/ProductsListPage'
import { PaymentSettingsPage } from '@/features/settings/pages/PaymentSettingsPage'
import { SettingsHubPage } from '@/features/settings/pages/SettingsHubPage'
import { TenantSettingsPage } from '@/features/settings/pages/TenantSettingsPage'
import { ANY_SETTINGS_PERMISSION, settingsSection } from '@/features/settings/sections'
import type { ReactNode } from 'react'
import type { Permission } from '@/types/auth'
import { AppLayout } from './layout/AppLayout'
import { NAV_ITEMS } from './navigation'
import { ComingSoonPage, NotFoundPage, RouteErrorPage } from './pages/StatusPages'
import { ShowcasePage } from './pages/ShowcasePage'
import { RequirePermission } from './RequirePermission'

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
]

const settings: RouteObject[] = [
  guarded('/parametres', ANY_SETTINGS_PERMISSION, <SettingsHubPage />),
  section('tenant', <TenantSettingsPage />),
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
