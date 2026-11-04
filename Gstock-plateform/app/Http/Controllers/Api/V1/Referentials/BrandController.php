<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Domain\Catalog\Models\Brand;

class BrandController extends ReferentialController
{
    protected function model(): string
    {
        return Brand::class;
    }

    protected function nameMessage(): string
    {
        return 'Donnez un nom à la marque.';
    }
}
