// Vitrine des composants (développement uniquement) : on valide le rendu
// « Marché » ici avant de construire les écrans. Textes d'exemple en dur.
import { ArrowRight, Boxes, Search, ShoppingCart } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionCard } from '@/components/ActionCard'
import { Money } from '@/components/Money'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api/client'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

export function ShowcasePage() {
  const { t } = useTranslation()
  return (
    <div className="grid gap-10">
      <PageHeader title={t('showcase.title')} subtitle="design-system/gstock/MASTER.md" />

      <Section title="Boutons">
        <div className="flex flex-wrap gap-3">
          <Button variant="action" size="lg">
            Encaisser <ArrowRight strokeWidth={2.6} />
          </Button>
          <Button>Recevoir un paiement</Button>
          <Button variant="outline">Annuler</Button>
          <Button variant="ghost">Plus tard</Button>
          <Button variant="destructive">Annuler la vente</Button>
          <Button disabled>Indisponible</Button>
        </div>
      </Section>

      <Section title="Champs">
        <div className="grid max-w-md gap-4">
          <div className="grid gap-2">
            <Label htmlFor="demo-search">Chercher un produit</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-muted-foreground" />
              <Input id="demo-search" className="pl-10" placeholder="Riz, huile, savon…" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="demo-amount">Argent reçu</Label>
            <Input id="demo-amount" inputMode="numeric" aria-invalid defaultValue="0" />
            <p className="text-sm font-semibold text-destructive">Saisissez un montant supérieur à 0.</p>
          </div>
        </div>
      </Section>

      <Section title="États et montants">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone="paid">Payé</StatusBadge>
          <StatusBadge tone="warn">Plus que 3</StatusBadge>
          <StatusBadge tone="danger">En retard de 3 jours</StatusBadge>
          <StatusBadge>Brouillon</StatusBadge>
        </div>
        <div className="flex flex-wrap items-end gap-6">
          <Money value="4500.00" />
          <Money value="10350.00" size="md" />
          <Money value="18000.00" size="lg" />
        </div>
      </Section>

      <Section title="Cartes">
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionCard to="/vitrine" icon={ShoppingCart} title="Vendre" description="Enregistrer une vente payée ou à crédit" tint="peach" />
          <ActionCard to="/vitrine" icon={Boxes} title="Mon stock" description="Voir ce qui reste en boutique" tint="mint" />
        </div>
        <div className="pressable-lg grid max-w-sm gap-3 rounded-lg bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold">Awa Koné</span>
            <StatusBadge tone="danger">En retard de 3 jours</StatusBadge>
          </div>
          <div className="grid">
            <span className="text-sm font-semibold text-muted-foreground">Reste à payer</span>
            <Money value="18000.00" size="lg" />
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/5 rounded-full bg-paid" />
          </div>
          <Button>Recevoir un paiement</Button>
        </div>
      </Section>

      <Section title="Chargement, vide, erreur">
        <div className="grid gap-6 lg:grid-cols-3">
          <LoadingState rows={2} />
          <EmptyState title="Aucun crédit en cours" text="Quand un client achète à crédit, il apparaît ici." />
          <ErrorState error={new ApiError(0, {})} onRetry={() => undefined} />
        </div>
      </Section>
    </div>
  )
}
