<?php

namespace App\Filament\Resources\PlatformAuditLogs;

use App\Domain\Platform\Admin\PlatformAudit;
use App\Domain\Platform\Models\PlatformAdmin;
use App\Domain\Platform\Models\PlatformAuditLog;
use App\Filament\Resources\PlatformAuditLogs\Pages\ListPlatformAuditLogs;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

/** Journal des actions des super-admins (M01) : en lecture seule. */
class PlatformAuditLogResource extends Resource
{
    protected static ?string $slug = 'journal';

    protected static ?string $model = PlatformAuditLog::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedClipboardDocumentList;

    protected static ?string $modelLabel = 'entrée du journal';

    protected static ?string $pluralModelLabel = 'journal';

    protected static ?string $navigationLabel = 'Journal';

    protected static ?int $navigationSort = 6;

    public static function table(Table $table): Table
    {
        $values = fn (?array $v) => $v ? collect($v)->map(fn ($x, $k) => "{$k} : ".(is_scalar($x) || $x === null ? ($x ?? '—') : json_encode($x)))->join(' · ') : null;

        return $table
            ->modifyQueryUsing(fn ($query) => $query->with(['admin', 'tenant']))
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('created_at')->label('Date')->dateTime('d/m/Y H:i')->sortable(),
                TextColumn::make('admin.name')->label('Super-admin'),
                TextColumn::make('action')->label('Action')->badge()->formatStateUsing(fn (string $state) => PlatformAudit::LABELS[$state] ?? $state),
                TextColumn::make('tenant.name')->label('Espace')->placeholder('—'),
                TextColumn::make('subject_label')->label('Objet')->placeholder('—'),
                TextColumn::make('reason')->label('Motif')->placeholder('—')->wrap()->searchable(),
                TextColumn::make('changes')->label('Avant / après')->wrap()->toggleable()
                    ->state(fn (PlatformAuditLog $r) => collect([$values($r->old_values) ? 'Avant : '.$values($r->old_values) : null, $values($r->new_values) ? 'Après : '.$values($r->new_values) : null])->filter()->join("\n") ?: null)
                    ->placeholder('—'),
            ])
            ->filters([
                SelectFilter::make('action')->label('Action')->options(PlatformAudit::LABELS),
                SelectFilter::make('platform_admin_id')->label('Super-admin')->options(fn () => PlatformAdmin::query()->orderBy('name')->pluck('name', 'id')->all()),
            ]);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return ['index' => ListPlatformAuditLogs::route('/')];
    }
}
