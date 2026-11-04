<?php

namespace App\Filament\Resources\Plans;

use App\Domain\Platform\Models\Plan;
use App\Filament\Resources\Plans\Pages\CreatePlan;
use App\Filament\Resources\Plans\Pages\EditPlan;
use App\Filament\Resources\Plans\Pages\ListPlans;
use BackedEnum;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/** Formules d'abonnement et leurs limites (M01). Une formule n'est jamais supprimée : on la désactive. */
class PlanResource extends Resource
{
    protected static ?string $slug = 'formules';

    protected static ?string $model = Plan::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    protected static ?string $recordTitleAttribute = 'name';

    protected static ?string $modelLabel = 'formule';

    protected static ?string $pluralModelLabel = 'formules';

    protected static ?int $navigationSort = 4;

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Offre')->columns(2)->schema([
                TextInput::make('name')->label('Nom')->required()->maxLength(60)->unique(ignoreRecord: true),
                TextInput::make('description')->label('Description')->maxLength(255)->default(''),
                TextInput::make('price')->label('Prix (FCFA)')->required()->numeric()->minValue(0),
                Select::make('billing_period')->label('Période')->options(['monthly' => 'Par mois', 'yearly' => 'Par an'])->required()->default('monthly'),
                TextInput::make('trial_days')->label('Jours d’essai')->required()->integer()->minValue(0)->maxValue(90)->default(14),
                Toggle::make('is_recommended')->label('Mise en avant (« Le plus choisi »)'),
                Toggle::make('is_active')->label('Proposée à l’inscription')->default(true),
            ]),
            Section::make('Limites')->columns(3)->schema([
                TextInput::make('max_shops')->label('Boutiques ouvertes')->required()->integer()->minValue(1),
                TextInput::make('max_users')->label('Utilisateurs')->required()->integer()->minValue(1),
                TextInput::make('max_products')->label('Produits actifs')->required()->integer()->minValue(1),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('price')
            ->columns([
                TextColumn::make('name')->label('Formule')->description(fn (Plan $r) => $r->description),
                TextColumn::make('price')->label('Prix')->formatStateUsing(fn ($state, Plan $r) => number_format((float) $state, 0, ',', "\u{202F}").' FCFA / '.($r->billing_period === 'yearly' ? 'an' : 'mois'))->sortable(),
                TextColumn::make('max_shops')->label('Boutiques'),
                TextColumn::make('max_users')->label('Utilisateurs'),
                TextColumn::make('max_products')->label('Produits'),
                TextColumn::make('trial_days')->label('Essai')->suffix(' j'),
                TextColumn::make('subscriptions_count')->label('Espaces')->counts('subscriptions'),
                IconColumn::make('is_recommended')->label('Mise en avant')->boolean(),
                IconColumn::make('is_active')->label('Proposée')->boolean(),
            ])
            ->recordActions([EditAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPlans::route('/'),
            'create' => CreatePlan::route('/create'),
            'edit' => EditPlan::route('/{record}/edit'),
        ];
    }
}
