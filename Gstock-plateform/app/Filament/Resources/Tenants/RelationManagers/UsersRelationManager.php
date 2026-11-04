<?php

namespace App\Filament\Resources\Tenants\RelationManagers;

use App\Filament\Resources\Users\UserResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class UsersRelationManager extends RelationManager
{
    protected static string $relationship = 'users';

    protected static ?string $title = 'Utilisateurs';

    public function isReadOnly(): bool
    {
        return false;
    }

    public function table(Table $table): Table
    {
        return UserResource::table($table)->filters([]);
    }
}
