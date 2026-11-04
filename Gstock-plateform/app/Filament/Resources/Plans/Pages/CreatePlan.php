<?php

namespace App\Filament\Resources\Plans\Pages;

use App\Domain\Platform\Admin\PlatformAudit;
use App\Filament\Resources\Plans\PlanResource;
use App\Filament\Support\AdminAction;
use Filament\Resources\Pages\CreateRecord;

class CreatePlan extends CreateRecord
{
    protected static string $resource = PlanResource::class;

    protected function afterCreate(): void
    {
        PlatformAudit::record(AdminAction::admin(), 'plan.created', options: [
            'subject_type' => 'plan', 'subject_id' => $this->record->id, 'label' => $this->record->name, 'new' => $this->record->only(['price', 'max_shops', 'max_users', 'max_products', 'trial_days']),
        ]);
    }
}
