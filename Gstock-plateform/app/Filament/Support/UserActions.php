<?php

namespace App\Filament\Support;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Admin\PlatformAdministration;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Forms\Components\Select;
use Filament\Notifications\Notification;
use InvalidArgumentException;

/** Actions sur un utilisateur d'un espace (M01) : désactivation, mot de passe, mode support. */
final class UserActions
{
    public static function group(): ActionGroup
    {
        $do = fn () => app(PlatformAdministration::class);

        return ActionGroup::make([
            Action::make('deactivate')->label('Désactiver')->icon('heroicon-o-no-symbol')->color('danger')
                ->visible(fn (User $record) => $record->is_active)
                ->modalDescription('Ses sessions en cours s’arrêtent et il ne peut plus se connecter.')
                ->schema([AdminAction::reason()])
                ->action(fn (User $record, array $data) => AdminAction::run(fn () => $do()->setUserActive($record, AdminAction::admin(), false, $data['reason']), 'Utilisateur désactivé.')),
            Action::make('reactivate')->label('Réactiver')->icon('heroicon-o-check-circle')->color('success')
                ->visible(fn (User $record) => ! $record->is_active)
                ->schema([AdminAction::reason()])
                ->action(fn (User $record, array $data) => AdminAction::run(fn () => $do()->setUserActive($record, AdminAction::admin(), true, $data['reason']), 'Utilisateur réactivé.')),
            Action::make('resetPassword')->label('Lien de mot de passe')->icon('heroicon-o-key')
                ->requiresConfirmation()->modalDescription(fn (User $record) => "Un lien de réinitialisation sera envoyé à {$record->email}.")
                ->visible(fn (User $record) => filled($record->email))
                ->action(fn (User $record) => AdminAction::run(fn () => $do()->sendPasswordReset($record, AdminAction::admin()), 'Lien envoyé.')),
            Action::make('support')->label('Mode support')->icon('heroicon-o-lifebuoy')->color('warning')
                ->visible(fn (User $record) => $record->is_active)
                ->modalHeading(fn (User $record) => "Se connecter en tant que {$record->name()} ?")
                ->modalDescription('La session est limitée dans le temps, un bandeau reste visible pour l’utilisateur, et la connexion est inscrite dans les deux journaux.')
                ->schema([
                    Select::make('minutes')->label('Durée')->options([15 => '15 minutes', 30 => '30 minutes', 60 => '1 heure'])->default(30)->required(),
                    AdminAction::reason(),
                ])
                ->action(function (User $record, array $data) use ($do) {
                    try {
                        $url = $do()->startSupportSession($record, AdminAction::admin(), $data['reason'], (int) $data['minutes']);
                    } catch (InvalidArgumentException $e) {
                        Notification::make()->title($e->getMessage())->danger()->send();

                        return;
                    }
                    Notification::make()->title('Session d’assistance prête')
                        ->body('Le lien ouvre l’espace dans un nouvel onglet. Il ne sert qu’une fois et expire dans 10 minutes.')
                        ->actions([Action::make('open')->label('Ouvrir l’espace')->url($url, shouldOpenInNewTab: true)->button()])
                        ->persistent()->success()->send();
                }),
        ]);
    }
}
