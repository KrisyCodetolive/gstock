<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\ReceiptLinks;
use App\Http\Controllers\Controller;
use App\Http\Resources\CreditsPresenter;
use App\Http\Resources\SalesPresenter;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;

/** Reçu ouvert par le client depuis WhatsApp, sans connexion : protégé par un lien signé et expirant (ADR-013). */
class PublicReceiptController extends Controller
{
    public function show(string $token, ReceiptLinks $links, CreditsPresenter $credits): JsonResponse
    {
        $t = $links->read($token);
        if (! $t) {
            throw new ApiException(404, 'Ce lien de reçu n’est pas valide.');
        }
        if ($t['expired']) {
            throw new ApiException(410, 'Ce lien de reçu a expiré. Demandez un nouveau lien à la boutique.');
        }
        if ($t['kind'] === 'r') {
            $repayment = CreditRepayment::query()->where('shop_id', $t['shop_id'])->find($t['id'])
                ?? throw new ApiException(404, 'Ce lien de reçu n’est pas valide.');

            return response()->json(['data' => ['kind' => 'repayment', ...$credits->receipt($repayment)]]);
        }
        $sale = Sale::query()->where('shop_id', $t['shop_id'])->find($t['id'])
            ?? throw new ApiException(404, 'Ce lien de reçu n’est pas valide.');

        return response()->json(['data' => ['kind' => 'sale', ...SalesPresenter::receipt($sale)]]);
    }
}
