<?php

namespace App\Filament\Resources\PlatformAuditLogs\Pages;

use App\Filament\Resources\PlatformAuditLogs\PlatformAuditLogResource;
use Filament\Resources\Pages\ListRecords;

class ListPlatformAuditLogs extends ListRecords
{
    protected static string $resource = PlatformAuditLogResource::class;
}
