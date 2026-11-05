<?php

namespace App\Domain\Stock;

use App\Domain\Catalog\Models\Product;
use App\Domain\Reporting\DashboardService;
use App\Domain\Shops\Models\TenantSetting;
use App\Domain\Stock\Models\StockLot;
use App\Support\Decimal;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Règles de date des arrivages (§7.11) : « périmé » dès le jour de la date,
 * « bientôt périmé » dans le délai d'alerte du produit, sinon celui de l'espace.
 */
final class Expiry
{
    public const DEFAULT_ALERT_DAYS = 7;

    /** Jour courant au fuseau de l'espace, au format Y-m-d. */
    public static function today(): string
    {
        return CarbonImmutable::now(DashboardService::TIMEZONE)->toDateString();
    }

    /** Délai d'alerte de l'espace. */
    public static function tenantAlertDays(): int
    {
        return (int) (TenantSetting::query()->value('expiry_alert_days') ?? self::DEFAULT_ALERT_DAYS);
    }

    public static function alertDays(Product $product, ?int $tenantDays = null): int
    {
        return $product->expiry_alert_days ?? $tenantDays ?? self::tenantAlertDays();
    }

    /** expired, soon, ok ; undated sans date. */
    public static function state(CarbonInterface|string|null $date, int $alertDays, ?string $today = null): string
    {
        if ($date === null) {
            return 'undated';
        }
        $date = $date instanceof CarbonInterface ? $date->toDateString() : substr($date, 0, 10);
        $today ??= self::today();
        if ($date <= $today) {
            return 'expired';
        }

        return $date <= CarbonImmutable::parse($today)->addDays($alertDays)->toDateString() ? 'soon' : 'ok';
    }

    /**
     * Résumé des arrivages en stock d'un article : quantités périmées, bientôt périmées et
     * sans date, plus ancienne date dépassée, prochaine date à venir.
     *
     * @param  iterable<StockLot>  $lots  dans l'ordre de sortie (date la plus proche d'abord)
     */
    public static function summarize(iterable $lots, int $alertDays, ?string $today = null): array
    {
        $today ??= self::today();
        $out = ['expired_quantity' => '0', 'expired_since' => null, 'soon_quantity' => '0', 'next_expiry_date' => null, 'undated_quantity' => '0'];
        foreach ($lots as $lot) {
            $state = self::state($lot->expiry_date, $alertDays, $today);
            $quantity = (string) $lot->quantity;
            if ($state === 'expired') {
                $out['expired_quantity'] = Decimal::add($out['expired_quantity'], $quantity);
                $out['expired_since'] ??= $lot->expiry_date->toDateString();
            } elseif ($state === 'undated') {
                $out['undated_quantity'] = Decimal::add($out['undated_quantity'], $quantity);
            } else {
                if ($state === 'soon') {
                    $out['soon_quantity'] = Decimal::add($out['soon_quantity'], $quantity);
                }
                $out['next_expiry_date'] ??= $lot->expiry_date->toDateString();
            }
        }
        foreach (['expired_quantity', 'soon_quantity', 'undated_quantity'] as $k) {
            $out[$k] = Decimal::format($out[$k]);
        }

        return $out;
    }

    /** Date saisie (Y-m-d) ou null ; false si elle n'est pas valide. */
    public static function parse(mixed $value): string|false|null
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) || ! checkdate((int) substr($value, 5, 2), (int) substr($value, 8, 2), (int) substr($value, 0, 4))) {
            return false;
        }

        return $value;
    }
}
