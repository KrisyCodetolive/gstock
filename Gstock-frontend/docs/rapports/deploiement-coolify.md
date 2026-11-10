# Déploiement sur Coolify

| | |
|---|---|
| **Statut** | Prêt le 10 novembre 2026, testé en local ; mise en ligne à faire selon `DEPLOIEMENT-COOLIFY.md` |
| **Branche** | `deploiement-coolify` |
| **Cahier** | §12.7 (exploitation), §12.5 (sauvegarde quotidienne), ADR-009 (un sous-domaine par espace) |

## Commits

| Commit | Contenu |
|---|---|
| `feat(api)` | Proxys de confiance (`trustProxies(at: '*')`) ; migrations lancées par le seul conteneur `app` (`CONTAINER_ROLE`) |
| `feat(front)` | Image de production (build Vite servi par Caddy) ; domaine principal fixé au build (`VITE_CENTRAL_DOMAIN`) |
| `feat(deploy)` | `docker-compose.coolify.yml` (db, api, worker, web, backup) et image de sauvegarde |
| `docs` | Feuille de route `DEPLOIEMENT-COOLIFY.md`, ce rapport, README, CLAUDE.md |

## Architecture livrée

- **web** (`Gstock-frontend/Dockerfile`, `docker/Caddyfile`) : la PWA construite, servie par Caddy. `/api/*`, `/sanctum/*` et `/storage/*` sont transmis à `api:8080` avec le Host d'origine : le frontend et l'API restent sur la même origine (cookies Sanctum, espace reconnu au sous-domaine). `index.html`, `sw.js` et le manifeste sont toujours revalidés ; `/assets/*` en cache long.
- **api** : l'image existante (FrankenPHP). Migrations et `PlanSeeder` au démarrage. Sert aussi le back-office sur `admin.<domaine>`.
- **worker** : même image, `queue:work` (e-mails mis en file : mot de passe oublié). Ne migre pas.
- **db** : PostgreSQL 16, volume `gstock-pgsql`.
- **backup** : `pg_dump` au démarrage puis toutes les 24 h, gardé 14 jours (`BACKUP_KEEP_DAYS`).
- **Routage** : labels Traefik dans le compose. `Host(domaine) || HostRegexp(^[a-z0-9-]+\.domaine)` vers web (priorité 10), `Host(admin.domaine)` vers api (priorité 100). Certificat joker demandé par le routeur web (`tls.domains`), d'où le défi DNS obligatoire sur le proxy de Coolify.

## Décisions

| Sujet | Décision |
|---|---|
| Sous-domaines | Routage par labels Traefik écrits dans le compose, champs « Domains » de Coolify laissés vides (Coolify ne sait pas mettre un joker dans ce champ). |
| Certificat | Joker par défi DNS Cloudflare (seul moyen pour `*.domaine`). |
| Base de données | Dans le compose plutôt qu'une base Coolify séparée : pas de réseau partagé à régler ; la sauvegarde est assurée par le service `backup`. |
| Proxys de confiance | `trustProxies(at: '*')` : sans lui, les liens générés sont en `http://`, et toutes les requêtes partagent l'IP du proxy pour la limitation des connexions (10 par minute pour tout le monde). L'API n'est jamais exposée directement. |
| Domaine principal côté front | `isCentralHost()` lit `VITE_CENTRAL_DOMAIN` s'il est fixé, ce qui permet un domaine à plus de deux niveaux ; sinon l'ancienne règle. |
| `MAIL_FROM_ADDRESS` | Obligatoire dans le compose : vide, chaque e-mail échoue dans la file (« An email must have a From »), cas vu pendant le test. |

## Vérifications

- Pile complète lancée en local avec le compose de production (port publié pour le test) : 5 services démarrés, `api` et `web` healthy.
- Inscription d'un espace, connexion centrale, connexion par cookie sur le sous-domaine (cookies `secure`, `X-Forwarded-Proto: https`), `/me`.
- Back-office sur `admin.<domaine>` : page de connexion, ressources Filament en `https://`.
- Mot de passe oublié : tâche traitée par `worker` (`DONE`).
- Sauvegarde créée dans `/backups`.
- `composer test` : 115 tests passés ; `tsc` (application et service worker) sans erreur.

## Limites

- Non testé sur un vrai Coolify : routage joker et défi DNS à confirmer à la mise en ligne (étape 8 de la feuille de route).
- Paiement de l'abonnement impossible en production tant que le pilote GeniusPay réel n'existe pas.
- Pas d'ordonnanceur (aucune tâche planifiée dans le code).
- Sauvegardes sur le même serveur que la base.
