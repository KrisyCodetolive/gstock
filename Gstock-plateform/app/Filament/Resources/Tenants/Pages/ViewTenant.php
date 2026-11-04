<?php

namespace App\Filament\Resources\Tenants\Pages;

use App\Domain\Platform\Admin\PlatformAdministration;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Filament\Resources\Tenants\TenantResource;
use App\Filament\Support\AdminAction;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Forms\Components\Select;
use Filament\Resources\Pages\ViewRecord;

/** Fiche d'un espace et actions de supervision (M01), toutes motivées et journalisées. */
class ViewTenant extends ViewRecord
{
    protected static string $resource = TenantResource::class;

    public function getTitle(): string
    {
        return $this->record->name;
    }

    protected function getHeaderActions(): array
    {
        $do = app(PlatformAdministration::class);

        return [
            Action::make('suspend')->label('Suspendre')->color('danger')->icon('heroicon-o-pause-circle')
                ->visible(fn (Tenant $record) => $record->suspended_at === null && ! $record->isClosed())
                ->modalHeading('Suspendre cet espace ?')
                ->modalDescription('L’espace passe en lecture seule tout de suite : plus aucune vente ni opération, la consultation reste possible.')
                ->schema([AdminAction::reason()])
                ->action(fn (Tenant $record, array $data) => AdminAction::run(fn () => $do->suspend($record, AdminAction::admin(), $data['reason']), 'Espace suspendu.')),
            Action::make('reactivate')->label('Réactiver')->color('success')->icon('heroicon-o-play-circle')
                ->visible(fn (Tenant $record) => $record->suspended_at !== null)
                ->schema([AdminAction::reason()])
                ->action(fn (Tenant $record, array $data) => AdminAction::run(fn () => $do->reactivate($record, AdminAction::admin(), $data['reason']), 'Espace réactivé.')),
            ActionGroup::make([
                Action::make('extendTrial')->label('Prolonger l’essai')->icon('heroicon-o-clock')
                    ->schema([
                        Select::make('days')->label('Jours d’essai en plus')->options([7 => '7 jours', 14 => '14 jours', 30 => '30 jours'])->required(),
                        AdminAction::reason(),
                    ])
                    ->action(fn (Tenant $record, array $data) => AdminAction::run(fn () => $do->extendTrial($record, AdminAction::admin(), (int) $data['days'], $data['reason']), 'Essai prolongé.')),
                Action::make('changePlan')->label('Changer de formule')->icon('heroicon-o-arrows-right-left')
                    ->schema([
                        Select::make('plan_id')->label('Nouvelle formule')->options(fn () => Plan::query()->orderBy('price')->pluck('name', 'id')->all())->required(),
                        AdminAction::reason(),
                    ])
                    ->action(fn (Tenant $record, array $data) => AdminAction::run(fn () => $do->changePlan($record, AdminAction::admin(), Plan::query()->findOrFail($data['plan_id']), $data['reason']), 'Formule changée.')),
            ])->label('Abonnement')->button()->color('gray'),
        ];
    }
}
