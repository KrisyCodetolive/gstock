<?php

namespace App\Domain\Catalog;

use App\Domain\Catalog\Models\Product;
use App\Domain\Catalog\Models\ProductVariant;
use App\Support\ApiException;

/**
 * Ce qu'on vend, achète ou compte : un produit simple, ou une variante active
 * d'un produit `variable` (prix, coût et stock de la variante).
 */
final class Article
{
    private function __construct(
        public readonly Product $product,
        public readonly ?ProductVariant $variant,
    ) {}

    /** 422 « Choisissez la variante de … » si la variante manque ou n'est plus active. */
    public static function resolve(Product $product, mixed $variantId, string $field = 'items'): self
    {
        if ($product->type !== 'variable') {
            return new self($product, null);
        }
        $variant = $variantId ? $product->variants->first(fn (ProductVariant $v) => $v->id === (int) $variantId && $v->is_active) : null;
        if (! $variant) {
            throw ApiException::invalid($field, "Choisissez la variante de {$product->name}.");
        }

        return new self($product, $variant);
    }

    public function variantId(): ?int
    {
        return $this->variant?->id;
    }

    public function name(): string
    {
        return $this->product->articleName($this->variant?->id);
    }

    public function price(): string
    {
        return (string) ($this->variant?->price ?? $this->product->price);
    }

    public function cost(): ?string
    {
        $cost = $this->variant ? $this->variant->cost : $this->product->cost;

        return $cost === null ? null : (string) $cost;
    }
}
