<?php

namespace App\Filament\Resources\Shops;

use App\Domain\Platform\Models\Tenant;
use App\Domain\Shops\Models\Shop;
use App\Filament\Resources\Shops\Pages\ListShops;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Toutes les boutiques de tous les espaces (M01), en lecture. */
class ShopResource extends Resource
{
    protected static ?string $slug = 'boutiques';

    protected static ?string $model = Shop::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedHomeModern;

    protected static ?string $modelLabel = 'boutique';

    protected static ?string $pluralModelLabel = 'boutiques';

    protected static ?int $navigationSort = 2;

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('tenant')->addSelect([
                'users_count' => fn ($s) => $s->from('shop_user')->selectRaw('count(*)')->whereColumn('shop_user.shop_id', 'shops.id'),
                'sales_count' => fn ($s) => $s->from('sales')->selectRaw('count(*)')->whereColumn('sales.shop_id', 'shops.id')->where('sales.status', 'completed'),
                'last_sale_at' => fn ($s) => $s->from('sales')->selectRaw('max(occurred_at)')->whereColumn('sales.shop_id', 'shops.id'),
            ]))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('name')->label('Boutique')->searchable()->sortable(),
                TextColumn::make('tenant.name')->label('Espace')->searchable(),
                TextColumn::make('city')->label('Ville')->searchable()->placeholder('—'),
                TextColumn::make('users_count')->label('Utilisateurs')->numeric()->sortable()
                    ->tooltip('Utilisateurs affectés ; le propriétaire voit toutes les boutiques.'),
                TextColumn::make('sales_count')->label('Ventes')->numeric()->sortable(),
                TextColumn::make('last_sale_at')->label('Dernière vente')->dateTime('d/m/Y H:i')->placeholder('—')->sortable(),
                IconColumn::make('is_active')->label('Ouverte')->boolean(),
            ])
            ->filters([
                SelectFilter::make('tenant_id')->label('Espace')->options(fn () => Tenant::query()->orderBy('name')->pluck('name', 'id')->all())->searchable(),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ListShops::route('/')];
    }
}
