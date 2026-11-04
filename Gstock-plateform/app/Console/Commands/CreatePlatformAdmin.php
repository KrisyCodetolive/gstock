<?php

namespace App\Console\Commands;

use App\Domain\Platform\Models\PlatformAdmin;
use Illuminate\Console\Command;

/** Crée ou réactive un compte du back-office de Genius Groups (M01). */
class CreatePlatformAdmin extends Command
{
    protected $signature = 'gstock:admin {email : E-mail de connexion} {--name= : Nom affiché}';

    protected $description = 'Crée (ou réactive) un compte super-admin du back-office';

    public function handle(): int
    {
        $email = mb_strtolower(trim($this->argument('email')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->error('Adresse e-mail invalide.');

            return self::FAILURE;
        }
        $name = $this->option('name') ?: $this->ask('Nom affiché', strstr($email, '@', true));
        $password = (string) $this->secret('Mot de passe (12 caractères au moins)');
        if (mb_strlen($password) < 12) {
            $this->error('Le mot de passe doit faire au moins 12 caractères.');

            return self::FAILURE;
        }
        $admin = PlatformAdmin::query()->updateOrCreate(['email' => $email], ['name' => $name, 'password' => $password, 'is_active' => true]);
        $this->info("Compte {$admin->email} prêt : ".url(config('gstock.admin.path')));

        return self::SUCCESS;
    }
}
