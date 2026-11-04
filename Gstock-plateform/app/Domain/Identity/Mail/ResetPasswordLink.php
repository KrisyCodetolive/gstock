<?php

namespace App\Domain\Identity\Mail;

use App\Domain\Identity\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** E-mail « Mot de passe oublié », en français (ADR-006). Envoyé par la file de tâches. */
class ResetPasswordLink extends Mailable implements ShouldQueue
{
    use Queueable;

    public function __construct(public User $user, public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Choisissez un nouveau mot de passe GStock');
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.reset-password', with: [
            'name' => $this->user->firstname,
            'url' => $this->url,
            'minutes' => config('gstock.password_reset_ttl'),
        ]);
    }
}
