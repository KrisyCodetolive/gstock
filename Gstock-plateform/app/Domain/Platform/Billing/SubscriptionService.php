<?php

namespace App\Domain\Platform\Billing;

use App\Domain\Catalog\Models\Product;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Domain\Platform\SubscriptionState;
use App\Domain\Shops\Models\Shop;
use App\Support\ApiException;
use App\Support\Decimal as D;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Abonnement d'un espace (M00) : formule, échéances, utilisation comparée aux
 * limites, factures, paiement par GeniusPay. Un paiement n'est validé que sur une
 * confirmation du serveur de GeniusPay (webhook, ou relecture de son état), jamais
 * sur la redirection du navigateur (ADR-003) : il prolonge l'abonnement d'une période.
 */
final class SubscriptionService
{
    public function __construct(private PlatformGateway $gateway) {}

    public function resource(Tenant $tenant): array
    {
        $subscription = $tenant->subscription()->with('plan')->firstOrFail();
        $state = SubscriptionState::of($subscription);
        $pending = TenantInvoice::query()->where('tenant_id', $tenant->id)->where('status', 'pending')->latest('id')->first();

        return [
            ...$state->summary(),
            'plan' => self::plan($subscription->plan),
            'trial_ends_at' => $subscription->trial_ends_at?->toIso8601String(),
            'ends_at' => $subscription->ends_at?->toIso8601String(),
            'grace_ends_at' => $state->status === 'past_due' ? $state->graceEndsAt?->toIso8601String() : null,
            'usage' => $this->usage($tenant),
            'pending_invoice' => $pending ? self::invoice($pending) : null,
        ];
    }

    /** Utilisation actuelle, comparée aux limites de la formule. */
    public function usage(Tenant $tenant): array
    {
        return $tenant->run(fn () => [
            'shops' => Shop::query()->where('is_active', true)->count(),
            'users' => User::query()->count(),
            'products' => Product::query()->where('is_active', true)->count(),
        ]);
    }

    /** Lance le paiement : facture « en attente » et page GeniusPay. */
    public function checkout(Tenant $tenant, mixed $planId): array
    {
        $plan = Plan::query()->where('is_active', true)->find((int) $planId);
        if (! $plan) {
            throw ApiException::invalid('plan_id', 'Choisissez une formule.');
        }
        // Passer à une formule plus petite : l'utilisation doit tenir dans ses limites.
        $u = $this->usage($tenant);
        $over = array_values(array_filter([
            $u['shops'] > $plan->max_shops ? "{$u['shops']} boutiques ouvertes (cette formule en permet {$plan->max_shops})" : null,
            $u['users'] > $plan->max_users ? "{$u['users']} utilisateurs (cette formule en permet {$plan->max_users})" : null,
            $u['products'] > $plan->max_products ? "{$u['products']} produits (cette formule en permet {$plan->max_products})" : null,
        ]));
        if ($over) {
            $message = 'Vous avez '.implode(', ', $over).'. Réduisez-les avant de choisir cette formule.';
            throw new ApiException(422, $message, ['plan_id' => [$message]]);
        }

        $invoice = DB::transaction(function () use ($tenant, $plan) {
            // Un seul paiement en cours : le précédent, abandonné, est marqué échoué.
            TenantInvoice::query()->where('tenant_id', $tenant->id)->where('status', 'pending')->update(['status' => 'failed']);
            $invoice = TenantInvoice::create([
                'tenant_id' => $tenant->id,
                'tenant_subscription_id' => $tenant->subscription()->value('id'),
                'plan_id' => $plan->id,
                'reference' => 'FA-pending-'.bin2hex(random_bytes(6)),
                'amount' => $plan->price,
                'status' => 'pending',
            ]);
            $invoice->update(['reference' => "FA-{$invoice->id}"]);

            return $invoice;
        });
        $returnUrl = str_replace('{tenant}', $tenant->slug, config('gstock.frontend_url')).config('gstock.subscription_return_path');

        try {
            $session = $this->gateway->checkout($invoice, $returnUrl);
        } catch (\Throwable $e) {
            // GeniusPay n'a rien créé : la facture ne reste pas « en attente ».
            $invoice->update(['status' => 'failed']);
            throw $e;
        }
        if ($session->transactionId) {
            $invoice->update(['geniuspay_transaction_id' => $session->transactionId]);
        }

        return ['invoice' => self::invoice($invoice->fresh('plan')), 'checkout_url' => $session->url];
    }

    /**
     * Webhook GeniusPay de la plateforme, déjà authentifié par sa signature.
     * La facture est retrouvée par ses métadonnées (`metadata.invoice`) ou par la
     * référence GeniusPay. Un succès est confirmé en relisant le paiement chez
     * GeniusPay (statut et montant) avant de prolonger l'abonnement.
     *
     * @param  array{event?: string, environment?: string, data?: array<string, mixed>}  $payload
     */
    public function handleWebhook(array $payload): ?TenantInvoice
    {
        $data = (array) ($payload['data'] ?? []);
        $outcome = GeniusPayWebhook::outcome((string) ($payload['event'] ?? ''));
        $transactionId = filled($data['reference'] ?? null) ? (string) $data['reference'] : null;
        $invoice = $this->findInvoice((string) data_get($data, 'metadata.invoice', ''), $transactionId);
        if (! $invoice || $outcome === null) {
            return $invoice;
        }
        // Un paiement de test ne paie jamais un abonnement réel (et inversement).
        if (isset($payload['environment']) && $payload['environment'] !== GeniusPayPlatformGateway::environment()) {
            Log::warning('GeniusPay : webhook d’un autre environnement ignoré.', ['invoice' => $invoice->reference, 'environment' => $payload['environment']]);

            return $invoice;
        }

        $payment = new GatewayPayment($outcome, $transactionId, GeniusPayPlatformGateway::channel($data['provider'] ?? $data['payment_method'] ?? null), isset($data['amount']) ? (string) $data['amount'] : null);
        if ($outcome === GatewayPayment::PAID && $transactionId) {
            // Confirmation auprès de GeniusPay : le webhook signé ne suffit pas à lui seul.
            $confirmed = $this->gateway->find($transactionId);
            if ($confirmed) {
                $payment = new GatewayPayment($confirmed->outcome, $transactionId, $confirmed->channel ?? $payment->channel, $confirmed->amount ?? $payment->amount);
            }
        }

        return $this->settle($invoice, $payment);
    }

    /**
     * Relit chez GeniusPay le paiement en attente d'un espace (retour de la page de
     * paiement, webhook pas encore arrivé ou injoignable en développement).
     * C'est le serveur qui interroge GeniusPay : la redirection du navigateur ne valide rien.
     */
    public function refreshPending(Tenant $tenant): void
    {
        $invoice = TenantInvoice::query()->where('tenant_id', $tenant->id)->where('status', 'pending')->whereNotNull('geniuspay_transaction_id')->latest('id')->first();
        // L'écran relit l'abonnement toutes les 2 s pendant l'attente : GeniusPay au plus toutes les 5 s.
        if (! $invoice || ! Cache::add("geniuspay:refresh:{$invoice->id}", true, 5)) {
            return;
        }
        try {
            $payment = $this->gateway->find($invoice->geniuspay_transaction_id);
        } catch (\Throwable $e) {
            report($e);

            return;
        }
        if ($payment && $payment->outcome) {
            $this->settle($invoice, $payment);
        }
    }

    /**
     * Applique l'issue d'un paiement à sa facture. Idempotent : une facture déjà
     * traitée n'est pas rejouée. Payé : une période de plus ; échoué : rien ne change.
     */
    public function settle(TenantInvoice $invoice, GatewayPayment $payment): TenantInvoice
    {
        return DB::transaction(function () use ($invoice, $payment) {
            $invoice = TenantInvoice::query()->lockForUpdate()->findOrFail($invoice->id);
            if ($invoice->status !== 'pending' || $payment->outcome === null) {
                // Facture abandonnée (remplacée par un nouveau paiement) mais payée quand même : à rembourser ou à créditer.
                if ($invoice->status === 'failed' && $payment->outcome === GatewayPayment::PAID) {
                    Log::error('GeniusPay : paiement reçu pour une facture abandonnée.', ['invoice' => $invoice->reference, 'transaction' => $payment->transactionId]);
                }

                return $invoice;
            }
            // Montant différent de la facture : on ne prolonge pas, à vérifier par Genius Groups.
            if ($payment->outcome === GatewayPayment::PAID && $payment->amount !== null && D::cmp($payment->amount, (string) $invoice->amount) < 0) {
                Log::error('GeniusPay : montant payé inférieur à la facture.', ['invoice' => $invoice->reference, 'paid' => $payment->amount, 'due' => (string) $invoice->amount]);

                return $invoice;
            }
            $invoice->fill([
                'payment_channel' => $payment->channel ?? $invoice->payment_channel,
                'geniuspay_transaction_id' => $payment->transactionId ?? $invoice->geniuspay_transaction_id,
            ]);
            if ($payment->outcome !== GatewayPayment::PAID) {
                $invoice->update(['status' => 'failed']);

                return $invoice;
            }

            $subscription = $invoice->subscription()->lockForUpdate()->firstOrFail();
            $plan = $invoice->plan;
            // Une période de plus, à partir de la fin en cours (ou d'aujourd'hui si elle est passée).
            $base = collect([CarbonImmutable::now(), $subscription->ends_at?->toImmutable(), $subscription->trial_ends_at?->toImmutable()])->filter()->max();
            $subscription->update([
                'plan_id' => $plan->id,
                'ends_at' => $base->addMonthsNoOverflow($plan->billing_period === 'yearly' ? 12 : 1),
                'status' => 'active',
            ]);
            $invoice->update(['status' => 'paid', 'paid_at' => now()]);
            $invoice->tenant->update(['status' => 'active']);

            return $invoice;
        });
    }

    private function findInvoice(string $reference, ?string $transactionId): ?TenantInvoice
    {
        if ($reference !== '' && $invoice = TenantInvoice::query()->where('reference', $reference)->first()) {
            return $invoice;
        }

        return $transactionId ? TenantInvoice::query()->where('geniuspay_transaction_id', $transactionId)->first() : null;
    }

    public static function plan(Plan $p): array
    {
        return [
            'id' => $p->id,
            'name' => $p->name,
            'description' => $p->description,
            'price' => D::format((string) $p->price, D::MONEY),
            'billing_period' => $p->billing_period,
            'max_shops' => $p->max_shops,
            'max_users' => $p->max_users,
            'max_products' => $p->max_products,
            'trial_days' => $p->trial_days,
            'is_recommended' => (bool) $p->is_recommended,
        ];
    }

    public static function invoice(TenantInvoice $i): array
    {
        return [
            'id' => $i->id,
            'reference' => $i->reference,
            'plan_name' => $i->plan->name,
            'amount' => D::format((string) $i->amount, D::MONEY),
            'status' => $i->status,
            'payment_channel' => $i->payment_channel,
            'created_at' => $i->created_at->toIso8601String(),
            'paid_at' => $i->paid_at?->toIso8601String(),
        ];
    }
}
