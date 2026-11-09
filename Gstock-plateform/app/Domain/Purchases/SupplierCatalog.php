<?php

namespace App\Domain\Purchases;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\Unit;
use App\Domain\Purchases\Models\Supplier;
use App\Http\Resources\CatalogPresenter;
use App\Support\Decimal as D;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Produits d'un fournisseur et fournisseurs d'un produit (M11), déduits des approvisionnements
 * reçus (les annulés ne comptent pas) : aucune saisie en plus. Prix d'achat par unité de base
 * = prix de la ligne × quantité ÷ quantité en unité de base (un carton de 12 à 3 000 → 250).
 */
final class SupplierCatalog
{
    /**
     * Une ligne par produit (ou variante) acheté chez ce fournisseur, le plus récent d'abord.
     *
     * @param  list<int>  $shopIds  boutiques visibles
     */
    public function forSupplier(Supplier $supplier, array $shopIds, ?int $stockShopId): array
    {
        $lines = $this->lines($shopIds)->where('p.supplier_id', $supplier->id)->get();
        $groups = $lines->groupBy(fn ($l) => $l->product_id.':'.($l->product_variant_id ?? ''));
        $products = $this->products($lines);
        $units = Unit::query()->whereIn('id', $lines->pluck('unit_id')->filter()->unique())->get()->keyBy('id');
        $stock = $stockShopId === null ? collect() : DB::table('shop_stock')->where('tenant_id', tenant('id'))->where('shop_id', $stockShopId)
            ->whereIn('product_id', $lines->pluck('product_id')->unique())->get()
            ->keyBy(fn ($s) => $s->product_id.':'.($s->product_variant_id ?? ''));

        return $groups->map(function (Collection $g, string $key) use ($products, $units, $stock) {
            $first = $g->first();
            $product = $products[$first->product_id] ?? null;
            $row = $stock[$key] ?? null;
            $alert = $row ? ($row->stock_alert ?? $product?->stock_alert) : null;

            return [
                ...$this->article($product, $first->product_variant_id),
                ...$this->prices($g, $units),
                'purchases' => $g->pluck('purchase_id')->unique()->count(),
                'quantity' => D::format($g->reduce(fn ($s, $l) => D::add($s, (string) $l->base_quantity), '0')),
                'spent' => D::round($g->reduce(fn ($s, $l) => D::add($s, (string) $l->subtotal, D::MONEY), '0.00'), D::MONEY),
                // Stock dans la boutique demandée : null si l'article n'y a jamais eu de stock.
                'stock' => $row ? [
                    'quantity' => D::format((string) $row->quantity),
                    'state' => CatalogPresenter::state((string) $row->quantity, $alert === null ? null : (string) $alert),
                ] : null,
            ];
        })->sortByDesc('last_purchased_at')->values()->all();
    }

    /**
     * Une ligne par fournisseur (et variante) chez qui le produit a été acheté, le moins cher d'abord.
     * Les approvisionnements sans fournisseur forment une ligne « sans fournisseur ».
     *
     * @param  list<int>  $shopIds
     */
    public function forProduct(Product $product, array $shopIds): array
    {
        $lines = $this->lines($shopIds)->where('pi.product_id', $product->id)->get();
        $units = Unit::query()->whereIn('id', $lines->pluck('unit_id')->filter()->unique())->get()->keyBy('id');
        $suppliers = Supplier::query()->whereIn('id', $lines->pluck('supplier_id')->filter()->unique())->get()->keyBy('id');
        $product->loadMissing('variants');

        return $lines->groupBy(fn ($l) => ($l->supplier_id ?? '').':'.($l->product_variant_id ?? ''))
            ->map(function (Collection $g) use ($suppliers, $units, $product) {
                $first = $g->first();
                $supplier = $first->supplier_id ? $suppliers[$first->supplier_id] ?? null : null;
                $variant = $first->product_variant_id ? $product->variants->firstWhere('id', (int) $first->product_variant_id) : null;

                return [
                    'supplier' => $supplier ? ['id' => $supplier->id, 'name' => $supplier->name, 'phone' => $supplier->phone, 'is_active' => $supplier->is_active] : null,
                    'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
                    ...$this->prices($g, $units),
                    'purchases' => $g->pluck('purchase_id')->unique()->count(),
                    'quantity' => D::format($g->reduce(fn ($s, $l) => D::add($s, (string) $l->base_quantity), '0')),
                ];
            })
            ->sortBy([fn ($a, $b) => strcmp((string) ($a['variant']['name'] ?? ''), (string) ($b['variant']['name'] ?? '')), fn ($a, $b) => D::cmp($a['last_cost'], $b['last_cost'])])
            ->values()->all();
    }

    /** Lignes des approvisionnements reçus des boutiques visibles, les plus récentes d'abord. */
    private function lines(array $shopIds)
    {
        return DB::table('purchase_items as pi')->join('purchases as p', 'p.id', '=', 'pi.purchase_id')
            ->where('p.tenant_id', tenant('id'))->whereIn('p.shop_id', $shopIds ?: [0])->where('p.status', 'received')
            ->orderByDesc('p.occurred_at')->orderByDesc('pi.id')
            ->select('pi.product_id', 'pi.product_variant_id', 'pi.unit_id', 'pi.cost', 'pi.quantity', 'pi.base_quantity', 'pi.subtotal', 'p.id as purchase_id', 'p.supplier_id', 'p.occurred_at');
    }

    /**
     * Dernier prix (par unité d'achat et par unité de base), prix précédent, plus bas et plus haut.
     *
     * @param  Collection<int, object>  $lines  les plus récentes d'abord
     */
    private function prices(Collection $lines, Collection $units): array
    {
        $base = fn ($l) => D::cmp((string) $l->base_quantity, '0') > 0
            ? D::div(D::mul((string) $l->cost, (string) $l->quantity, 6), (string) $l->base_quantity, D::MONEY)
            : D::format((string) $l->cost, D::MONEY);
        $costs = $lines->map($base);
        $last = $lines->first();
        $previous = $costs->get(1);

        return [
            'last_purchased_at' => CarbonImmutable::parse($last->occurred_at)->toIso8601String(),
            'last_cost' => $costs->first(),
            // Prix de la ligne, dans l'unité achetée (le carton par exemple).
            'last_unit_cost' => D::format((string) $last->cost, D::MONEY),
            'last_unit' => CatalogPresenter::unitRef($last->unit_id ? $units[$last->unit_id] ?? null : null),
            'previous_cost' => $previous,
            'min_cost' => $costs->reduce(fn ($m, $c) => $m === null || D::cmp($c, $m) < 0 ? $c : $m),
            'max_cost' => $costs->reduce(fn ($m, $c) => $m === null || D::cmp($c, $m) > 0 ? $c : $m),
        ];
    }

    /** @return array<int, Product> */
    private function products(Collection $lines): array
    {
        return Product::query()->with(['unit', 'category', 'variants'])->whereIn('id', $lines->pluck('product_id')->unique())->get()->keyBy('id')->all();
    }

    private function article(?Product $p, mixed $variantId): array
    {
        $variant = $variantId ? $p?->variants->firstWhere('id', (int) $variantId) : null;

        return [
            'product' => [
                'id' => $p?->id,
                'name' => (string) ($p->name ?? ''),
                'unit' => CatalogPresenter::unitRef($p?->unit),
                'category' => $p?->category ? ['id' => $p->category->id, 'name' => $p->category->name, 'color' => $p->category->color] : null,
                'image_url' => $p?->imageUrl(),
                'is_active' => (bool) ($p->is_active ?? false),
            ],
            'variant' => $variant ? ['id' => $variant->id, 'name' => $variant->name] : null,
        ];
    }
}
