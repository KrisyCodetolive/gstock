<?php

namespace App\Filament\Resources\Plans\Pages;

use App\Domain\Platform\Admin\PlatformAudit;
use App\Filament\Resources\Plans\PlanResource;
use App\Filament\Support\AdminAction;
use Filament\Resources\Pages\EditRecord;

/** Pas de suppression : une formule utilisée se désactive. */
class EditPlan extends EditRecord
{
    protected static string $resource = PlanResource::class;

    private array $before = [];

    protected function beforeSave(): void
    {
        $this->before = $this->record->getOriginal();
    }

    protected function afterSave(): void
    {
        $changed = array_keys($this->record->getChanges());
        $keys = array_values(array_diff($changed, ['updated_at']));
        if (! $keys) {
            return;
        }
        PlatformAudit::record(AdminAction::admin(), 'plan.updated', options: [
            'subject_type' => 'plan', 'subject_id' => $this->record->id, 'label' => $this->record->name,
            'old' => array_intersect_key($this->before, array_flip($keys)), 'new' => $this->record->only($keys),
        ]);
    }
}
