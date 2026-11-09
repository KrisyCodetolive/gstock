<?php

namespace Tests\Feature;

use App\Domain\Audit\Models\AuditLog;
use App\Domain\Identity\Mail\ResetPasswordLink;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Connexion, profil et mot de passe oublié (M02). */
class AuthTest extends TestCase
{
    public function test_login_by_email_or_phone_returns_the_session(): void
    {
        ['owner' => $owner, 'shop' => $shop] = $this->createTenant();

        $me = $this->api('kone', 'POST', '/auth/login', ['login' => ' OWNER@example.ci ', 'password' => 'secret123'])->assertOk();
        $me->assertJsonPath('data.user.id', $owner->id)
            ->assertJsonPath('data.role.is_owner', true)
            ->assertJsonPath('data.shops.0.id', $shop->id)
            ->assertJsonPath('data.tenant.currency', 'XOF')
            ->assertJsonPath('data.tenant.subscription.status', 'active')
            ->assertJsonCount(44, 'data.permissions');
        $this->assertNotNull($owner->fresh()->last_login_at);

        $this->api('kone', 'POST', '/auth/login', ['login' => '+225 07 00 00 00 01', 'password' => 'secret123'])->assertOk();
    }

    public function test_wrong_credentials_inactive_accounts_and_closed_spaces_are_refused(): void
    {
        ['tenant' => $tenant] = $this->createTenant();
        $this->createUser($tenant, ['sales.view'], attributes: ['email' => 'paul@example.ci', 'is_active' => false]);

        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'mauvais'])
            ->assertUnprocessable()->assertJsonPath('message', 'Identifiants incorrects.');
        $this->api('kone', 'POST', '/auth/login', ['login' => '', 'password' => ''])
            ->assertUnprocessable()
            ->assertJsonPath('errors.login.0', 'Saisissez votre e-mail ou votre numéro de téléphone.')
            ->assertJsonPath('errors.password.0', 'Saisissez votre mot de passe.');
        $this->api('kone', 'POST', '/auth/login', ['login' => 'paul@example.ci', 'password' => 'secret123'])
            ->assertJsonPath('errors.login.0', 'Ce compte est désactivé. Demandez au propriétaire de la boutique de le réactiver.');

        $tenant->update(['status' => 'cancelled']);
        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'secret123'])
            ->assertJsonPath('errors.login.0', 'Cet espace est fermé. Contactez le support GStock.');
    }

    public function test_me_requires_a_session_and_logout_ends_it(): void
    {
        $this->createTenant();
        $this->api('kone', 'GET', '/me')->assertUnauthorized()->assertJsonPath('message', 'Votre session a expiré. Reconnectez-vous.');
        // Même sans « Accept: application/json » : 401 en JSON, pas de redirection.
        $this->get('http://kone.'.self::DOMAIN.'/api/v1/me')->assertUnauthorized()->assertJsonPath('message', 'Votre session a expiré. Reconnectez-vous.');

        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'secret123'])->assertOk();
        $this->api('kone', 'GET', '/me')->assertOk();
        $this->api('kone', 'POST', '/auth/logout')->assertNoContent();
        // En test, l'application ne repart pas de zéro entre deux requêtes : on oublie l'utilisateur gardé en mémoire.
        $this->app['auth']->forgetGuards();
        $this->api('kone', 'GET', '/me')->assertUnauthorized();
    }

    public function test_forgot_password_answers_the_same_and_the_link_works_once(): void
    {
        Mail::fake();
        ['owner' => $owner] = $this->createTenant();
        $message = "Si un compte utilise cette adresse, un lien pour choisir un nouveau mot de passe vient d'y être envoyé. Il est valable 60 minutes.";

        $this->api('kone', 'POST', '/auth/forgot-password', ['email' => 'personne@example.ci'])->assertOk()->assertJsonPath('data.message', $message);
        Mail::assertNothingQueued();
        $this->api('kone', 'POST', '/auth/forgot-password', ['email' => 'pas-un-mail'])->assertJsonPath('errors.email.0', "Cette adresse e-mail n'est pas valide.");

        $this->api('kone', 'POST', '/auth/forgot-password', ['email' => 'owner@example.ci'])->assertOk()->assertJsonPath('data.message', $message);
        $token = null;
        Mail::assertQueued(ResetPasswordLink::class, function (ResetPasswordLink $mail) use (&$token) {
            $this->assertStringStartsWith('http://kone.localhost:5173/reinitialiser-mot-de-passe?jeton=', $mail->url);
            $token = explode('jeton=', $mail->url)[1];

            return true;
        });

        $this->api('kone', 'POST', '/auth/reset-password', ['token' => $token, 'password' => 'nouveau123', 'password_confirmation' => 'autre'])
            ->assertJsonPath('errors.password.0', 'Les deux mots de passe ne sont pas identiques.');
        $this->api('kone', 'POST', '/auth/reset-password', ['token' => $token, 'password' => 'nouveau123', 'password_confirmation' => 'nouveau123'])->assertNoContent();
        $this->api('kone', 'POST', '/auth/reset-password', ['token' => $token, 'password' => 'encore1234', 'password_confirmation' => 'encore1234'])
            ->assertUnprocessable()->assertJsonPath('message', 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.');

        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'secret123'])->assertUnprocessable();
        $this->api('kone', 'POST', '/auth/login', ['login' => 'owner@example.ci', 'password' => 'nouveau123'])->assertOk();
        $this->assertTrue(AuditLog::query()->withoutGlobalScopes()->where('action', 'user.password_reset')->where('user_id', $owner->id)->exists());
    }

    public function test_an_expired_reset_link_is_refused(): void
    {
        Mail::fake();
        $this->createTenant();
        $this->api('kone', 'POST', '/auth/forgot-password', ['email' => 'owner@example.ci']);
        $token = null;
        Mail::assertQueued(ResetPasswordLink::class, function ($mail) use (&$token) {
            $token = explode('jeton=', $mail->url)[1];

            return true;
        });

        $this->travel(61)->minutes();
        $this->api('kone', 'POST', '/auth/reset-password', ['token' => $token, 'password' => 'nouveau123', 'password_confirmation' => 'nouveau123'])
            ->assertUnprocessable();
    }

    public function test_profile_update_password_change_and_avatar(): void
    {
        Storage::fake('public');
        ['tenant' => $tenant, 'owner' => $owner] = $this->createTenant();
        $this->createUser($tenant, ['sales.view'], attributes: ['phone' => '0700000099']);

        $this->api('kone', 'PUT', '/me', ['firstname' => 'Aminata', 'lastname' => 'Koné', 'email' => 'owner@example.ci', 'phone' => '07 00 00 00 99'], as: $owner)
            ->assertJsonPath('errors.phone.0', 'Ce numéro est déjà utilisé par un autre utilisateur.');
        $this->api('kone', 'PUT', '/me', ['firstname' => 'Aminata', 'lastname' => 'Koné', 'email' => '', 'phone' => ''], as: $owner)
            ->assertJsonPath('errors.email.0', 'Gardez un e-mail ou un numéro de téléphone pour vous connecter.');
        $this->api('kone', 'PUT', '/me', ['firstname' => ' Aminata ', 'lastname' => 'Koné', 'email' => 'Aminata@Example.ci', 'phone' => '07 11 22 33 44'], as: $owner)
            ->assertOk()->assertJsonPath('data.user.firstname', 'Aminata')->assertJsonPath('data.user.email', 'aminata@example.ci')->assertJsonPath('data.user.phone', '0711223344');

        $this->api('kone', 'PUT', '/me/password', ['current_password' => 'faux', 'password' => 'nouveau123', 'password_confirmation' => 'nouveau123'], as: $owner)
            ->assertJsonPath('errors.current_password.0', 'Le mot de passe actuel est incorrect.');
        $this->api('kone', 'PUT', '/me/password', ['current_password' => 'secret123', 'password' => 'secret123', 'password_confirmation' => 'secret123'], as: $owner)
            ->assertJsonPath('errors.password.0', "Choisissez un mot de passe différent de l'actuel.");
        $this->api('kone', 'PUT', '/me/password', ['current_password' => 'secret123', 'password' => 'nouveau123', 'password_confirmation' => 'nouveau123'], as: $owner)->assertNoContent();

        $this->api('kone', 'POST', '/me/avatar', ['avatar' => UploadedFile::fake()->create('doc.txt', 1, 'text/plain')], as: $owner)
            ->assertJsonPath('errors.avatar.0', 'Choisissez une photo au format JPEG, PNG ou WebP.');
        $url = $this->api('kone', 'POST', '/me/avatar', ['avatar' => UploadedFile::fake()->image('moi.jpg', 256, 256)], as: $owner)->assertOk()->json('data.user.avatar_url');
        $this->assertStringContainsString("tenants/{$tenant->id}/avatars/", $url);
        $path = $owner->fresh()->avatar_path;
        Storage::disk('public')->assertExists($path);
        $this->api('kone', 'DELETE', '/me/avatar', as: $owner)->assertOk()->assertJsonPath('data.user.avatar_url', null);
        Storage::disk('public')->assertMissing($path);
    }
}
