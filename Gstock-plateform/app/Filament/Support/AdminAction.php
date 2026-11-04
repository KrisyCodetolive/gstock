<?php

namespace App\Filament\Support;

use App\Domain\Platform\Models\PlatformAdmin;
use Closure;
use Filament\Facades\Filament;
use Filament\Forms\Components\Textarea;
use Filament\Notifications\Notification;
use InvalidArgumentException;

/** Aides communes aux actions du back-office : motif obligatoire, auteur, erreurs lisibles. */
final class AdminAction
{
    public static function admin(): PlatformAdmin
    {
        /** @var PlatformAdmin $admin */
        $admin = Filament::auth()->user();

        return $admin;
    }

    public static function reason(): Textarea
    {
        return Textarea::make('reason')->label('Motif')->helperText('Obligatoire : il est enregistré dans le journal.')->required()->rows(2)->maxLength(500);
    }

    /** Exécute l'action ; une règle refusée s'affiche en notification au lieu d'une erreur. */
    public static function run(Closure $action, string $success): void
    {
        try {
            $action();
            Notification::make()->title($success)->success()->send();
        } catch (InvalidArgumentException $e) {
            Notification::make()->title($e->getMessage())->danger()->send();
        }
    }
}
