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
        /** Entrée d'un produit suivi : date de péremption de l'arrivage créé (§7.11), facultative. */
        public readonly ?string $expiryDate = null,
        /** Sortie d'un produit suivi : arrivage précis à vider (sortie « Périmé »), sinon la date la plus proche. */
        public readonly ?int $lotId = null,
    ) {}

    public function key(): string
    {
        return sprintf('%010d|%010d|%010d', $this->shopId, $this->product->id, $this->variantId ?? 0);
    }
}
