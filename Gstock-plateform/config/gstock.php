<?php

// Réglages propres à GStock (cahier des charges).
return [

    /*
     * Adresse des écrans du commerçant, avec {tenant} pour le sous-domaine de l'espace.
     * Sert aux liens envoyés par e-mail (mot de passe oublié, reçus).
     */
    'frontend_url' => env('FRONTEND_URL', 'http://{tenant}.localhost:5173'),

    /* Délai de grâce après une échéance d'abonnement impayée, avant la suspension (P7 : hypothèse). */
    'grace_days' => 7,

    /* Validité d'un lien de réinitialisation du mot de passe, en minutes. */
    'password_reset_ttl' => 60,

    /* Devise et fuseau par défaut d'un nouvel espace (Afrique de l'Ouest). */
    'currency' => 'XOF',
    'timezone' => 'Africa/Abidjan',

    /* Durée de vie du lien de connexion envoyé à l'inscription, en minutes. */
    'login_link_ttl' => 10,

    /*
     * Paiement de l'abonnement par GeniusPay, avec les clés de Genius Groups (ADR-003).
     * `geniuspay` : API marchand réelle (https://pay.genius.ci/docs/api), sandbox ou
     * live selon les clés (sk_sandbox_…, sk_live_…). Choisi dès que les clés sont là.
     * `simulation` : page de paiement simulée servie par l'API (développement et
     * démonstration seulement, refusée en production).
     */
    'geniuspay' => [
        'platform' => [
            'driver' => env('GENIUSPAY_PLATFORM_DRIVER') ?: (filled(env('GENIUSPAY_PLATFORM_API_KEY', env('GENIUSPAY_API_KEY'))) ? 'geniuspay' : 'simulation'),
            'base_url' => env('GENIUSPAY_BASE_URL', 'https://pay.genius.ci/api/v1/merchant'),
            'api_key' => env('GENIUSPAY_PLATFORM_API_KEY', env('GENIUSPAY_API_KEY')),
            'api_secret' => env('GENIUSPAY_PLATFORM_API_SECRET', env('GENIUSPAY_API_SECRET')),
            // Secret qui signe les webhooks (whsec_…), donné une seule fois par GeniusPay à la création
            // du webhook : `php artisan gstock:geniuspay-webhook <url>`. Sans lui, tout webhook est refusé.
            'webhook_secret' => env('GENIUSPAY_PLATFORM_WEBHOOK_SECRET', env('GENIUSPAY_WEBHOOK_SECRET')),
        ],
    ],

    /* Back-office de Genius Groups (M01) : `admin.gstock.app` en production, `/admin` sur tout domaine sinon. */
    'admin' => [
        'domain' => env('ADMIN_DOMAIN'),
        'path' => env('ADMIN_PATH', 'admin'),
    ],

    /* Retour de la page de paiement : « Mon abonnement » de l'espace. */
    'subscription_return_path' => '/parametres/abonnement',
];
