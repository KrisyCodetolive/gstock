<?php

namespace App\Support;

use RuntimeException;

/**
 * Erreur métier renvoyée telle quelle au client, au format de l'API (§9) :
 * `{message, errors?}` avec un message en français simple.
 */
class ApiException extends RuntimeException
{
    /** @param  array<string, list<string>>  $errors */
    public function __construct(public readonly int $status, string $message, public readonly array $errors = [])
    {
        parent::__construct($message);
    }

    /** 409 : l'opération est en conflit avec l'état actuel (déjà annulée, rôle encore attribué…). */
    public static function conflict(string $message): self
    {
        return new self(409, $message);
    }

    public static function forbidden(string $message = "Vous n'avez pas accès à cette action."): self
    {
        return new self(403, $message);
    }

    /** 422 attaché à un champ, comme une erreur de validation. */
    public static function invalid(string $field, string $message): self
    {
        return new self(422, 'Les informations saisies ne sont pas valides.', [$field => [$message]]);
    }

    /** @return array{message: string, errors?: array<string, list<string>>} */
    public function body(): array
    {
        return $this->errors ? ['message' => $this->getMessage(), 'errors' => $this->errors] : ['message' => $this->getMessage()];
    }
}
