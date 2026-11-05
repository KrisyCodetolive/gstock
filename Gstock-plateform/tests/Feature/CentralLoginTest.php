<?php

namespace Tests\Feature;

use App\Domain\Identity\Models\User;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/** Connexion sur le domaine principal (ADR-009) : l'espace est trouvé à partir du compte. */
class CentralLoginTest extends TestCase
{
    public function test_one_account_is_sent_to_its_space_already_logged_in(): void
    {
        $this->createTenant('kone');

        $spaces = $this->central(['login' => 'OWNER@example.ci', 'password' => 'secret123'])->assertOk()->json('data.spaces');
        $this->assertCount(1, $spaces);
        $this->assertSame('kone', $spaces[0]['slug']);
        $this->assertStringContainsString('/connexion/lien?jeton=', $spaces[0]['login_url']);

        // Le lien ouvre l'espace, une seule fois.
        $token = substr($spaces[0]['login_url'], strpos($spaces[0]['login_url'], 'jeton=') + 6);
        $this->api('kone', 'POST', '/auth/token-login', ['token' => $token])->assertOk()->assertJsonPath('data.user.firstname', 'Awa');
        $this->api('kone', 'POST', '/auth/token-login', ['token' => $token])->assertUnprocessable();
    }

    public function test_spaces_are_only_revealed_with_the_right_password(): void
    {
        ['tenant' => $kone] = $this->createTenant('kone');
        $this->createTenant('bamba', email: 'owner@example.ci', phone: '0700000001');
        // Même personne, autre mot de passe dans un troisième espace : il n'est pas proposé.
        ['tenant' => $other] = $this->createTenant('autre', email: 'x@example.ci', phone: '0700000009');
        $this->createUser($other, [], attributes: ['email' => 'owner@example.ci', 'password' => 'autre-mot']);

        $this->central(['login' => 'owner@example.ci', 'password' => 'mauvais'])->assertUnprocessable()
            ->assertJsonPath('errors.login.0', 'E-mail, téléphone ou mot de passe incorrect.');
        $this->assertSame(['bamba', 'kone'], array_column($this->central(['login' => 'owner@example.ci', 'password' => 'secret123'])->json('data.spaces'), 'slug'));
        // Par téléphone aussi.
        $this->assertCount(2, $this->central(['login' => '07 00 00 00 01', 'password' => 'secret123'])->json('data.spaces'));

        $kone->run(fn () => User::query()->where('email', 'owner@example.ci')->update(['is_active' => false]));
        $this->assertSame(['bamba'], array_column($this->central(['login' => 'owner@example.ci', 'password' => 'secret123'])->json('data.spaces'), 'slug'));
    }

    private function central(array $data): TestResponse
    {
        return $this->json('POST', 'http://'.self::DOMAIN.'/api/v1/auth/central-login', $data);
    }
}
