# Déployer GStock sur Coolify

Feuille de route à suivre dans l'ordre. Compter environ 1 h 30, dont 10 min de premier build.

Tout est déjà prêt dans le dépôt : `docker-compose.coolify.yml` (racine), les images
`Gstock-plateform/Dockerfile` (API), `Gstock-frontend/Dockerfile` (application) et
`Gstock-plateform/docker/backup/` (sauvegardes). Testé en local le 10 novembre 2026 :
inscription, connexion centrale, connexion par cookie sur le sous-domaine, back-office,
envoi d'e-mail par la file d'attente, sauvegarde.

## Ce qui sera en ligne

| Adresse | Service | Rôle |
|---|---|---|
| `https://gstock.app` | web | Accueil, connexion centrale, inscription |
| `https://<espace>.gstock.app` | web | L'application d'un espace (un sous-domaine par espace) |
| `https://admin.gstock.app` | api | Back-office Filament de Genius Groups |
| (interne) | api | API Laravel, reçoit `/api`, `/sanctum` et `/storage` depuis web |
| (interne) | worker | File d'attente (e-mails) |
| (interne) | db | PostgreSQL 16 |
| (interne) | backup | Sauvegarde quotidienne de la base, gardée 14 jours |

`gstock.app` est un exemple. Remplacez-le partout par votre domaine (`APP_DOMAIN`).

> **La seule vraie difficulté : les sous-domaines.** Chaque espace a son propre sous-domaine.
> Il faut donc un **certificat joker** `*.gstock.app`, que Let's Encrypt ne délivre que par
> **défi DNS**. Le chemin le plus court est d'avoir le DNS du domaine chez **Cloudflare**
> (gratuit). Si votre DNS est ailleurs, transférez les serveurs DNS vers Cloudflare avant de
> commencer : c'est 10 minutes, et ça vous évite tout le reste des détours.

---

## Étape 1 : le serveur

- [ ] Un VPS **Ubuntu 24.04**, **4 Go de RAM**, 2 vCPU, 40 Go de disque au moins.
      Le build du frontend et de l'API se fait sur le serveur : avec 2 Go, il échoue souvent par manque de mémoire.
- [ ] Ports ouverts : 22, 80, 443, 8000.
- [ ] Installer Coolify (en root) :

  ```bash
  curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
  ```

- [ ] Ouvrir `http://IP_DU_SERVEUR:8000` et créer le compte administrateur de Coolify.
      Choisir « localhost » comme serveur quand l'assistant le demande.

## Étape 2 : le DNS (Cloudflare)

- [ ] Dans la zone `gstock.app`, créer deux enregistrements, **tous les deux en « DNS only »
      (nuage gris)** :

  | Type | Nom | Contenu | Proxy |
  |---|---|---|---|
  | A | `@` | IP du serveur | DNS only |
  | A | `*` | IP du serveur | DNS only |

  `admin.gstock.app` et les espaces sont couverts par `*`.
- [ ] Créer un jeton d'API : Cloudflare > My Profile > API Tokens > Create Token > modèle
      **« Edit zone DNS »** > Zone Resources : *Include / Specific zone / gstock.app* > Create.
      Copier le jeton (il n'est affiché qu'une fois).

## Étape 3 : le certificat joker dans Coolify

- [ ] Coolify > **Servers** > localhost > **Proxy** > Configuration. Vérifier que le proxy est
      **Traefik v3** (l'image affichée est `traefik:v3.x`). Les labels du compose sont écrits pour la v3.
- [ ] Dans le fichier affiché, sous `services: traefik:` :
  - dans `environment:`, ajouter :

    ```yaml
    - CF_DNS_API_TOKEN=le_jeton_cloudflare
    ```

  - dans `command:`, **supprimer** ces deux lignes :

    ```yaml
    - '--certificatesresolvers.letsencrypt.acme.httpchallenge=true'
    - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http'
    ```

    et **ajouter** :

    ```yaml
    - '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=cloudflare'
    - '--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=0'
    ```

    (garder la ligne `...acme.storage=/traefik/acme.json` existante).
- [ ] **Save**, puis **Restart Proxy**.

## Étape 4 : l'accès au dépôt privé GitHub

Le dépôt est `GENIUS-GROUPS-SAS/Gstock-SAAS`, dans une organisation : il faut être
**propriétaire de l'organisation** sur GitHub (ou le faire faire par quelqu'un qui l'est).

- [ ] Coolify > **Sources** > **+ Add** > **GitHub App**.
- [ ] Nom : `coolify-gstock`. Cocher **Organization** et saisir `GENIUS-GROUPS-SAS`. Continuer.
- [ ] **Register Now** : GitHub s'ouvre, valider la création de l'application.
- [ ] Ensuite **Install Repositories on GitHub** : choisir l'organisation, **Only select
      repositories** > `Gstock-SAAS` > Install. On revient sur Coolify, la source est verte.

La GitHub App fait aussi le déploiement automatique à chaque `push` sur `main`.

## Étape 5 : créer l'application

- [ ] Coolify > **Projects** > **+ Add** > nom `GStock` > environnement `production`.
- [ ] **+ New** > **Private Repository (with GitHub App)** > choisir `coolify-gstock` > dépôt `Gstock-SAAS`.
- [ ] Remplir :

  | Champ | Valeur |
  |---|---|
  | Branch | `main` |
  | Build Pack | **Docker Compose** |
  | Base Directory | `/` |
  | Docker Compose Location | `/docker-compose.coolify.yml` |

- [ ] **Continue**. Coolify lit le compose et affiche les 5 services.
- [ ] **Ne rien saisir dans les champs « Domains » des services**, laisser vides. Le routage
      est déjà écrit dans le compose (labels Traefik). Un domaine saisi ici créerait un second
      routage en conflit.

## Étape 6 : les variables

Dans l'application > **Environment Variables** (mode **Developer view** pour coller d'un coup).

Générer les deux secrets sur votre machine :

```bash
echo "base64:$(openssl rand -base64 32)"   # APP_KEY
openssl rand -hex 24                         # DB_PASSWORD
```

```env
APP_DOMAIN=gstock.app
APP_KEY=base64:...............
DB_PASSWORD=...............
MAIL_FROM_ADDRESS=noreply@gstock.app

# E-mails (mot de passe oublié, relances). Exemple Brevo ; Resend, Mailgun, etc. marchent pareil.
MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=...
MAIL_PASSWORD=...
```

- [ ] `APP_DOMAIN` : le domaine **sans** `https://` ni `/`.
- [ ] **Sauvegarder `APP_KEY` et `DB_PASSWORD` dans un gestionnaire de mots de passe.**
  - Ne **jamais** changer `APP_KEY` ensuite : les clés GeniusPay des boutiques sont chiffrées avec.
  - Ne **jamais** changer `DB_PASSWORD` après le premier déploiement : la base garde le mot de passe du premier démarrage.
- [ ] Pas de SMTP pour l'instant ? Mettre `MAIL_MAILER=log` : tout marche sauf la réception
      des e-mails (le lien de mot de passe oublié n'arrive pas).
- [ ] Ne pas mettre `GENIUSPAY_PLATFORM_*` pour l'instant (voir « Limites »).

## Étape 7 : déployer

- [ ] **Deploy**. Le premier build prend 5 à 10 minutes. Suivre les logs du déploiement.
- [ ] À la fin, les services `db`, `api` et `web` sont **healthy**, `worker` et `backup` sont **running**.
      Au démarrage, `api` applique les migrations et crée les formules d'abonnement tout seul.

## Étape 8 : vérifier (5 minutes)

- [ ] `https://admin.gstock.app/health` affiche `{"status":"ok","database":"ok"}`.
- [ ] `https://gstock.app` affiche l'écran de connexion, avec un cadenas valide.
- [ ] Créer un vrai espace par **Créer mon espace**. On arrive sur `https://<espace>.gstock.app`,
      connecté, et le certificat est valide (c'est le certificat joker).
- [ ] Se déconnecter, se reconnecter sur `https://gstock.app` : la connexion centrale renvoie vers l'espace.
- [ ] Mot de passe oublié : l'e-mail arrive (si SMTP configuré).

## Étape 9 : le compte du back-office

Le back-office n'a aucun compte au départ. Par SSH sur le serveur :

```bash
docker ps --format '{{.Names}}' | grep '^api-'          # nom du conteneur de l'API
docker exec -it <nom_du_conteneur_api> php artisan gstock:admin vous@genius-groups.ci
```

Il demande un nom puis un mot de passe de 12 caractères au moins. Se connecter ensuite sur
`https://admin.gstock.app`.

## Étape 10 : après la mise en ligne

- [ ] **Déploiements suivants** : `git push` sur `main` suffit (déploiement automatique). Les
      migrations sont appliquées au démarrage de `api`.
- [ ] **Sauvegardes** : une par jour dans le volume `…_gstock-backups`, gardées 14 jours
      (`BACKUP_KEEP_DAYS` pour changer). Elles sont **sur le même serveur** : en copier une
      ailleurs régulièrement. Pour les voir :

  ```bash
  docker ps --format '{{.Names}}' | grep '^backup-'
  docker exec <conteneur_backup> ls -lh /backups
  ```

  Restaurer une sauvegarde (écrase la base) :

  ```bash
  docker exec <conteneur_backup> pg_restore --clean --if-exists -d gstock /backups/gstock-AAAA-MM-JJ-HHMM.dump
  ```

- [ ] Facultatif : fermer le port 8000 et donner un domaine à Coolify lui-même
      (Settings > Instance Domain, ex. `https://coolify.gstock.app`).

---

## Si quelque chose ne marche pas

| Symptôme | Cause probable | Que faire |
|---|---|---|
| Le build s'arrête sans message clair, « Killed » | Mémoire insuffisante | Serveur de 4 Go, ou ajouter 2 Go de swap |
| Coolify refuse de déployer, variable manquante | Une variable obligatoire est vide | `APP_DOMAIN`, `APP_KEY`, `DB_PASSWORD`, `MAIL_FROM_ADDRESS` |
| « 404 page not found » en texte brut | Traefik ne voit pas les routes | Vérifier que les champs « Domains » sont **vides**, que le proxy est en v3, redéployer |
| Certificat invalide ou « TRAEFIK DEFAULT CERT » | Défi DNS raté | Servers > Proxy > Logs, chercher `acme` : jeton Cloudflare, lignes `dnschallenge` |
| « Cet espace n'existe pas » sur le domaine principal | `APP_DOMAIN` mal saisi | Domaine exact, sans `https://` ni `www`, puis redéployer |
| Connexion qui boucle, « session expirée » | Accès en `http://` | Toujours passer par `https://` (le cookie est sécurisé) |
| E-mails qui n'arrivent pas | SMTP | Logs du service `worker` |

## Limites connues au moment de la mise en ligne

- **Paiement de l'abonnement** : le pilote GeniusPay réel n'existe pas encore. Les nouveaux espaces
  ont leurs 14 jours d'essai, mais le bouton « Payer » de « Mon abonnement » renverra une erreur
  tant que le pilote n'est pas développé. Ne pas mettre `GENIUSPAY_PLATFORM_DRIVER=simulation` en
  production : c'est refusé exprès.
- **Ordonnanceur** : aucune tâche planifiée n'existe encore dans le code, donc pas de conteneur
  `scheduler`. Ajouter un service `php artisan schedule:work` le jour où il y en aura.
- **Sauvegardes** sur le même disque que la base : à copier ailleurs (S3, autre serveur).
