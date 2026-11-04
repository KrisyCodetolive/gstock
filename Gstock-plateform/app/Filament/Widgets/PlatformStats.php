<?php

namespace App\Filament\Widgets;

use App\Domain\Platform\Admin\PlatformMetrics;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Tableau de bord de la plateforme (M01) : indicateurs lus dans les données réelles. */
class PlatformStats extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected function getStats(): array
    {
        $m = PlatformMetrics::overview();
        $pct = fn (?int $v) => $v === null ? '—' : "{$v} %";

        return [
            Stat::make('Espaces inscrits', $m['tenants'])->description("{$m['tenants_30']} sur les 30 derniers jours"),
            Stat::make('Espaces activés', $m['activated'])->description('Au moins un produit'),
            Stat::make('Avec une première vente', $m['first_sale']),
            Stat::make('Utilisateurs actifs', "{$m['active_users_7']} à 7 j")->description("{$m['active_users_30']} à 30 jours"),
            Stat::make('Ventes à 30 jours', number_format($m['sales_30'], 0, ',', "\u{202F}"))->description('Toutes les boutiques'),
            Stat::make('Crédits et remboursements', "{$m['credits']} / {$m['repayments']}")->description('Crédits clients / paiements reçus'),
            Stat::make('Conversion essai → payant', $pct($m['conversion']))->description($m['paying'] > 1 ? "{$m['paying']} espaces ont déjà payé" : "{$m['paying']} espace a déjà payé"),
            Stat::make('Churn', $pct($m['churn']))->description('Payants dont l’abonnement a expiré'),
            Stat::make('Revenus du mois', PlatformMetrics::fcfa($m['revenue_month']))->description('Factures payées ce mois-ci'),
        ];
    }
}
