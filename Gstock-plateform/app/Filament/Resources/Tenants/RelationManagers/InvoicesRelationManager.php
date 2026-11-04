<?php

namespace App\Filament\Resources\Tenants\RelationManagers;

use App\Filament\Resources\TenantInvoices\TenantInvoiceResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Tables\Table;

class InvoicesRelationManager extends RelationManager
{
    protected static string $relationship = 'invoices';

    protected static ?string $title = 'Factures';

    public function isReadOnly(): bool
    {
        return false;
    }

    public function table(Table $table): Table
    {
        return TenantInvoiceResource::table($table)->filters([]);
    }
}
