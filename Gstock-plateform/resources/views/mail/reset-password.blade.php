<x-mail::message>
# Bonjour {{ $name }},

Vous avez demandé à changer votre mot de passe GStock. Touchez le bouton ci-dessous pour en choisir un nouveau.

<x-mail::button :url="$url">
Choisir un nouveau mot de passe
</x-mail::button>

Ce lien est valable {{ $minutes }} minutes et ne sert qu'une fois.

Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.

L'équipe GStock
</x-mail::message>
