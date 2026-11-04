<?php

namespace App\Domain\Platform;

use App\Domain\Catalog\Models\Product;
use App\Domain\Credits\Models\CustomerCredit;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Sales\Models\Sale;
use App\Support\ApiException;

/**
 * Assistant de démarrage du propriétaire (M00) : ajouter ses premiers produits,
 * saisir les dettes existantes, faire une première vente. Une étape se coche
 * d'elle-même quand c'est fait ; elle peut être passée, l'assistant fermé.
 * Tient aussi les indicateurs suivis par le back-office (espace activé, première vente).
 */
final class OnboardingService
{
    public const STEPS = ['products', 'opening_balances', 'first_sale'];

    public function state(Tenant $tenant): array
    {
        $firstSale = Sale::query()->where('status', 'completed')->min('occurred_at');
        $done = [
            'products' => Product::query()->exists(),
            'opening_balances' => CustomerCredit::query()->where('is_opening_balance', true)->where('status', '!=', 'cancelled')->exists(),
            'first_sale' => $firstSale !== null,
        ];
        $changes = array_filter([
            'activated_at' => ! $tenant->activated_at && $done['products'] ? now() : null,
            'first_sale_at' => ! $tenant->first_sale_at && $firstSale ? $firstSale : null,
        ]);
        if ($changes) {
            $tenant->update($changes);
        }

        $saved = (array) ($tenant->onboarding ?? []);
        $skipped = (array) ($saved['skipped'] ?? []);
        $dismissed = (bool) ($saved['dismissed'] ?? false);
        $steps = array_map(fn ($id) => ['id' => $id, 'done' => $done[$id], 'skipped' => ! $done[$id] && in_array($id, $skipped, true)], self::STEPS);

        return [
            'steps' => $steps,
            'completed' => $dismissed || collect($steps)->every(fn ($s) => $s['done'] || $s['skipped']),
            'dismissed' => $dismissed,
        ];
    }

    public function skip(Tenant $tenant, string $step): array
    {
        if (! in_array($step, self::STEPS, true)) {
            throw new ApiException(404, "Cette étape n'existe pas.");
        }
        $saved = (array) ($tenant->onboarding ?? []);
        $saved['skipped'] = array_values(array_unique([...(array) ($saved['skipped'] ?? []), $step]));
        $tenant->update(['onboarding' => $saved]);

        return $this->state($tenant);
    }

    public function dismiss(Tenant $tenant): array
    {
        $tenant->update(['onboarding' => [...(array) ($tenant->onboarding ?? []), 'dismissed' => true]]);

        return $this->state($tenant);
    }
}
