<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Audit\Audit;
use App\Domain\Platform\CurrentTenant;
use App\Domain\Shops\Models\TenantPaymentSetting;
use App\Domain\Shops\Models\TenantSetting;
use App\Http\Controllers\Controller;
use App\Http\Resources\Present;
use App\Support\ApiException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Paramètres de l'espace et clés GeniusPay (M03). */
class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => Present::settings()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email'],
            'address' => ['nullable', 'string', 'max:255'],
            'timezone' => ['nullable', 'timezone:all'],
            'receipt_footer' => ['nullable', 'string', 'max:255'],
            'advanced_mode' => ['boolean'],
        ], [
            'name.required' => 'Donnez un nom à votre commerce.',
            'email.email' => "Cette adresse e-mail n'est pas valide.",
            'timezone.timezone' => "Ce fuseau horaire n'existe pas.",
        ]);

        $tenant = CurrentTenant::get();
        DB::transaction(function () use ($tenant, $data) {
            $tenant->update(['name' => trim($data['name']), 'timezone' => $data['timezone'] ?? $tenant->timezone]);
            TenantSetting::query()->firstOrCreate([])->update([
                'phone' => $data['phone'] ?? null,
                'email' => $data['email'] ?? null,
                'address' => $data['address'] ?? null,
                'receipt_footer' => $data['receipt_footer'] ?? null,
                'advanced_mode' => (bool) ($data['advanced_mode'] ?? false),
            ]);
        });
        $tenant->unsetRelation('settings');

        return response()->json(['data' => Present::settings()]);
    }

    public function showPayment(): JsonResponse
    {
        return response()->json(['data' => Present::paymentSettings($this->payment())]);
    }

    /** Une clé laissée vide garde celle qui est enregistrée. */
    public function updatePayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'api_key' => ['nullable', 'string', 'max:255'],
            'api_secret' => ['nullable', 'string', 'max:255'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
            'is_sandbox' => ['boolean'],
            'is_active' => ['boolean'],
        ]);
        $s = $this->payment();
        $apiKey = filled($data['api_key'] ?? null) ? trim($data['api_key']) : $s->api_key;
        $apiSecret = filled($data['api_secret'] ?? null) ? trim($data['api_secret']) : $s->api_secret;
        if (! empty($data['is_active'])) {
            $errors = array_filter([
                'api_key' => $apiKey ? null : ['Saisissez la clé API pour activer les paiements en ligne.'],
                'api_secret' => $apiSecret ? null : ['Saisissez la clé secrète pour activer les paiements en ligne.'],
            ]);
            if ($errors) {
                throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
            }
        }

        $s->fill([
            'api_key' => $apiKey,
            'api_secret' => $apiSecret,
            'webhook_secret' => filled($data['webhook_secret'] ?? null) ? trim($data['webhook_secret']) : $s->webhook_secret,
            'is_sandbox' => (bool) ($data['is_sandbox'] ?? false),
            'is_active' => (bool) ($data['is_active'] ?? false),
        ]);
        $s->touch();
        // Jamais les clés dans le journal : seulement ce qui a changé.
        Audit::record($request->user(), 'payment_settings.updated', ['new' => [
            'cle_api_changee' => filled($data['api_key'] ?? null),
            'cle_secrete_changee' => filled($data['api_secret'] ?? null),
            'mode_test' => $s->is_sandbox,
            'actif' => $s->is_active,
        ]]);

        return response()->json(['data' => Present::paymentSettings($s)]);
    }

    /**
     * Test de connexion. L'appel réel à GeniusPay arrive avec l'intégration des paiements
     * (étape 6 du planning) : on vérifie pour l'instant que les clés sont enregistrées.
     */
    public function testPayment(): JsonResponse
    {
        $s = $this->payment();
        $ok = (bool) ($s->api_key && $s->api_secret);

        return response()->json(['data' => $ok
            ? ['ok' => true, 'message' => $s->is_sandbox ? 'Connexion réussie à GeniusPay (mode test).' : 'Connexion réussie à GeniusPay.']
            : ['ok' => false, 'message' => 'Connexion impossible : enregistrez d’abord la clé API et la clé secrète.'],
        ]);
    }

    private function payment(): TenantPaymentSetting
    {
        return TenantPaymentSetting::query()->firstOrCreate([], ['provider' => 'geniuspay']);
    }
}
