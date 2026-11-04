<?php

namespace App\Filament\Resources\Tenants;

use App\Domain\Platform\Admin\PlatformMetrics;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Filament\Resources\Tenants\Pages\ListTenants;
use App\Filament\Resources\Tenants\Pages\ViewTenant;
use App\Filament\Resources\Tenants\RelationManagers\InvoicesRelationManager;
use App\Filament\Resources\Tenants\RelationManagers\ShopsRelationManager;
use App\Filament\Resources\Tenants\RelationManagers\UsersRelationManager;
use BackedEnum;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Espaces des commerçants (M01) : liste filtrable, fiche, actions de supervision. */
class TenantResource extends Resource
{
    protected static ?string $slug = 'espaces';

    protected static ?string $model = Tenant::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBuildingStorefront;

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $modelLabel = 'espace';

    protected static ?string $pluralModelLabel = 'espaces';

    protected static ?int $navigationSort = 1;

    public static function infolist(Schema $schema): Schema
    {
        $usage = fn (Tenant $record, string $key) => PlatformMetrics::usage($record)[$key];

        return $schema->columns(3)->components([
            Section::make('Coordonnées')->columnSpan(1)->schema([
                TextEntry::make('name')->label('Nom'),
                TextEntry::make('slug')->label('Adresse')->formatStateUsing(fn ($state) => "{$state}.gstock.app"),
                TextEntry::make('owner_email')->label('E-mail')->placeholder('—'),
                TextEntry::make('phone')->label('Téléphone')->placeholder('—'),
                TextEntry::make('created_at')->label('Inscrit le')->dateTime('d/m/Y H:i'),
            ]),
            Section::make('Abonnement')->columnSpan(1)->schema([
                TextEntry::make('state')->label('État')->badge()
                    ->state(fn (Tenant $record) => PlatformMetrics::stateOf($record))
                    ->formatStateUsing(fn (string $state) => PlatformMetrics::STATES[$state])
                    ->color(fn (string $state) => PlatformMetrics::stateColor($state)),
                TextEntry::make('suspension_reason')->label('Motif de la suspension')->visible(fn (Tenant $record) => $record->suspended_at !== null),
                TextEntry::make('subscription.plan.name')->label('Formule'),
                TextEntry::make('subscription.trial_ends_at')->label('Fin de l’essai')->date('d/m/Y')->placeholder('—'),
                TextEntry::make('subscription.ends_at')->label('Payé jusqu’au')->date('d/m/Y')->placeholder('Rien de payé'),
            ]),
            Section::make('Usage')->columnSpan(1)->columns(2)->schema([
                TextEntry::make('u_shops')->label('Boutiques ouvertes')->state(fn (Tenant $r) => $usage($r, 'shops')),
                TextEntry::make('u_users')->label('Utilisateurs')->state(fn (Tenant $r) => $usage($r, 'users').' (actifs à 30 j : '.$usage($r, 'active_users_30').')'),
                TextEntry::make('u_products')->label('Produits actifs')->state(fn (Tenant $r) => $usage($r, 'products')),
                TextEntry::make('u_customers')->label('Clients')->state(fn (Tenant $r) => $usage($r, 'customers')),
                TextEntry::make('u_sales')->label('Ventes')->state(fn (Tenant $r) => $usage($r, 'sales').' (30 j : '.$usage($r, 'sales_30').')'),
                TextEntry::make('u_amount')->label('Ventes à 30 j')->state(fn (Tenant $r) => PlatformMetrics::fcfa($usage($r, 'sales_amount_30'))),
                TextEntry::make('u_credits')->label('Reste à récupérer')->state(fn (Tenant $r) => PlatformMetrics::fcfa($usage($r, 'credits_remaining'))),
                TextEntry::make('u_activated')->label('Activé le')->state(fn (Tenant $r) => $usage($r, 'activated_at'))->dateTime('d/m/Y')->placeholder('Pas encore'),
                TextEntry::make('u_first_sale')->label('Première vente')->state(fn (Tenant $r) => $usage($r, 'first_sale_at'))->dateTime('d/m/Y')->placeholder('Pas encore'),
                TextEntry::make('u_last')->label('Dernière activité')->state(fn (Tenant $r) => $usage($r, 'last_activity_at'))->dateTime('d/m/Y H:i')->placeholder('—'),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with('subscription.plan', 'subscription.tenant')
                ->addSelect(['last_login' => fn ($s) => $s->from('users')->selectRaw('max(last_login_at)')->whereColumn('users.tenant_id', 'tenants.id')]))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('name')->label('Espace')->searchable()->sortable()->description(fn (Tenant $r) => $r->slug),
                TextColumn::make('state')->label('État')->badge()
                    ->state(fn (Tenant $r) => PlatformMetrics::stateOf($r))
                    ->formatStateUsing(fn (string $state) => PlatformMetrics::STATES[$state])
                    ->color(fn (string $state) => PlatformMetrics::stateColor($state)),
                TextColumn::make('subscription.plan.name')->label('Formule'),
                TextColumn::make('owner_email')->label('E-mail')->searchable()->toggleable(),
                TextColumn::make('created_at')->label('Inscrit le')->date('d/m/Y')->sortable(),
                TextColumn::make('last_login')->label('Dernière connexion')->dateTime('d/m/Y H:i')->placeholder('—')->sortable(),
            ])
            ->filters([
                SelectFilter::make('state')->label('État')->options(PlatformMetrics::STATES)
                    ->query(fn (Builder $query, array $data) => filled($data['value']) ? PlatformMetrics::whereState($query, $data['value']) : $query),
                SelectFilter::make('plan')->label('Formule')->options(fn () => Plan::query()->orderBy('price')->pluck('name', 'id')->all())
                    ->query(fn (Builder $query, array $data) => filled($data['value']) ? $query->whereHas('subscription', fn ($s) => $s->where('plan_id', $data['value'])) : $query),
                Filter::make('created_at')->label('Inscription')->schema([
                    DatePicker::make('from')->label('Inscrit depuis le'),
                    DatePicker::make('until')->label('Inscrit jusqu’au'),
                ])->query(fn (Builder $query, array $data) => $query
                    ->when($data['from'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
                    ->when($data['until'] ?? null, fn ($q, $d) => $q->whereDate('created_at', '<=', $d))),
            ])
            ->recordActions([ViewAction::make()]);
    }

    public static function getRelations(): array
    {
        return [ShopsRelationManager::class, UsersRelationManager::class, InvoicesRelationManager::class];
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListTenants::route('/'),
            'view' => ViewTenant::route('/{record}'),
        ];
    }
}
