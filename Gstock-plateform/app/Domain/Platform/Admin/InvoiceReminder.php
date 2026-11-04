<?php

namespace App\Domain\Platform\Admin;

use App\Domain\Platform\Models\TenantInvoice;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** Relance d'une facture d'abonnement non payée (M01). */
class InvoiceReminder extends Mailable
{
    use Queueable;

    public function __construct(public TenantInvoice $invoice, public string $url) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: "GStock : votre abonnement ({$this->invoice->reference}) reste à régler");
    }

    public function content(): Content
    {
        return new Content(text: 'mail.invoice-reminder');
    }
}
