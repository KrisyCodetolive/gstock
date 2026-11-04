<?php

namespace App\Filament\Resources\TenantInvoices;

use App\Domain\Platform\Admin\PlatformAdministration;
use App\Domain\Platform\Models\Tenant;
use App\Domain\Platform\Models\TenantInvoice;
use App\Filament\Resources\TenantInvoices\Pages\ListTenantInvoices;
use App\Filament\Support\AdminAction;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Factures d'abonnement de tous les espaces (M01) : statut et relance manuelle. */
class TenantInvoiceResource extends Resource
{
    protected static ?string $slug = 'factures';

    protected static ?string $model = TenantInvoice::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedDocumentText;

    protected static ?string $recordTitleAttribute = 'reference';

    protected static ?string $modelLabel = 'facture';

    protected static ?string $pluralModelLabel = 'factures';

    protected static ?int $navigationSort = 5;

    public const STATUSES = ['pending' => 'En attente', 'paid' => 'Payée', 'failed' => 'Échouée'];

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['tenant', 'plan']))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('reference')->label('Facture')->searchable(),
                TextColumn::make('tenant.name')->label('Espace')->searchable(),
                TextColumn::make('plan.name')->label('Formule'),
                TextColumn::make('amount')->label('Montant')->formatStateUsing(fn ($state) => number_format((float) $state, 0, ',', "\u{202F}").' FCFA')->sortable(),
                TextColumn::make('status')->label('État')->badge()
                    ->formatStateUsing(fn (string $state) => self::STATUSES[$state] ?? $state)
                    ->color(fn (string $state) => ['paid' => 'success', 'pending' => 'warning', 'failed' => 'danger'][$state] ?? 'gray'),
                TextColumn::make('payment_channel')->label('Moyen')->placeholder('—'),
                TextColumn::make('created_at')->label('Créée le')->dateTime('d/m/Y H:i')->sortable(),
                TextColumn::make('paid_at')->label('Payée le')->dateTime('d/m/Y H:i')->placeholder('—')->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')->label('État')->options(self::STATUSES),
                SelectFilter::make('tenant_id')->label('Espace')->options(fn () => Tenant::query()->orderBy('name')->pluck('name', 'id')->all())->searchable(),
            ])
            ->recordActions([
                Action::make('remind')->label('Relancer')->icon('heroicon-o-envelope')
                    ->visible(fn (TenantInvoice $record) => $record->status !== 'paid')
                    ->requiresConfirmation()
                    ->modalDescription(fn (TenantInvoice $record) => 'Un e-mail de relance sera envoyé à '.($record->tenant->owner_email ?? '—').'.')
                    ->action(fn (TenantInvoice $record) => AdminAction::run(fn () => app(PlatformAdministration::class)->remindInvoice($record, AdminAction::admin()), 'Relance envoyée.')),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ListTenantInvoices::route('/')];
    }
}
