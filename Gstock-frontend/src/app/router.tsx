import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireAuth } from '@/features/auth/components/RequireAuth'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { HomePage } from '@/features/dashboard/pages/HomePage'
import { AppLayout } from './layout/AppLayout'
import { NAV_ITEMS } from './navigation'
import { ComingSoonPage, NotFoundPage, RouteErrorPage } from './pages/StatusPages'
import { ShowcasePage } from './pages/ShowcasePage'
import { RequirePermission } from './RequirePermission'

// Rubriques pas encore livrées : page « Bientôt disponible », protégée par permission.
// Chaque phase remplace son entrée par la vraie page.
const upcoming: RouteObject[] = NAV_ITEMS.filter((item) => item.phase).map((item) => ({
  path: item.path,
  element: (
    <RequirePermission permissions={item.permissions}>
      <ComingSoonPage item={item} />
    </RequirePermission>
  ),
}))

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
      ...(import.meta.env.DEV ? [{ path: '/vitrine', element: <ShowcasePage /> }] : []),
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
