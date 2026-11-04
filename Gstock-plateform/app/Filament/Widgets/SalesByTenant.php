<?php

namespace App\Filament\Widgets;

use App\Domain\Platform\Models\Tenant;
use App\Filament\Resources\Tenants\TenantResource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder;

/** Ventes enregistrées par espace sur 30 jours (M01). */
class SalesByTenant extends TableWidget
{
    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Ventes par espace (30 derniers jours)';

    public function table(Table $table): Table
    {
        $since = now()->subDays(30);
        $sales = fn ($s) => $s->from('sales')->whereColumn('sales.tenant_id', 'tenants.id')->where('sales.status', 'completed')->where('sales.occurred_at', '>=', $since);

        return $table
            ->query(fn (): Builder => Tenant::query()->select('tenants.*')->addSelect([
                'sales_30' => fn ($s) => $sales($s)->selectRaw('count(*)'),
                'amount_30' => fn ($s) => $sales($s)->selectRaw('coalesce(sum(total), 0)'),
                'sales_total' => fn ($s) => $s->from('sales')->whereColumn('sales.tenant_id', 'tenants.id')->where('sales.status', 'completed')->selectRaw('count(*)'),
            ]))
            ->defaultSort('sales_30', 'desc')
            ->paginated([5, 10, 25])
            ->defaultPaginationPageOption(5)
            ->recordUrl(fn (Tenant $record) => TenantResource::getUrl('view', ['record' => $record]))
            ->columns([
                TextColumn::make('name')->label('Espace'),
                TextColumn::make('sales_30')->label('Ventes')->numeric()->sortable(),
                TextColumn::make('amount_30')->label('Montant')->formatStateUsing(fn ($state) => number_format((float) $state, 0, ',', "\u{202F}").' FCFA')->sortable(),
                TextColumn::make('sales_total')->label('Depuis l’inscription')->numeric()->sortable(),
            ]);
    }
}
