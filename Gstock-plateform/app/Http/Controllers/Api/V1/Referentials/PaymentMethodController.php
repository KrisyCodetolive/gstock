<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Domain\Sales\Models\PaymentMethod;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

class PaymentMethodController extends ReferentialController
{
    protected function model(): string
    {
        return PaymentMethod::class;
    }

    protected function nameMessage(): string
    {
        return 'Donnez un nom au mode de paiement.';
    }

    protected function fields(Request $request, ?Model $current): array
    {
        $type = (string) $request->input('type');
        if (! in_array($type, PaymentMethod::TYPES, true)) {
            $this->fail(['type' => 'Choisissez le type de paiement.']);
        }
        // GeniusPay ne concerne que le Mobile Money et la carte (ADR-003).
        $online = in_array($type, ['mobile_money', 'card'], true);

        return ['type' => $type, 'uses_geniuspay' => $online && $request->boolean('uses_geniuspay')];
    }
}
