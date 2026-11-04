<?php

namespace App\Filament\Resources\Users;

use App\Domain\Identity\Models\User;
use App\Domain\Platform\Models\Tenant;
use App\Filament\Resources\Users\Pages\ListUsers;
use App\Filament\Support\UserActions;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/** Tous les utilisateurs de tous les espaces (M01) : désactivation, mot de passe, mode support. */
class UserResource extends Resource
{
    protected static ?string $slug = 'utilisateurs';

    protected static ?string $model = User::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedUsers;

    protected static ?string $modelLabel = 'utilisateur';

    protected static ?string $pluralModelLabel = 'utilisateurs';

    protected static ?int $navigationSort = 3;

    public static function table(Table $table): Table
    {
        return $table
            ->modifyQueryUsing(fn (Builder $query) => $query->with(['tenant', 'role', 'shops']))
            ->defaultSort('last_login_at', 'desc')
            ->columns([
                TextColumn::make('lastname')->label('Nom')->sortable()
                    ->formatStateUsing(fn (User $record) => $record->name())
                    ->description(fn (User $record) => $record->email ?? $record->phone)
                    ->searchable(['firstname', 'lastname', 'email', 'phone']),
                TextColumn::make('tenant.name')->label('Espace')->searchable(),
                TextColumn::make('role.name')->label('Rôle')->badge()
                    ->formatStateUsing(fn (User $record) => $record->role?->is_owner ? 'Propriétaire' : $record->role?->name),
                TextColumn::make('shops_list')->label('Boutiques')
                    ->state(fn (User $record) => $record->role?->is_owner ? 'Toutes' : ($record->shops->pluck('name')->join(', ') ?: '—'))->wrap(),
                IconColumn::make('is_active')->label('Actif')->boolean(),
                TextColumn::make('last_login_at')->label('Dernière connexion')->dateTime('d/m/Y H:i')->placeholder('Jamais')->sortable(),
            ])
            ->filters([
                SelectFilter::make('tenant_id')->label('Espace')->options(fn () => Tenant::query()->orderBy('name')->pluck('name', 'id')->all())->searchable(),
                TernaryFilter::make('is_active')->label('Actif'),
            ])
            ->recordActions([UserActions::group()]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ListUsers::route('/')];
    }
}
