<?php

namespace App\Console\Commands;

use App\Domain\Platform\Billing\GeniusPayPlatformGateway;
use App\Support\ApiException;
use Illuminate\Console\Command;

/**
 * Déclare chez GeniusPay le webhook des abonnements (ADR-003) et affiche son
 * secret, à mettre dans GENIUSPAY_WEBHOOK_SECRET. GeniusPay ne le donne qu'une fois.
 */
class RegisterGeniusPayWebhook extends Command
{
    protected $signature = 'gstock:geniuspay-webhook {url? : Adresse publique, ex. https://gstock.app/api/v1/webhooks/geniuspay/platform} {--list : Afficher les webhooks déclarés}';

    protected $description = 'Déclare le webhook des abonnements chez GeniusPay et affiche son secret';

    public function handle(): int
    {
        try {
            $gateway = GeniusPayPlatformGateway::fromConfig();
            if ($this->option('list') || ! $this->argument('url')) {
                $hooks = $gateway->webhooks();
                $this->table(['id', 'nom', 'adresse', 'événements', 'actif'], array_map(fn ($h) => [
                    $h['id'] ?? '', $h['name'] ?? '', $h['url'] ?? '', implode(', ', (array) ($h['events'] ?? [])), ($h['is_active'] ?? true) ? 'oui' : 'non',
                ], array_is_list($hooks) ? $hooks : []));

                return self::SUCCESS;
            }

            $url = (string) $this->argument('url');
            if (! str_starts_with($url, 'https://')) {
                $this->error('GeniusPay doit pouvoir joindre l’adresse : donnez une adresse publique en https://.');

                return self::FAILURE;
            }
            $hook = $gateway->createWebhook($url);
        } catch (ApiException|\RuntimeException $e) {
            $this->error($e->getMessage().' (détails dans les journaux)');

            return self::FAILURE;
        }

        $secret = $hook['secret'] ?? $hook['webhook_secret'] ?? $hook['signing_secret'] ?? null;
        $this->info("Webhook déclaré ({$url}) pour : ".implode(', ', GeniusPayPlatformGateway::WEBHOOK_EVENTS).'.');
        if ($secret) {
            $this->line('Ajoutez cette ligne aux variables d’environnement de l’API (GeniusPay ne la redonnera pas) :');
            $this->line("GENIUSPAY_WEBHOOK_SECRET={$secret}");
        } else {
            $this->warn('Le secret n’apparaît pas dans la réponse : récupérez-le dans le dashboard GeniusPay.');
            $this->line(json_encode($hook, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        }

        return self::SUCCESS;
    }
}
