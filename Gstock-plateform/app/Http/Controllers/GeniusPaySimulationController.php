<?php

namespace App\Http\Controllers;

use App\Domain\Platform\Billing\SubscriptionService;
use App\Domain\Platform\Models\TenantInvoice;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\View\View;

/**
 * Page de paiement GeniusPay simulée (pilote `simulation`, jamais en production) :
 * le commerçant choisit un moyen, le paiement réussit ou échoue, et le serveur
 * reçoit le même message qu'au webhook de GeniusPay, puis renvoie sur « Mon abonnement ».
 * Liens signés et temporaires : seul celui qui a lancé le paiement peut les suivre.
 */
class GeniusPaySimulationController extends Controller
{
    public const CHANNELS = ['Wave', 'Orange Money', 'MTN Money', 'Moov Money', 'Carte bancaire'];

    public function show(Request $request, TenantInvoice $invoice): View
    {
        $this->guard($request);
        $link = fn (string $outcome, ?string $channel = null) => URL::temporarySignedRoute('geniuspay.simulation.pay', now()->addHour(), [
            'invoice' => $invoice->id, 'outcome' => $outcome, 'channel' => $channel, 'return' => $request->query('return'),
        ], absolute: false);

        return view('geniuspay.simulation', [
            'invoice' => $invoice->load(['plan', 'tenant']),
            'channels' => collect(self::CHANNELS)->map(fn ($c) => ['name' => $c, 'url' => $link('success', $c)]),
            'failUrl' => $link('failed', 'Wave'),
            'cancelUrl' => $link('failed'),
            'returnUrl' => $request->query('return'),
        ]);
    }

    public function pay(Request $request, TenantInvoice $invoice, SubscriptionService $subscriptions): RedirectResponse
    {
        $this->guard($request);
        $subscriptions->applyWebhook([
            'event' => $request->query('outcome') === 'success' ? 'payment.succeeded' : 'payment.failed',
            'data' => ['reference' => $invoice->reference, 'transaction_id' => 'SIM-'.$invoice->id.'-'.now()->getTimestamp(), 'channel' => $request->query('channel')],
        ]);

        return redirect()->away((string) $request->query('return', '/'));
    }

    private function guard(Request $request): void
    {
        abort_if(app()->isProduction() || config('gstock.geniuspay.platform.driver') !== 'simulation', 404);
        abort_unless($request->hasValidSignature(absolute: false), 403, 'Ce lien de paiement a expiré.');
    }
}
