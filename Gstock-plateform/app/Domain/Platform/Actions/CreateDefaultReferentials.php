<?php

namespace App\Domain\Platform\Actions;

use App\Domain\Catalog\Models\Unit;
use App\Domain\Expenses\Models\ExpenseCategory;
use App\Domain\Sales\Models\PaymentMethod;

/**
 * Référentiels d'un nouvel espace (M00, §7.3, §8.7) : unités courantes,
 * modes de paiement, catégories de dépenses. À appeler dans le contexte de l'espace.
 */
final class CreateDefaultReferentials
{
    public function handle(): void
    {
        $base = [];
        foreach ([['Unité', 'u'], ['Paquet', 'paq'], ['Bouteille', 'btl'], ['Sachet', 'sach'], ['Kilogramme', 'kg'], ['Litre', 'L']] as [$name, $short]) {
            $base[$name] = Unit::create(['name' => $name, 'short_name' => $short]);
        }
        Unit::create(['name' => 'Carton', 'short_name' => 'ctn', 'base_unit_id' => $base['Unité']->id, 'operator' => '*', 'operator_value' => '12']);
        Unit::create(['name' => 'Gramme', 'short_name' => 'g', 'base_unit_id' => $base['Kilogramme']->id, 'operator' => '/', 'operator_value' => '1000']);

        PaymentMethod::create(['name' => 'Espèces', 'type' => 'cash']);
        PaymentMethod::create(['name' => 'Mobile Money', 'type' => 'mobile_money', 'uses_geniuspay' => true]);
        PaymentMethod::create(['name' => 'Carte bancaire', 'type' => 'card', 'uses_geniuspay' => true]);

        foreach (['Transport', 'Électricité', 'Loyer', 'Internet', 'Personnel', 'Autres dépenses'] as $name) {
            ExpenseCategory::create(['name' => $name]);
        }
    }
}
