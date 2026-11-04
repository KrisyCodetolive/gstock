<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\ProductService;
use App\Domain\Identity\Models\User;
use App\Domain\Shops\Models\Shop;
use App\Http\Controllers\Controller;
use App\Http\Resources\CatalogPresenter;
use App\Support\ApiException;
use App\Support\ListQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Mes produits (M06) : catalogue commun à l'espace, stock par boutique. Désactivés, jamais supprimés. */
class ProductController extends Controller
{
    public function __construct(private ProductService $products) {}

    /** `?shop_id=` ajoute le stock de cette boutique à chaque produit. */
    public function index(Request $request): JsonResponse
    {
        $shopId = $this->shopParam($request);
        $presenter = null;

        return ListQuery::respond(
            $request,
            Product::query()->with(['category', 'brand', 'variants']),
            // Par référence : le présentateur est créé par beforeMap, une fois la page connue.
            function (Product $p) use (&$presenter) {
                return $presenter->product($p);
            },
            searchIn: ['products.name', 'products.code', 'products.barcode'],
            filters: [
                'category_id' => fn (Builder $q, string $v) => $q->where('category_id', (int) $v),
                'is_active' => ListQuery::boolean('is_active'),
            ],
            sortable: ['name', 'price', 'code'],
            beforeMap: function ($items) use (&$presenter, $shopId) {
                $presenter = new CatalogPresenter($items, $shopId);
            },
        );
    }

    public function show(Request $request, Product $product): JsonResponse
    {
        $product->load(['category', 'brand', 'variants']);

        return response()->json(['data' => (new CatalogPresenter([$product], $this->shopParam($request)))->product($product)]);
    }

    public function store(Request $request): JsonResponse
    {
        [$product, $shopId] = $this->products->create($request->all(), $request->user());
        $product->load(['category', 'brand', 'variants']);

        return response()->json(['data' => (new CatalogPresenter([$product], $shopId))->product($product)], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $product->load('variants');
        $product = $this->products->update($product, $request->all(), $request->user());
        $product->load(['category', 'brand', 'variants']);

        return response()->json(['data' => (new CatalogPresenter([$product], $this->shopParam($request)))->product($product)]);
    }

    /** Photo déjà réduite par l'application (multipart `image`). */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate(
            ['image' => ['required', 'file', 'mimetypes:image/jpeg,image/png,image/webp', 'max:1024']],
            ['image.required' => 'Choisissez une photo au format JPEG, PNG ou WebP.', 'image.mimetypes' => 'Choisissez une photo au format JPEG, PNG ou WebP.', 'image.max' => 'Cette photo est trop lourde.'],
        );
        $old = $product->image_path;
        $product->update(['image_path' => $request->file('image')->store("tenants/{$product->tenant_id}/products", 'public')]);
        if ($old) {
            Storage::disk('public')->delete($old);
        }

        return $this->show($request, $product);
    }

    public function deleteImage(Request $request, Product $product): JsonResponse
    {
        if ($product->image_path) {
            Storage::disk('public')->delete($product->image_path);
            $product->update(['image_path' => null]);
        }

        return $this->show($request, $product);
    }

    /** Stock de chaque boutique accessible (variantes : total, puis détail). */
    public function stock(Request $request, Product $product): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $product->load('variants');
        $shops = $user->isOwner() ? Shop::query()->orderBy('id')->get() : $user->shops()->orderBy('shops.id')->get();
        if (! $product->isStockable()) {
            return response()->json(['data' => []]);
        }

        return response()->json(['data' => $shops->map(function (Shop $shop) use ($product) {
            $presenter = new CatalogPresenter([$product], $shop->id);
            $total = $presenter->level($product);

            return [
                'shop' => ['id' => $shop->id, 'name' => $shop->name, 'is_active' => $shop->is_active],
                ...$total,
                'variants' => $product->variants->map(fn ($v) => [
                    'id' => $v->id, 'name' => $v->name,
                    ...array_intersect_key($presenter->articleLevel($product, $v->id), ['quantity' => 1, 'state' => 1]),
                ])->values()->all(),
            ];
        })->values()]);
    }

    /**
     * Recherche compacte pour les sélecteurs (stock, caisse) : nom, code ou code-barres.
     * Un code-barres exact (produit ou variante) ne renvoie que son article.
     */
    public function search(Request $request, Shop $shop): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        $withServices = $request->query('services') === 'true';
        $products = Product::query()->with(['category', 'variants'])->where('is_active', true)
            ->when(! $withServices, fn ($b) => $b->where('type', '!=', 'service'))
            ->orderBy('name')->get();
        $presenter = new CatalogPresenter($products, $shop->id);
        $articles = $products->flatMap(fn (Product $p) => $presenter->articles($p));

        $normalize = fn (string $s) => mb_strtolower(trim(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s));
        $needle = $normalize($q);
        $exact = $articles->filter(fn ($a) => $a['barcode'] !== null && $normalize($a['barcode']) === $needle);
        $data = ($exact->isNotEmpty() ? $exact : $articles->filter(fn ($a) => $needle === '' || str_contains($normalize("{$a['name']} {$a['code']} {$a['barcode']}"), $needle)))
            ->take(20)->values();

        return response()->json(['data' => $data]);
    }

    private function shopParam(Request $request): ?int
    {
        if (! $request->filled('shop_id')) {
            return null;
        }
        $shop = Shop::query()->find((int) $request->query('shop_id'));
        if (! $shop || ! $request->user()->canAccessShop($shop)) {
            throw ApiException::forbidden("Vous n'avez pas accès à cette boutique.");
        }

        return $shop->id;
    }
}
