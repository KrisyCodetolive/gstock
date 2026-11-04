<?php

namespace App\Http\Controllers\Api\V1\Referentials;

use App\Domain\Expenses\Models\ExpenseCategory;

class ExpenseCategoryController extends ReferentialController
{
    protected function model(): string
    {
        return ExpenseCategory::class;
    }

    protected function nameMessage(): string
    {
        return 'Donnez un nom à la catégorie de dépenses.';
    }
}
