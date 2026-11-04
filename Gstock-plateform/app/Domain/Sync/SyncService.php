<?php

namespace App\Domain\Sync;

use App\Domain\Credits\Models\CreditRepayment;
use App\Domain\Credits\RepaymentService;
use App\Domain\Expenses\ExpenseService;
use App\Domain\Expenses\Models\Expense;
use App\Domain\Identity\Models\User;
use App\Domain\Sales\Models\PaymentMethod;
use App\Domain\Sales\Models\Sale;
use App\Domain\Sales\SaleService;
use App\Domain\Shops\Models\Shop;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Support\ApiException;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Model;

/**
 * Synchronisation des opérations faites sans réseau (ADR-005, P2) : ventes,
 * paiements de crédit en espèces, dépenses. Chaque opération est traitée seule,
 * dans l'ordre d'envoi :
 * - déjà reçue (même `offline_uuid`) : renvoyée telle quelle, jamais enregistrée deux fois ;
 * - enregistrée avec la référence définitive du serveur ;
 * - enregistrée mais « à vérifier » si un écart est apparu (stock, prix) : jamais perdue ;
 * - refusée si elle ne peut pas être enregistrée (droit retiré, client désactivé…) :
 *   l'appareil la garde et affiche le message.
 */
final class SyncService
{
    public const TYPES = ['sale' => 'sales.create', 'repayment' => 'repayments.create', 'expense' => 'expenses.create'];

    public const MAX_OPERATIONS = 200;

    public function __construct(private SaleService $sales, private RepaymentService $repayments, private ExpenseService $expenses) {}

    /** @return list<array{offline_uuid: string, type: string, status: string, resource: ?array, message: ?string, reasons: list<string>}> */
    public function process(Shop $shop, User $user, array $operations): array
    {
        if (count($operations) > self::MAX_OPERATIONS) {
            throw ApiException::invalid('operations', sprintf('Envoyez au plus %d opérations à la fois.', self::MAX_OPERATIONS));
        }

        return array_map(fn ($op) => $this->one($shop, $user, is_array($op) ? $op : []), array_values($operations));
    }

    private function one(Shop $shop, User $user, array $op): array
    {
        $type = (string) ($op['type'] ?? '');
        $uuid = (string) ($op['offline_uuid'] ?? '');
        $result = fn (string $status, ?Model $m = null, ?string $message = null, array $reasons = []) => [
            'offline_uuid' => $uuid, 'type' => $type, 'status' => $status,
            'resource' => $m ? ['id' => $m->getKey(), 'reference' => $m->reference] : null,
            'message' => $message, 'reasons' => $reasons,
        ];

        if (! isset(self::TYPES[$type]) || ! preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
            return $result('rejected', message: 'Opération illisible : elle ne peut pas être enregistrée.');
        }
        // Déjà reçue : on renvoie l'opération enregistrée, sans rien refaire.
        $model = ['sale' => Sale::class, 'repayment' => CreditRepayment::class, 'expense' => Expense::class][$type];
        if ($existing = $model::query()->where('offline_uuid', $uuid)->first()) {
            return $result('duplicate', $existing);
        }
        if (! $user->hasAnyPermission(self::TYPES[$type])) {
            return $result('rejected', message: "Vous n'avez plus le droit d'enregistrer cette opération.");
        }

        $payload = (array) ($op['payload'] ?? []);
        // Heure de l'appareil ; une horloge en avance est ramenée à l'heure de réception.
        $at = $this->deviceTime($op['occurred_at'] ?? null);
        try {
            if ($type === 'sale') {
                if ($this->usesGeniusPay(array_column((array) ($payload['payments'] ?? []), 'payment_method_id'))) {
                    return $result('rejected', message: 'Hors ligne, les paiements GeniusPay ne sont pas possibles : encaissez en espèces.');
                }
                $sale = $this->sales->record($shop, $user, [...$payload, 'offline_uuid' => $uuid, 'occurred_at' => $at->toIso8601String()], offline: true);
                $reasons = (array) ($sale->review_reasons ?? []);

                return $result($reasons ? 'to_review' : 'created', $sale, reasons: array_values($reasons));
            }
            if ($type === 'repayment') {
                // Pas de paiement GeniusPay hors ligne (ADR-005) : espèces seulement.
                if (! PaymentMethod::query()->whereKey((int) ($payload['payment_method_id'] ?? 0))->where('type', 'cash')->exists()) {
                    return $result('rejected', message: 'Hors ligne, seuls les paiements en espèces sont acceptés.');
                }
                $repayment = $this->repayments->record($shop, $user, [...$payload, 'offline_uuid' => $uuid, 'received_at' => $at->toIso8601String()]);

                return $result('created', $repayment);
            }
            $expense = $this->expenses->record($shop, $user, [...$payload, 'offline_uuid' => $uuid, 'occurred_at' => $at->toIso8601String()]);

            return $result('created', $expense);
        } catch (ApiException $e) {
            $first = collect($e->errors)->flatten()->first();

            return $result('rejected', message: is_string($first) ? $first : $e->getMessage());
        }
    }

    private function deviceTime(mixed $value): CarbonImmutable
    {
        $now = CarbonImmutable::now();
        try {
            $at = filled($value) ? CarbonImmutable::parse((string) $value) : $now;
        } catch (\Throwable) {
            return $now;
        }

        return $at->greaterThan($now) ? $now : $at;
    }

    private function usesGeniusPay(array $methodIds): bool
    {
        $ids = array_filter(array_map('intval', $methodIds));

        return $ids && TenantPaymentSetting::query()->value('is_active')
            && PaymentMethod::query()->whereIn('id', $ids)->where('uses_geniuspay', true)->exists();
    }
}
