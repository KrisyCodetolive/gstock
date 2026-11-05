// Comptes de test de l'espace de démonstration, créés par les seeders du backend
// (`php artisan migrate:fresh --seed`, `DemoTenantSeeder`). Affichés en développement seulement.
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '@/components/StatusBadge'
import type { LoginForm } from '../schemas'

const PASSWORD = 'demo1234'

const ACCOUNTS = [
  { name: 'Aminata Koné', email: 'aminata@demo.gstock.app', role: 'Propriétaire', shops: 'Cocody, Yopougon' },
  { name: 'Ibrahim Traoré', email: 'ibrahim@demo.gstock.app', role: 'Gérant', shops: 'Cocody, Yopougon' },
  { name: 'Fatou Bamba', email: 'fatou@demo.gstock.app', role: 'Vendeur', shops: 'Cocody' },
  { name: "Koffi N'Guessan", email: 'koffi@demo.gstock.app', role: 'Caissier', shops: 'Yopougon' },
  { name: 'Moussa Diallo', email: 'moussa@demo.gstock.app', role: 'Gestionnaire de stock', shops: 'Cocody, Yopougon' },
  { name: 'Paul Yao', email: 'paul@demo.gstock.app', role: 'Vendeur', shops: 'Cocody', inactive: true },
]

const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)

export function DemoAccounts({ onPick, disabled }: { onPick: (account: LoginForm) => void; disabled?: boolean }) {
  const { t } = useTranslation()
  return (
    <section className="grid gap-3" aria-labelledby="demo-title">
      <div className="grid gap-0.5">
        <h2 id="demo-title" className="text-lg font-bold">
          {t('auth.demo_title')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('auth.demo_text', { password: PASSWORD })}</p>
      </div>
      <ul className="grid gap-2.5">
        {ACCOUNTS.map((a) => (
          <li key={a.email}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick({ login: a.email, password: PASSWORD })}
              className="pressable flex min-h-16 w-full items-center gap-3 rounded-md bg-card px-3 py-2 text-left disabled:opacity-60"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground" aria-hidden="true">
                {initials(a.name)}
              </span>
              <span className="grid min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold">
                  {a.name}
                  {a.inactive && <StatusBadge tone="danger">{t('auth.demo_inactive')}</StatusBadge>}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {a.role} · {a.shops}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
