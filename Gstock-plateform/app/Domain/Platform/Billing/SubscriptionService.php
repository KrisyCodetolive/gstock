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
use Illuminate\Support\Facades\DB;

/**
 * Abonnement d'un espace (M00) : formule, échéances, utilisation comparée aux
 * limites, factures, paiement par GeniusPay. Un paiement n'est validé qu'au
 * webhook (ADR-003) : il prolonge l'abonnement d'une période ; un échec ne change rien.
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

        return ['invoice' => self::invoice($invoice), 'checkout_url' => $this->gateway->checkoutUrl($invoice, $returnUrl)];
    }

    /**
     * Webhook GeniusPay de la plateforme, déjà authentifié par sa signature.
     * Idempotent : une facture déjà traitée n'est pas rejouée.
     *
     * @param  array{event?: string, data?: array{reference?: string, transaction_id?: string, channel?: string}}  $payload
     */
    public function applyWebhook(array $payload): ?TenantInvoice
    {
        $data = $payload['data'] ?? [];

        return DB::transaction(function () use ($payload, $data) {
            $invoice = TenantInvoice::query()->where('reference', (string) ($data['reference'] ?? ''))->lockForUpdate()->first();
            if (! $invoice || $invoice->status !== 'pending') {
                return $invoice;
            }
            $invoice->fill([
                'payment_channel' => $data['channel'] ?? null,
                'geniuspay_transaction_id' => $data['transaction_id'] ?? null,
            ]);
            if (($payload['event'] ?? '') !== 'payment.succeeded') {
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
