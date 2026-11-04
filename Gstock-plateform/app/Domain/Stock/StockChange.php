<?php

namespace App\Domain\Stock;

use App\Domain\Catalog\Models\Product;

/** Variation du stock d'un article dans une boutique, en unité de base (signée). */
final class StockChange
{
    public function __construct(
        public readonly int $shopId,
        public readonly Product $product,
        public readonly ?int $variantId,
        public readonly string $delta,
        /** Coût unitaire à noter sur le mouvement ; par défaut celui de l'article. */
        public readonly ?string $unitCost = null,
    ) {}

    public function key(): string
    {
        return sprintf('%010d|%010d|%010d', $this->shopId, $this->product->id, $this->variantId ?? 0);
    }
}
