<?php

namespace App\Filament\Resources\Tenants\RelationManagers;

use App\Filament\Resources\Shops\ShopResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class ShopsRelationManager extends RelationManager
{
    protected static string $relationship = 'shops';

    protected static ?string $title = 'Boutiques';

    public function isReadOnly(): bool
    {
        return true;
    }

    public function table(Table $table): Table
    {
        return ShopResource::table($table)->filters([]);
    }
}
