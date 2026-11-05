<?php

namespace App\Domain\Catalog;

use App\Domain\Catalog\Models\Category;
use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Domain\Catalog\Models\Unit;
use App\Domain\Identity\Models\User;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Shops\Models\Shop;
use App\Domain\Stock\Expiry;
use App\Domain\Stock\StockChange;
use App\Domain\Stock\StockLedger;
use App\Domain\Stock\StockLots;
use App\Support\ApiException;
use App\Support\Decimal;
use App\Support\DocumentSequence;
use Illuminate\Support\Facades\DB;

/**
 * Catalogue (M06) : création et modification des produits et de leurs variantes,
 * avec les règles du serveur simulé (`Gstock-frontend/src/mocks/handlers/products.ts`).
 */
final class ProductService
{
    public function __construct(private StockLedger $ledger, private StockLots $lots) {}

    /** @return array{0: Product, 1: ?int} le produit et la boutique de la quantité initiale */
    public function create(array $input, User $user): array
    {
        $data = $this->validate($input);
        $max = CurrentTenant::plan()->max_products;
        if (Product::query()->where('is_active', true)->count() >= $max) {
            throw new ApiException(422, "Votre abonnement permet {$max} produits au maximum.", [
                'name' => ["Votre abonnement permet {$max} produits au maximum. Désactivez des produits que vous ne vendez plus ou passez à une formule supérieure."],
            ]);
        }

        // Quantité initiale : demande l'accès à la boutique et le droit d'ajouter du stock.
        $shop = null;
        $variantStock = array_filter($data['variants'], fn ($v) => $v['initial'] !== null && Decimal::cmp($v['initial'], '0') > 0);
        if (($data['initial'] !== null && Decimal::cmp($data['initial'], '0') > 0) || $variantStock) {
            $shop = Shop::query()->find((int) ($input['shop_id'] ?? 0));
            if (! $shop || ! $user->canAccessShop($shop)) {
                throw ApiException::forbidden("Vous n'avez pas accès à cette boutique.");
            }
            if (! $user->hasAnyPermission('stock.entry')) {
                throw ApiException::forbidden("Vous n'avez pas le droit d'ajouter du stock.");
            }
        }

        $product = DB::transaction(function () use ($data, $shop, $user) {
            $code = $data['fields']['code'] ?? sprintf('P-%04d', DocumentSequence::next('P'));
            $product = Product::create([...$data['fields'], 'code' => $code]);
            $ids = $this->saveVariants($product, $data['variants']);
            $this->ledger->ensureRows($product->load('variants'));
            if ($shop) {
                // Stock initial du produit, ou de chacune de ses variantes (une entrée par variante).
                $changes = $product->type === 'variable'
                    ? array_values(array_filter(array_map(fn ($v, $i) => $v['initial'] !== null && Decimal::cmp($v['initial'], '0') > 0
                        ? new StockChange($shop->id, $product, $ids[$i], $v['initial'], expiryDate: $product->track_expiry ? $v['initial_expiry'] : null)
                        : null, $data['variants'], array_keys($data['variants']))))
                    : [new StockChange($shop->id, $product, null, $data['initial'], expiryDate: $data['initial_expiry'])];
                $this->ledger->apply($changes, [
                    'source_type' => 'opening', 'reason' => 'Stock initial', 'user_id' => $user->id,
                ]);
            }

            return $product;
        });

        return [$product, $shop?->id];
    }

    public function update(Product $product, array $input, User $user): Product
    {
        // Désactiver demande products.disable ; le reste, products.update.
        $disabling = array_key_exists('is_active', $input) && $input['is_active'] === false && $product->is_active;
        if (! $user->hasAnyPermission($disabling ? 'products.disable' : 'products.update')) {
            throw ApiException::forbidden();
        }
        $data = $this->validate($input, $product);
        // Un produit qui a du stock ne devient pas un service.
        if ($data['fields']['type'] === 'service' && $product->type !== 'service'
            && DB::table('shop_stock')->where('product_id', $product->id)->where('quantity', '>', 0)->exists()) {
            throw ApiException::invalid('type', 'Ce produit a encore du stock : il ne peut pas devenir un service.');
        }

        return DB::transaction(function () use ($product, $data) {
            $starts = $data['fields']['track_expiry'] && ! $product->track_expiry;
            $product->update([...$data['fields'], 'code' => $data['fields']['code'] ?? $product->code]);
            $this->saveVariants($product, $data['variants']);
            $this->ledger->ensureRows($product->load('variants'));
            if ($starts) {
                $this->lots->startTracking($product);
            }

            return $product;
        });
    }

    /** @return array{fields: array, variants: list<array>, initial: ?string, initial_expiry: ?string} */
    private function validate(array $in, ?Product $current = null): array
    {
        $errors = [];
        $add = function (string $field, string $message) use (&$errors) {
            $errors[$field][] = $message;
        };

        $name = trim((string) ($in['name'] ?? ''));
        if ($name === '') {
            $add('name', 'Donnez un nom au produit.');
        }
        $type = (string) ($in['type'] ?? 'simple');
        if (! in_array($type, Product::TYPES, true)) {
            $add('type', 'Choisissez le type du produit.');
        }
        if ($current && $current->type !== $type && ($current->type === 'variable' || $type === 'variable')) {
            $add('type', $current->type === 'variable'
                ? 'Un produit à variantes le reste : désactivez-le et créez-en un autre.'
                : 'Ce produit ne peut pas devenir un produit à variantes : créez-en un nouveau.');
        }

        // Produit à variantes : le prix est celui de chaque variante.
        $price = $type === 'variable' ? '0' : Decimal::parse($in['price'] ?? null);
        if ($price === null || Decimal::cmp($price, '0') < 0) {
            $add('price', 'Saisissez le prix de vente.');
        }
        $cost = Decimal::parse($in['cost'] ?? null);
        if (filled($in['cost'] ?? null) && ($cost === null || Decimal::cmp($cost, '0') < 0)) {
            $add('cost', 'Le prix d’achat doit être un nombre positif.');
        }
        $alert = Decimal::parse($in['stock_alert'] ?? null);
        if (filled($in['stock_alert'] ?? null) && ($alert === null || Decimal::cmp($alert, '0') < 0)) {
            $add('stock_alert', 'Le seuil doit être un nombre positif.');
        }

        $code = filled($in['code'] ?? null) ? trim((string) $in['code']) : null;
        if ($code && Product::query()->when($current, fn ($q) => $q->whereKeyNot($current->id))->whereRaw('lower(code) = lower(?)', [$code])->exists()) {
            $add('code', 'Ce code est déjà utilisé par un autre produit.');
        }
        $barcode = $type === 'variable' ? null : (filled($in['barcode'] ?? null) ? trim((string) $in['barcode']) : null);
        if ($barcode && $this->barcodeTaken($barcode, $current?->id)) {
            $add('barcode', 'Ce code-barres est déjà utilisé par un autre produit.');
        }
        if (filled($in['category_id'] ?? null) && ! Category::query()->whereKey((int) $in['category_id'])->exists()) {
            $add('category_id', 'Cette catégorie n’existe pas.');
        }
        if (filled($in['unit_id'] ?? null) && ! Unit::query()->whereKey((int) $in['unit_id'])->exists()) {
            $add('unit_id', 'Cette unité n’existe pas.');
        }
        $unitId = filled($in['unit_id'] ?? null) ? (int) $in['unit_id'] : Unit::query()->whereNull('base_unit_id')->orderBy('id')->value('id');
        // Unité d'achat : dérivée de l'unité de base du produit (Carton = Unité × 12).
        $purchaseUnitId = filled($in['purchase_unit_id'] ?? null) ? (int) $in['purchase_unit_id'] : null;
        if ($purchaseUnitId !== null && ! Unit::query()->whereKey($purchaseUnitId)->where('base_unit_id', $unitId)->exists()) {
            $add('purchase_unit_id', "L'unité d'achat doit être une unité dérivée de l'unité du produit (par exemple Carton pour Unité).");
        }
        $initial = Decimal::parse($in['initial_quantity'] ?? null);
        if (! $current && filled($in['initial_quantity'] ?? null) && ($initial === null || Decimal::cmp($initial, '0') < 0)) {
            $add('initial_quantity', 'La quantité doit être un nombre positif.');
        }
        // Dates de péremption (§7.11) : tout est facultatif ; un service n'en a jamais.
        $trackExpiry = $type !== 'service' && filter_var($in['track_expiry'] ?? ($current?->track_expiry ?? false), FILTER_VALIDATE_BOOLEAN);
        $alertDays = $in['expiry_alert_days'] ?? null;
        if (filled($alertDays) && (filter_var($alertDays, FILTER_VALIDATE_INT) === false || (int) $alertDays < 0 || (int) $alertDays > 365)) {
            $add('expiry_alert_days', 'Le délai d’alerte doit être un nombre de jours entre 0 et 365.');
        }
        $initialExpiry = Expiry::parse($in['initial_expiry_date'] ?? null);
        if ($initialExpiry === false) {
            $add('initial_expiry_date', 'Cette date n’est pas valide.');
        }
        $variants = $type === 'variable' ? $this->validateVariants((array) ($in['variants'] ?? []), $current, $add) : [];

        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        if ($type === 'variable') {
            $active = array_filter($variants, fn ($v) => $v['is_active']);
            $kept = $current ? $current->variants->whereNotIn('id', array_column($variants, 'id'))->where('is_active', true)->pluck('price')->map(fn ($p) => (string) $p)->all() : [];
            $prices = [...array_column($active, 'price'), ...$kept];
            usort($prices, fn ($a, $b) => Decimal::cmp($a, $b));
            $price = $prices[0] ?? '0';
        }

        return [
            'fields' => [
                'type' => $type,
                'name' => $name,
                'code' => $code,
                'barcode' => $barcode,
                'category_id' => filled($in['category_id'] ?? null) ? (int) $in['category_id'] : null,
                'brand_id' => filled($in['brand_id'] ?? null) ? (int) $in['brand_id'] : null,
                'unit_id' => $unitId,
                'purchase_unit_id' => $type === 'service' ? null : $purchaseUnitId,
                'cost' => $cost,
                'price' => $price,
                'tax_rate' => Decimal::parse($in['tax_rate'] ?? null),
                'stock_alert' => $type === 'service' ? null : $alert,
                'is_active' => ($in['is_active'] ?? true) !== false,
                'track_expiry' => $trackExpiry,
                'expiry_alert_days' => $trackExpiry && filled($alertDays) ? (int) $alertDays : null,
            ],
            'variants' => $variants,
            'initial' => $type === 'simple' ? $initial : null,
            'initial_expiry' => $trackExpiry && $initialExpiry ? $initialExpiry : null,
        ];
    }

    /**
     * Variantes envoyées : noms uniques, prix obligatoire, au moins une active.
     * Une variante existante absente de la liste est gardée telle quelle.
     */
    private function validateVariants(array $input, ?Product $current, callable $add): array
    {
        $rows = array_map(fn ($x) => [
            'id' => filled($x['id'] ?? null) ? (int) $x['id'] : null,
            'name' => trim((string) ($x['name'] ?? '')),
            'barcode' => filled($x['barcode'] ?? null) ? trim((string) $x['barcode']) : null,
            'cost' => Decimal::parse($x['cost'] ?? null),
            'cost_raw' => $x['cost'] ?? null,
            // Création seulement : stock de départ de la variante dans la boutique courante.
            'initial' => $current ? null : Decimal::parse($x['initial_quantity'] ?? null),
            'initial_raw' => $current ? null : ($x['initial_quantity'] ?? null),
            'initial_expiry' => $current ? null : Expiry::parse($x['initial_expiry_date'] ?? null),
            'price' => Decimal::parse($x['price'] ?? null),
            'is_active' => ($x['is_active'] ?? true) !== false,
        ], array_values($input));
        $existing = $current?->variants ?? collect();
        $kept = $existing->whereNotIn('id', array_filter(array_column($rows, 'id')))->values();

        if (! collect($rows)->contains('is_active', true) && ! $kept->contains('is_active', true)) {
            $add('variants', 'Ajoutez au moins une variante active (par exemple une taille ou un parfum).');
        }
        foreach ($rows as $x) {
            $label = $x['name'] ?: 'sans nom';
            if ($x['id'] !== null && ! $existing->contains('id', $x['id'])) {
                $add('variants', 'Une des variantes n’existe pas.');
            }
            if ($x['name'] === '') {
                $add('variants', 'Donnez un nom à chaque variante.');
            }
            if ($x['price'] === null || Decimal::cmp($x['price'], '0') < 0) {
                $add('variants', "Saisissez le prix de la variante {$label}.");
            }
            if (filled($x['cost_raw']) && ($x['cost'] === null || Decimal::cmp($x['cost'], '0') < 0)) {
                $add('variants', 'Le prix d’achat de '.($x['name'] ?: 'la variante').' doit être un nombre positif.');
            }
            if (filled($x['initial_raw']) && ($x['initial'] === null || Decimal::cmp($x['initial'], '0') < 0)) {
                $add('variants', 'La quantité de '.($x['name'] ?: 'la variante').' doit être un nombre positif.');
            }
            if ($x['initial_expiry'] === false) {
                $add('variants', 'La date de péremption de '.($x['name'] ?: 'la variante').' n’est pas valide.');
            }
            if ($x['barcode'] && $this->barcodeTaken($x['barcode'], $current?->id)) {
                $add('variants', "Le code-barres de {$x['name']} est déjà utilisé par un autre produit.");
            }
        }
        $names = array_map(fn ($n) => mb_strtolower($n), array_filter([...array_column($rows, 'name'), ...$kept->pluck('name')->all()]));
        if (count(array_unique($names)) !== count($names)) {
            $add('variants', 'Deux variantes portent le même nom.');
        }
        $codes = array_filter([...array_column($rows, 'barcode'), ...$kept->pluck('barcode')->all()]);
        if (count(array_unique($codes)) !== count($codes)) {
            $add('variants', 'Deux variantes ont le même code-barres.');
        }

        return array_map(fn ($x) => array_diff_key([...$x, 'price' => $x['price'] ?? '0', 'initial_expiry' => $x['initial_expiry'] ?: null], ['cost_raw' => 1, 'initial_raw' => 1]), $rows);
    }

    /** Un code-barres est unique dans l'espace, produits et variantes confondus. */
    private function barcodeTaken(string $barcode, ?int $exceptProductId): bool
    {
        return Product::query()->where('barcode', $barcode)->when($exceptProductId, fn ($q) => $q->whereKeyNot($exceptProductId))->exists()
            || ProductVariant::query()->where('barcode', $barcode)->when($exceptProductId, fn ($q) => $q->where('product_id', '!=', $exceptProductId))->exists();
    }

    /**
     * Nouvelles variantes créées (code P-0061-n), les autres mises à jour.
     *
     * @return list<int> l'identifiant de chaque ligne, dans l'ordre reçu
     */
    private function saveVariants(Product $product, array $rows): array
    {
        if ($product->type !== 'variable') {
            return [];
        }
        $count = $product->variants()->count();
        $ids = [];
        foreach ($rows as $row) {
            $fields = ['name' => $row['name'], 'barcode' => $row['barcode'], 'cost' => $row['cost'], 'price' => $row['price'], 'is_active' => $row['is_active']];
            if ($row['id']) {
                $product->variants()->whereKey($row['id'])->update($fields);
                $ids[] = $row['id'];
            } else {
                $ids[] = $product->variants()->create([...$fields, 'code' => $product->code.'-'.(++$count)])->id;
            }
        }

        return $ids;
    }
}
