<?php

namespace App\Domain\Platform\Registration;

use App\Domain\Platform\Actions\ProvisionTenant;
use App\Domain\Platform\Models\Plan;
use App\Domain\Platform\Models\Tenant;
use App\Support\ApiException;
use App\Support\Phone;
use Illuminate\Support\Str;

/**
 * Inscription d'un commerçant sur le domaine principal (M00) : vérification de
 * l'adresse (sous-domaine), provisionnement de l'espace, lien de connexion.
 */
final class RegistrationService
{
    /** Sous-domaines réservés à la plateforme (site, back-office, API…). */
    public const RESERVED = ['www', 'admin', 'api', 'app', 'mail', 'support', 'aide', 'help', 'blog', 'static', 'cdn', 'gstock', 'genius', 'demo', 'status'];

    public function __construct(private ProvisionTenant $provision, private LoginLinks $links) {}

    public function slugProblem(string $slug): ?string
    {
        if (strlen($slug) < 3 || strlen($slug) > 30) {
            return "L'adresse doit faire entre 3 et 30 caractères.";
        }
        if (! preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug)) {
            return 'Utilisez seulement des lettres minuscules sans accent, des chiffres et des tirets.';
        }
        if (in_array($slug, self::RESERVED, true)) {
            return 'Cette adresse est réservée. Choisissez-en une autre.';
        }
        if (Tenant::query()->where('slug', $slug)->exists()) {
            return 'Cette adresse est déjà prise par un autre commerce.';
        }

        return null;
    }

    /** Adresse libre la plus proche : « alimentation-kone-2 »… */
    public function suggestion(string $base): ?string
    {
        $root = rtrim(substr(Str::slug($base), 0, 30), '-') ?: 'ma-boutique';
        if (! $this->slugProblem($root)) {
            return $root;
        }
        for ($n = 2; $n < 100; $n++) {
            $candidate = rtrim(substr($root, 0, 27), '-')."-{$n}";
            if (! $this->slugProblem($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /** @return array{tenant: array{name: string, slug: string, url: string}, login_url: string} */
    public function register(array $in): array
    {
        $text = fn (string $k) => is_string($in[$k] ?? null) ? trim($in[$k]) : '';
        $slug = mb_strtolower($text('slug'));
        $phone = Phone::normalize($text('phone')) ?? '';
        $email = mb_strtolower($text('email'));
        $password = is_string($in['password'] ?? null) ? $in['password'] : '';
        $plan = Plan::query()->where('is_active', true)->find((int) ($in['plan_id'] ?? 0));

        $errors = [];
        $require = function (string $field, string $message) use (&$errors, $text) {
            if ($text($field) === '') {
                $errors[$field] = [$message];
            }
        };
        $require('tenant_name', 'Saisissez le nom de votre commerce.');
        if ($problem = $slug === '' ? 'Choisissez l’adresse de votre espace.' : $this->slugProblem($slug)) {
            $errors['slug'] = [$problem];
        }
        $require('shop_name', 'Donnez un nom à votre boutique.');
        $require('shop_city', 'Indiquez la ville de la boutique.');
        $require('firstname', 'Saisissez votre prénom.');
        $require('lastname', 'Saisissez votre nom.');
        if (! preg_match('/^0\d{9}$/', $phone)) {
            $errors['phone'] = ['Saisissez un numéro à 10 chiffres, par exemple 07 00 00 00 00.'];
        }
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = ['Saisissez une adresse e-mail valide.'];
        }
        if (mb_strlen($password) < 6) {
            $errors['password'] = ['Le mot de passe doit faire au moins 6 caractères.'];
        }
        if (! $plan) {
            $errors['plan_id'] = ['Choisissez une formule.'];
        }
        if ($errors) {
            throw new ApiException(422, 'Les informations saisies ne sont pas valides.', $errors);
        }

        ['tenant' => $tenant, 'owner' => $owner] = $this->provision->handle([
            'name' => $text('tenant_name'),
            'slug' => $slug,
            'phone' => $phone,
            'plan' => $plan,
            'shop' => ['name' => $text('shop_name'), 'city' => $text('shop_city')],
            'owner' => ['firstname' => $text('firstname'), 'lastname' => $text('lastname'), 'email' => $email, 'phone' => $phone, 'password' => $password],
        ]);
        $url = str_replace('{tenant}', $slug, config('gstock.frontend_url'));

        return [
            'tenant' => ['name' => $tenant->name, 'slug' => $slug, 'url' => $url],
            'login_url' => $url.'/connexion/lien?jeton='.$this->links->issue($tenant->id, $owner->id),
        ];
    }
}
