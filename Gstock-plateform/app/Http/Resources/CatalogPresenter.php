<?php

namespace App\Http\Resources;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Catalog\Models\Unit;
use App\Domain\Stock\Expiry;
use App\Domain\Stock\Models\ShopStock;
use App\Domain\Stock\Models\StockLot;
use App\Support\Decimal;
use Illuminate\Support\Collection;

/**
 * Formes JSON du catalogue et du stock, identiques à `Gstock-frontend/src/types/catalog.ts`.
 * Les niveaux de stock d'une boutique sont chargés en une requête pour toute la page.
 */
final class CatalogPresenter
{
    /** @var array<string, ShopStock> clé « produit|variante » */
    private array $stock = [];

    /** @var Collection<int, Unit> */
    private Collection $units;

    /** @var array<string, list<StockLot>> arrivages en stock des produits suivis, clé « produit|variante » */
    private array $lots = [];

    private ?int $tenantDays = null;

    /** @param  iterable<Product>  $products */
    public function __construct(iterable $products = [], private ?int $shopId = null)
    {
        $this->units = Unit::query()->orderBy('id')->get();
        $ids = collect($products)->pluck('id')->all();
        if ($shopId !== null && $ids) {
            ShopStock::query()->where('shop_id', $shopId)->whereIn('product_id', $ids)->get()
                ->each(fn (ShopStock $s) => $this->stock[$s->product_id.'|'.($s->product_variant_id ?? 0)] = $s);
            $tracked = collect($products)->filter(fn (Product $p) => $p->track_expiry)->pluck('id')->all();
            if ($tracked) {
                StockLot::query()->where('shop_id', $shopId)->whereIn('product_id', $tracked)->where('quantity', '>', 0)
                    ->orderByRaw('expiry_date ASC NULLS LAST')->get()
                    ->each(function (StockLot $l) {
                        $this->lots[$l->product_id.'|'.($l->product_variant_id ?? 0)][] = $l;
                    });
            }
        }
    }

    /**
     * Péremption d'un article dans la boutique (§7.11) : quantités périmées et bientôt
     * périmées, plus ancienne date dépassée, prochaine date. Null si le produit n'est pas suivi.
     */
    public function expiry(Product $p, ?int $variantId): ?array
    {
        if ($this->shopId === null || ! $p->track_expiry) {
            return null;
        }
        $days = Expiry::alertDays($p, $this->tenantDays ??= Expiry::tenantAlertDays());

        return Expiry::summarize($this->lots[$p->id.'|'.($variantId ?? 0)] ?? [], $days);
    }

    /** Ressource /products */
    public function product(Product $p): array
    {
        $unit = $this->units->firstWhere('id', $p->unit_id);

        return [
            'id' => $p->id,
            'type' => $p->type,
            'name' => $p->name,
            'code' => $p->code,
            'barcode' => $p->barcode,
            'category' => $p->category ? ['id' => $p->category->id, 'name' => $p->category->name, 'color' => $p->category->color] : null,
            'brand' => $p->brand ? ['id' => $p->brand->id, 'name' => $p->brand->name] : null,
            'unit' => self::unitRef($unit),
            'purchase_unit' => $this->purchaseUnit($p),
            'units' => $this->unitFamily($p->unit_id),
            'cost' => Decimal::format($p->cost === null ? null : (string) $p->cost, 2),
            'price' => Decimal::format((string) $p->price, 2),
            'tax_rate' => Decimal::format($p->tax_rate === null ? null : (string) $p->tax_rate, 2),
            'stock_alert' => Decimal::format($p->stock_alert === null ? null : (string) $p->stock_alert),
            'image_url' => $p->imageUrl(),
            'is_active' => $p->is_active,
            'track_expiry' => $p->track_expiry,
            'expiry_alert_days' => $p->expiry_alert_days,
            'stock' => $this->level($p),
            'variants' => $p->variants->map(fn (ProductVariant $v) => [
                'id' => $v->id, 'name' => $v->name, 'code' => $v->code, 'barcode' => $v->barcode,
                'cost' => Decimal::format($v->cost === null ? null : (string) $v->cost, 2),
                'price' => Decimal::format((string) $v->price, 2), 'is_active' => $v->is_active,
            ])->values()->all(),
        ];
    }

    /**
     * Articles d'un produit pour les sélecteurs et la caisse : le produit, ou une entrée
     * par variante active (« Produit — Variante », prix et stock de la variante).
     */
    public function articles(Product $p): array
    {
        $r = $this->product($p);
        $base = [
            'id' => $p->id, 'type' => $p->type, 'code' => $p->code, 'unit' => $r['unit'],
            'purchase_unit_id' => $p->purchase_unit_id, 'units' => $r['units'],
            'category' => $r['category'], 'image_url' => $r['image_url'], 'track_expiry' => $p->track_expiry,
        ];
        if ($p->type !== 'variable') {
            return [[...$base, 'variant_id' => null, 'variant_name' => null, 'name' => $p->name, 'barcode' => $p->barcode,
                'price' => $r['price'], 'cost' => $r['cost'], 'quantity' => $r['stock']['quantity'] ?? null, 'state' => $r['stock']['state'] ?? null,
                'expiry' => $this->expiry($p, null)]];
        }

        return $p->variants->where('is_active', true)->map(function (ProductVariant $v) use ($p, $base) {
            $level = $this->articleLevel($p, $v->id);

            return [...$base, 'variant_id' => $v->id, 'variant_name' => $v->name, 'name' => $p->articleName($v->id),
                'code' => $v->code, 'barcode' => $v->barcode, 'price' => Decimal::format((string) $v->price, 2),
                'cost' => Decimal::format($v->cost === null ? null : (string) $v->cost, 2),
                'quantity' => $level['quantity'] ?? null, 'state' => $level['state'] ?? null, 'expiry' => $this->expiry($p, $v->id)];
        })->values()->all();
    }

    /** Stock d'un article : quantité, seuil (surcharge de la boutique, sinon celui du produit), état. */
    public function articleLevel(Product $p, ?int $variantId): ?array
    {
        if ($this->shopId === null || ! $p->isStockable()) {
            return null;
        }
        $row = $this->stock[$p->id.'|'.($variantId ?? 0)] ?? null;
        $quantity = (string) ($row?->quantity ?? '0');
        $alert = $row?->stock_alert ?? $p->stock_alert;

        return [
            'quantity' => Decimal::format($quantity),
            'stock_alert' => Decimal::format($alert === null ? null : (string) $alert),
            'state' => self::state($quantity, $alert === null ? null : (string) $alert),
        ];
    }

    /** Produit à variantes : le total, en « faible » dès qu'une variante en vente l'est. */
    public function level(Product $p): ?array
    {
        if ($p->type !== 'variable') {
            return $this->articleLevel($p, null);
        }
        if ($this->shopId === null) {
            return null;
        }
        $total = '0';
        $low = false;
        foreach ($p->variants as $v) {
            $l = $this->articleLevel($p, $v->id);
            $total = Decimal::add($total, $l['quantity']);
            $low = $low || ($v->is_active && $l['state'] !== 'ok');
        }

        return [
            'quantity' => Decimal::format($total),
            'stock_alert' => Decimal::format($p->stock_alert === null ? null : (string) $p->stock_alert),
            'state' => Decimal::cmp($total, '0') <= 0 ? 'out' : ($low ? 'low' : 'ok'),
        ];
    }

    public static function state(string $quantity, ?string $alert): string
    {
        if (Decimal::cmp($quantity, '0') <= 0) {
            return 'out';
        }

        return $alert !== null && Decimal::cmp($quantity, $alert) <= 0 ? 'low' : 'ok';
    }

    public static function unitRef(?Unit $unit): ?array
    {
        return $unit ? ['id' => $unit->id, 'name' => $unit->name, 'short_name' => $unit->short_name] : null;
    }

    private function unitOption(Unit $unit): array
    {
        return [...self::unitRef($unit), 'factor' => Decimal::format($unit->factor())];
    }

    /** Unité de base puis unités dérivées actives : celles proposées à l'approvisionnement. */
    private function unitFamily(int $baseId): array
    {
        $base = $this->units->firstWhere('id', $baseId);
        $derived = $this->units->where('base_unit_id', $baseId)->where('is_active', true);

        return collect([$base])->filter()->concat($derived)->map(fn (Unit $u) => $this->unitOption($u))->values()->all();
    }

    private function purchaseUnit(Product $p): ?array
    {
        $unit = $p->purchase_unit_id ? $this->units->first(fn (Unit $u) => $u->id === $p->purchase_unit_id && $u->base_unit_id === $p->unit_id) : null;

        return $unit ? $this->unitOption($unit) : null;
    }
}
