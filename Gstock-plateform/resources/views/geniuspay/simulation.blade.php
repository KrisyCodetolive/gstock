<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Paiement GeniusPay (simulation)</title>
    <style>
        body { margin: 0; font-family: system-ui, sans-serif; background: #fdf6ea; color: #1d1b4b; }
        main { max-width: 26rem; margin: 2rem auto; padding: 1.5rem; background: #fff; border: 2px solid #1d1b4b; border-radius: 12px; box-shadow: 4px 4px 0 #1d1b4b; }
        .badge { display: inline-block; padding: .2rem .6rem; border: 2px solid #b45309; border-radius: 999px; color: #b45309; font-size: .8rem; font-weight: 700; }
        h1 { font-size: 1.3rem; margin: .8rem 0 .2rem; }
        .amount { font-size: 2rem; font-weight: 800; margin: .6rem 0 1rem; }
        a.btn { display: block; margin: .5rem 0; padding: .8rem 1rem; border: 2px solid #1d1b4b; border-radius: 10px; color: #1d1b4b; font-weight: 700; text-decoration: none; }
        a.btn:hover { background: #ede9fe; }
        a.fail { border-color: #b91c1c; color: #b91c1c; }
        a.cancel { border: 0; text-align: center; font-weight: 600; }
        p.small { font-size: .85rem; color: #4b4a6b; }
    </style>
</head>
<body>
<main>
    <span class="badge">Simulation : aucun argent n'est prélevé</span>
    <h1>Abonnement GStock — {{ $invoice->plan->name }}</h1>
    <p class="small">{{ $invoice->tenant->name }} · facture {{ $invoice->reference }}</p>
    <div class="amount">{{ number_format((float) $invoice->amount, 0, ',', ' ') }} FCFA</div>
    @if ($invoice->status !== 'pending')
        <p>Ce paiement a déjà été traité.</p>
        <a class="btn" href="{{ $returnUrl }}">Revenir à Mon abonnement</a>
    @else
        <p class="small">Choisissez votre moyen de paiement :</p>
        @foreach ($channels as $channel)
            <a class="btn" href="{{ $channel['url'] }}">Payer avec {{ $channel['name'] }}</a>
        @endforeach
        <a class="btn fail" href="{{ $failUrl }}">Simuler un paiement refusé</a>
        <a class="btn cancel" href="{{ $cancelUrl }}">Annuler</a>
    @endif
</main>
</body>
</html>
