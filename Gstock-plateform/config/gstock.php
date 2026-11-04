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
];
