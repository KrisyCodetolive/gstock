# Mode d'emploi : mettre GStock en ligne avec Coolify, de A à Z

Ce guide part de rien (pas de serveur, pas de Coolify) et va jusqu'à l'application en ligne,
mise à jour automatiquement à chaque `git push`. Suivre les parties **dans l'ordre**, sans en
sauter : chaque partie prépare la suivante.

Durée totale : environ 2 heures, dont une partie d'attente (DNS, premier build).

Le dépôt contient déjà tout ce qu'il faut (rien à coder) :

| Fichier | Rôle |
|---|---|
| `docker-compose.coolify.yml` | Ce que Coolify déploie : base, API, file d'attente, application, sauvegardes |
| `Gstock-plateform/Dockerfile` | Image de l'API Laravel |
| `Gstock-frontend/Dockerfile` | Image de l'application (PWA) |
| `Gstock-plateform/docker/backup/` | Image des sauvegardes quotidiennes |

---

## Sommaire

- [Partie 0 : ce qu'il faut avant de commencer](#partie-0--ce-quil-faut-avant-de-commencer)
- [Partie 1 : louer le serveur](#partie-1--louer-le-serveur)
- [Partie 2 : préparer le serveur](#partie-2--préparer-le-serveur)
- [Partie 3 : mettre le domaine chez Cloudflare](#partie-3--mettre-le-domaine-chez-cloudflare)
- [Partie 4 : installer Coolify](#partie-4--installer-coolify)
- [Partie 5 : le certificat pour tous les sous-domaines](#partie-5--le-certificat-pour-tous-les-sous-domaines)
- [Partie 6 : donner à Coolify l'accès au dépôt privé](#partie-6--donner-à-coolify-laccès-au-dépôt-privé)
- [Partie 7 : préparer l'envoi des e-mails](#partie-7--préparer-lenvoi-des-e-mails)
- [Partie 8 : créer l'application dans Coolify](#partie-8--créer-lapplication-dans-coolify)
- [Partie 9 : saisir les variables](#partie-9--saisir-les-variables)
- [Partie 10 : premier déploiement](#partie-10--premier-déploiement)
- [Partie 11 : vérifier que tout marche](#partie-11--vérifier-que-tout-marche)
- [Partie 12 : créer le compte du back-office](#partie-12--créer-le-compte-du-back-office)
- [Partie 13 : la vie après la mise en ligne](#partie-13--la-vie-après-la-mise-en-ligne)
- [Dépannage](#dépannage)
- [Limites connues](#limites-connues)

---

## Ce qui sera en ligne à la fin

Dans tout le guide, **`gstock.app` est un exemple** : remplace-le par ton vrai domaine.

| Adresse | Ce qu'on y trouve |
|---|---|
| `https://gstock.app` | Accueil, connexion, « Créer mon espace » |
| `https://<espace>.gstock.app` | L'application d'un commerçant (un sous-domaine par espace, créé automatiquement à l'inscription) |
| `https://admin.gstock.app` | Le back-office de Genius Groups |

Derrière, sur le serveur, 5 conteneurs tournent :

| Service | Rôle |
|---|---|
| `web` | L'application (PWA). Transmet `/api`, `/sanctum` et `/storage` à `api` |
| `api` | L'API Laravel et le back-office. Applique les migrations à chaque démarrage |
| `worker` | Envoie les e-mails (mot de passe oublié, relances) |
| `db` | La base PostgreSQL 16 |
| `backup` | Une sauvegarde de la base par jour, gardée 14 jours |

---

## Partie 0 : ce qu'il faut avant de commencer

Coche chaque ligne avant de passer à la partie 1.

- [ ] **Un nom de domaine** acheté (ex. `gstock.app`), avec l'accès au site du vendeur (le « registrar » : Namecheap, OVH, GoDaddy…).
- [ ] **Un compte Cloudflare** (gratuit) : https://dash.cloudflare.com/sign-up
- [ ] **Un compte chez un hébergeur de VPS** (Hetzner, OVHcloud, Contabo, DigitalOcean…).
- [ ] **Les droits de propriétaire** de l'organisation GitHub `GENIUS-GROUPS-SAS`, ou quelqu'un qui les a, disponible pendant la partie 6.
- [ ] **Un compte d'envoi d'e-mails** : Brevo (gratuit jusqu'à 300 e-mails par jour, https://www.brevo.com). Resend ou Mailgun marchent aussi.
- [ ] **Le dernier code poussé sur GitHub**, branche `main` (déjà fait).
- [ ] **Un gestionnaire de mots de passe** (ou un fichier sûr) pour noter les secrets au fur et à mesure.

Garde ce tableau à côté de toi et remplis-le pendant le guide :

| À noter | Valeur | Partie |
|---|---|---|
| IP du serveur | | 1 |
| Jeton Cloudflare | | 3 |
| Mot de passe de Coolify | | 4 |
| `APP_KEY` | | 9 |
| `DB_PASSWORD` | | 9 |
| Identifiant et clé SMTP | | 7 |
| Mot de passe du back-office | | 12 |

---

## Partie 1 : louer le serveur

1. Chez ton hébergeur, crée un serveur (VPS) avec :
   - système : **Ubuntu 24.04** ;
   - **4 Go de RAM au minimum**, 2 vCPU, 40 Go de disque.
     Avec 2 Go, le build de l'application échoue souvent par manque de mémoire ;
   - localisation : la plus proche de l'Afrique de l'Ouest proposée (souvent France ou Allemagne).
2. Accès : l'hébergeur propose d'ajouter une **clé SSH** ou donne un **mot de passe root**. Les deux marchent.
   - Pour une clé SSH, sur ton ordinateur : `ssh-keygen -t ed25519` (Entrée à chaque question), puis colle chez l'hébergeur le contenu de `~/.ssh/id_ed25519.pub`.
3. Crée le serveur et **note son adresse IP** (IPv4, ex. `203.0.113.10`).
4. Si l'hébergeur a un **pare-feu dans son interface** (Hetzner « Firewalls », OVH, etc.) : autorise en entrée les ports **22, 80, 443 et 8000** (TCP), ou ne mets pas de pare-feu chez lui (on en met un en partie 2).

---

## Partie 2 : préparer le serveur

Sur ton ordinateur, ouvre un terminal et connecte-toi (remplace l'IP) :

```bash
ssh root@203.0.113.10
```

Réponds `yes` à la première question. Ensuite, colle les blocs suivants un par un.

**Mettre le système à jour** (2 à 5 minutes) :

```bash
apt update && apt upgrade -y
```

S'il demande de choisir parmi des services à redémarrer, fais simplement Entrée.

**Ajouter 2 Go de mémoire de secours (swap)**, pour que le build ne manque jamais de mémoire :

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
free -h
```

La ligne `Swap:` doit afficher `2.0Gi`.

**Activer le pare-feu** (bien autoriser le 22 en premier, sinon tu perds l'accès SSH) :

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 8000/tcp
ufw --force enable
ufw status
```

`ufw status` doit lister 22, 80, 443 et 8000 en `ALLOW`.

**Régler le fuseau horaire** (heure des journaux et des sauvegardes) :

```bash
timedatectl set-timezone Africa/Abidjan
```

Reste connecté : on revient sur ce terminal en partie 4.

---

## Partie 3 : mettre le domaine chez Cloudflare

Pourquoi Cloudflare : chaque espace a son sous-domaine. Il faut donc un certificat HTTPS
valable pour **tous** les sous-domaines (`*.gstock.app`), et ce type de certificat ne s'obtient
qu'en prouvant qu'on contrôle le DNS. Coolify sait le faire automatiquement avec Cloudflare.

### 3.1 Ajouter le domaine

1. https://dash.cloudflare.com > **Add a domain** (ou « Add a site ») > saisir `gstock.app` > **Continue**.
2. Choisir l'offre **Free**.
3. Cloudflare affiche **deux serveurs de noms** (ex. `anna.ns.cloudflare.com` et `bob.ns.cloudflare.com`). Les noter.
4. Sur le site du **vendeur du domaine** (registrar) : rubrique « DNS » ou « Serveurs de noms » du domaine > remplacer les serveurs de noms actuels par les deux de Cloudflare > enregistrer.
5. Retour sur Cloudflare > **Check nameservers**. L'activation prend de quelques minutes à quelques heures. Cloudflare envoie un e-mail quand le domaine est **Active**.

Tu peux avancer sur les parties 4, 6 et 7 pendant l'attente. **La partie 5 a besoin du domaine actif.**

### 3.2 Créer les enregistrements DNS

Cloudflare > ton domaine > **DNS** > **Records**. Supprime les éventuels enregistrements A,
AAAA ou CNAME importés pour `@`, `*` ou `www`, puis crée :

| Type | Name | IPv4 address | Proxy status |
|---|---|---|---|
| A | `@` | IP du serveur | **DNS only** (nuage gris) |
| A | `*` | IP du serveur | **DNS only** (nuage gris) |

**Important : nuage gris (DNS only)**, pas orange. Cliquer sur le nuage pour le passer en gris.
`admin.gstock.app` et tous les espaces sont couverts par l'enregistrement `*`.

### 3.3 Créer le jeton pour Coolify

1. Cloudflare > icône du profil en haut à droite > **My Profile** > **API Tokens** > **Create Token**.
2. Modèle **Edit zone DNS** > **Use template**.
3. Zone Resources : `Include` > `Specific zone` > `gstock.app`.
4. **Continue to summary** > **Create Token**.
5. **Copie le jeton et note-le** : il n'est affiché qu'une seule fois.

---

## Partie 4 : installer Coolify

Dans le terminal SSH du serveur :

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Compter 3 à 5 minutes. À la fin, le script affiche une adresse du type `http://203.0.113.10:8000`.

1. Ouvre `http://IP_DU_SERVEUR:8000` dans ton navigateur.
2. **Crée le compte administrateur** de Coolify (e-mail et mot de passe, à noter).
   Fais-le tout de suite : la première personne qui ouvre cette page devient administratrice.
3. L'assistant de démarrage demande où déployer : choisis **This Machine** (ou « localhost »). Termine l'assistant.
4. Coolify > **Servers** > `localhost` : le serveur doit être marqué valide (coche verte), et le proxy en marche (« Proxy running »). Sinon, **Validate Server** puis **Start Proxy**.

---

## Partie 5 : le certificat pour tous les sous-domaines

Prérequis : le domaine est **Active** chez Cloudflare (partie 3.1).

1. Coolify > **Servers** > `localhost` > onglet **Proxy**.
2. Vérifier que le proxy est **Traefik** et que la ligne `image:` indique `traefik:v3…`.
   Le compose de GStock est écrit pour Traefik **v3**. Si tu vois `v2`, mets le proxy à jour depuis cet écran avant de continuer.
3. Dans la configuration affichée, sous `services:` > `traefik:` :

   **a. Dans `environment:`**, ajouter une ligne (avec ton jeton) :

   ```yaml
   - CF_DNS_API_TOKEN=colle_ici_le_jeton_cloudflare
   ```

   S'il n'y a pas de section `environment:` sous `traefik:`, la créer au même niveau que `command:` :

   ```yaml
       environment:
         - CF_DNS_API_TOKEN=colle_ici_le_jeton_cloudflare
   ```

   **b. Dans `command:`**, **supprimer** ces deux lignes :

   ```yaml
   - '--certificatesresolvers.letsencrypt.acme.httpchallenge=true'
   - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=http'
   ```

   et **ajouter** à leur place :

   ```yaml
   - '--certificatesresolvers.letsencrypt.acme.dnschallenge.provider=cloudflare'
   - '--certificatesresolvers.letsencrypt.acme.dnschallenge.delaybeforecheck=0'
   ```

   Ne touche pas aux autres lignes (en particulier `...acme.storage=/traefik/acme.json`).
4. **Save**, puis **Restart Proxy**. Le proxy redémarre en quelques secondes.

Le certificat lui-même sera demandé au premier déploiement (partie 10).

---

## Partie 6 : donner à Coolify l'accès au dépôt privé

Le dépôt `GENIUS-GROUPS-SAS/Gstock-SAAS` est privé et appartient à une organisation. On relie
Coolify à GitHub par une **GitHub App** : c'est la méthode qui donne aussi le déploiement
automatique à chaque `git push`. Il faut être **propriétaire de l'organisation** GitHub.

1. Sois connecté à GitHub dans le même navigateur.
2. Coolify > **Sources** > **+ Add** > **GitHub App**.
3. Name : `coolify-gstock`. Cocher **Organization (on GitHub)** et saisir `GENIUS-GROUPS-SAS`. **Continue**.
4. Laisser les réglages proposés (webhook et adresse de Coolify) > **Register Now**.
5. GitHub s'ouvre : **Create GitHub App for GENIUS-GROUPS-SAS**. Tu reviens sur Coolify.
6. **Install Repositories on GitHub** > choisir l'organisation `GENIUS-GROUPS-SAS` > **Only select repositories** > `Gstock-SAAS` > **Install**.
7. Retour sur Coolify : la source `coolify-gstock` est enregistrée et liée.

---

## Partie 7 : préparer l'envoi des e-mails

GStock envoie des e-mails : lien de mot de passe oublié, relances de factures. Exemple avec Brevo :

1. Crée le compte sur https://www.brevo.com.
2. **Authentifier le domaine** : Brevo > **Senders, Domains & Dedicated IPs** > **Domains** > **Add a domain** > `gstock.app`.
   Brevo donne des enregistrements DNS (TXT, et parfois CNAME). Ajoute-les dans Cloudflare > DNS > Records, **en DNS only**, puis **Authenticate** chez Brevo.
   Sans cette étape, les e-mails partent en spam ou sont refusés.
3. Crée l'expéditeur `noreply@gstock.app` (Senders > Add a sender).
4. Brevo > **SMTP & API** > onglet **SMTP** : noter le **Login** (une adresse du type `xxxx@smtp-brevo.com`) et générer une **SMTP key** (la noter, elle n'est affichée qu'une fois).
   Serveur `smtp-relay.brevo.com`, port `587`.

Pas le temps maintenant ? Tu peux sauter cette partie et mettre `MAIL_MAILER=log` en partie 9 :
tout marche, sauf la réception des e-mails. Tu y reviendras plus tard.

---

## Partie 8 : créer l'application dans Coolify

1. Coolify > **Projects** > **+ Add** > Name : `GStock` > **Continue**. L'environnement `production` est créé.
2. Ouvrir `production` > **+ New** (ou « + Add Resource ») > **Private Repository (with GitHub App)**.
3. Choisir la source `coolify-gstock`, puis le dépôt `Gstock-SAAS` > **Load Repository**.
4. Remplir exactement :

   | Champ | Valeur |
   |---|---|
   | Branch | `main` |
   | Build Pack | **Docker Compose** |
   | Base Directory | `/` |
   | Docker Compose Location | `/docker-compose.coolify.yml` |

5. **Continue**. Coolify lit le fichier et affiche 5 services : `db`, `api`, `worker`, `web`, `backup`.
6. **Laisser vides tous les champs « Domains »** des services.
   Le routage (domaine principal, sous-domaines des espaces, `admin.`) est déjà écrit dans le
   compose. Un domaine saisi ici créerait un second routage qui entrerait en conflit.
7. Ne clique **pas** encore sur Deploy : il faut d'abord les variables.

---

## Partie 9 : saisir les variables

### 9.1 Générer les deux secrets

Sur ton ordinateur ou sur le serveur :

```bash
echo "base64:$(openssl rand -base64 32)"   # → APP_KEY
openssl rand -hex 24                         # → DB_PASSWORD
```

**Note-les tout de suite dans ton gestionnaire de mots de passe.**

- Ne **jamais** changer `APP_KEY` après la mise en ligne : les clés de paiement des boutiques sont chiffrées avec, et les sessions en dépendent.
- Ne **jamais** changer `DB_PASSWORD` après le premier déploiement : la base garde le mot de passe de son premier démarrage, et l'API ne pourrait plus s'y connecter.

### 9.2 Les saisir dans Coolify

Application > **Environment Variables** > **Developer view** (saisie en texte libre) > colle
ce bloc en remplaçant les valeurs > **Save**.

```env
APP_DOMAIN=gstock.app
APP_KEY=base64:REMPLACER
DB_PASSWORD=REMPLACER
MAIL_FROM_ADDRESS=noreply@gstock.app

MAIL_MAILER=smtp
MAIL_HOST=smtp-relay.brevo.com
MAIL_PORT=587
MAIL_USERNAME=REMPLACER_login_smtp_brevo
MAIL_PASSWORD=REMPLACER_cle_smtp_brevo
```

Règles :

- `APP_DOMAIN` : le domaine seul, **sans** `https://`, sans `www`, sans `/` à la fin.
- `MAIL_FROM_ADDRESS` est **obligatoire**, même sans SMTP : vide, chaque e-mail échoue.
- Sans SMTP pour l'instant : remplacer les 5 lignes `MAIL_MAILER` à `MAIL_PASSWORD` par `MAIL_MAILER=log`.
- Ne mets **aucune** variable `GENIUSPAY_PLATFORM_*` (voir « Limites connues »).

Variables facultatives (valeurs par défaut correctes) : `BACKUP_KEEP_DAYS=14` (durée de garde
des sauvegardes), `LOG_LEVEL=warning`.

---

## Partie 10 : premier déploiement

1. En haut de l'application : **Deploy**.
2. Ouvre le déploiement en cours pour suivre les logs. Le premier build prend **5 à 15 minutes** (installation des dépendances PHP et JavaScript, construction des images). Les suivants seront plus rapides.
3. Au démarrage, `api` applique les migrations et crée les formules d'abonnement tout seul ; il n'y a rien à lancer à la main.
4. À la fin, dans l'application, les services doivent être :
   - `db`, `api`, `web` : **Running (healthy)** ;
   - `worker`, `backup` : **Running**.
5. Le certificat `*.gstock.app` est demandé au même moment. Pour le suivre : Servers > localhost > Proxy > **Logs**, chercher `acme`. Il faut en général 1 à 2 minutes.

Si le déploiement échoue, va au [Dépannage](#dépannage).

---

## Partie 11 : vérifier que tout marche

Fais ces contrôles dans l'ordre, dans une fenêtre de navigation privée :

- [ ] `https://admin.gstock.app/health` affiche `{"status":"ok","database":"ok"}`.
- [ ] `https://gstock.app` affiche l'écran de connexion, avec le **cadenas** du navigateur (certificat valide).
- [ ] **Créer mon espace** : remplir l'inscription avec de vraies informations. À la fin, tu arrives sur `https://<ton-espace>.gstock.app`, connecté, avec un cadenas valide.
- [ ] Dans l'espace : créer un produit, faire une vente. La vente apparaît dans « Mes ventes ».
- [ ] Se déconnecter, revenir sur `https://gstock.app`, se reconnecter : tu es renvoyé vers ton espace.
- [ ] « Mot de passe oublié » : l'e-mail arrive (si SMTP configuré). Sinon, regarder les logs du service `worker`.
- [ ] Sur le téléphone : ouvrir l'espace, menu du navigateur > **Ajouter à l'écran d'accueil** : l'application s'installe.

---

## Partie 12 : créer le compte du back-office

Le back-office n'a aucun compte au départ. Dans le terminal SSH du serveur :

```bash
docker ps --format '{{.Names}}' | grep '^api-'
```

Cette commande affiche le nom du conteneur de l'API (ex. `api-k8s0wc4g…`). Puis :

```bash
docker exec -it NOM_DU_CONTENEUR_API php artisan gstock:admin ton.email@genius-groups.ci
```

La commande demande un nom affiché, puis un mot de passe de **12 caractères au moins** (rien ne
s'affiche pendant la saisie, c'est normal). Connecte-toi ensuite sur `https://admin.gstock.app`.

Pour ajouter un autre administrateur, relancer la même commande avec son e-mail.

---

## Partie 13 : la vie après la mise en ligne

### Mettre à jour l'application

```bash
git push origin main
```

C'est tout : GitHub prévient Coolify, qui reconstruit et redéploie. Les migrations s'appliquent
au démarrage de `api`. Suivre l'avancement dans Coolify > l'application > **Deployments**.

Pour **annuler** une mise à jour qui pose problème : `git revert <commit>` puis `git push origin main`.
Ne jamais annuler une migration déjà appliquée en production sans sauvegarde (voir plus bas).

### Voir les journaux

Coolify > l'application > **Logs** > choisir le service (`api` pour les erreurs de l'API,
`worker` pour les e-mails, `backup` pour les sauvegardes).

Ou en SSH :

```bash
docker ps --format '{{.Names}}'          # liste des conteneurs
docker logs --tail 100 NOM_DU_CONTENEUR
```

### Les sauvegardes

- Une sauvegarde au démarrage du service `backup`, puis une toutes les 24 heures. Gardées 14 jours.
- La toute première, faite avant les migrations, est presque vide : c'est normal.
- **Elles sont sur le même serveur que la base.** Si le serveur est perdu, elles le sont aussi : en rapatrier une régulièrement (au moins une fois par semaine).

Voir les sauvegardes :

```bash
docker exec $(docker ps --format '{{.Names}}' | grep '^backup-') ls -lh /backups
```

Les rapatrier sur ton ordinateur (commandes à lancer **sur ton ordinateur**) :

```bash
ssh root@IP_DU_SERVEUR "docker volume ls --format '{{.Name}}' | grep gstock-backups"
# → affiche le nom du volume, ex. k8s0wc4g_gstock-backups
scp 'root@IP_DU_SERVEUR:/var/lib/docker/volumes/NOM_DU_VOLUME/_data/gstock-*.dump' .
```

Restaurer une sauvegarde (**écrase la base actuelle**, à faire seulement en cas de problème grave) :

```bash
docker exec $(docker ps --format '{{.Names}}' | grep '^backup-') \
  pg_restore --clean --if-exists -d gstock /backups/gstock-AAAA-MM-JJ-HHMM.dump
```

Puis redémarrer l'application dans Coolify (**Restart**).

### Sécuriser l'accès à Coolify (facultatif, recommandé)

1. Cloudflare > DNS : ajouter `A` `coolify` > IP du serveur, en DNS only.
   (`coolify.gstock.app` est déjà couvert par `*`, mais un enregistrement explicite est plus clair.)
2. Coolify > **Settings** > **Instance's Domain** : `https://coolify.gstock.app` > Save.
3. Vérifier que `https://coolify.gstock.app` s'ouvre, puis fermer le port 8000 en SSH :

   ```bash
   ufw delete allow 8000/tcp
   ```

---

## Dépannage

| Ce que tu vois | Cause probable | Que faire |
|---|---|---|
| Coolify refuse de déployer : variable manquante | Une variable obligatoire est vide | Vérifier `APP_DOMAIN`, `APP_KEY`, `DB_PASSWORD`, `MAIL_FROM_ADDRESS` (partie 9) |
| Le build s'arrête sur « Killed » ou « exit code 137 » | Plus de mémoire | Vérifier le swap (`free -h`, partie 2) ou prendre un serveur de 4 Go |
| `api` reste « unhealthy », logs : `password authentication failed` | `DB_PASSWORD` changé après le premier déploiement | Remettre l'ancien mot de passe. Sur une installation neuve sans données : supprimer le volume `…_gstock-pgsql` puis redéployer |
| Page blanche « 404 page not found » en texte brut | Traefik ne trouve pas de route | Champs « Domains » des services bien **vides** ; proxy en **Traefik v3** ; `APP_DOMAIN` exact ; redéployer |
| Avertissement de certificat, ou certificat « TRAEFIK DEFAULT CERT » | Le certificat n'a pas pu être obtenu | Servers > Proxy > Logs, chercher `acme` : jeton Cloudflare, domaine actif, lignes `dnschallenge` (partie 5). Puis Restart Proxy |
| Le site ne s'ouvre pas du tout | DNS | Cloudflare : enregistrements `@` et `*` vers la bonne IP, nuage gris. Tester avec `ping gstock.app` |
| « Cet espace n'existe pas » sur `https://gstock.app` | `APP_DOMAIN` mal saisi | Le domaine seul, sans `https://` ni `www`, puis redéployer |
| Connexion qui boucle, « session expirée » | Site ouvert en `http://` | Toujours passer par `https://` |
| Les e-mails n'arrivent pas | SMTP, ou domaine non authentifié | Logs du service `worker` ; authentification du domaine chez Brevo (partie 7) |
| Les photos disparaissent après une mise à jour | Volume supprimé | Ne jamais supprimer les volumes `…_gstock-storage` ni `…_gstock-pgsql` dans Coolify |

---

## Limites connues

- **Paiement de l'abonnement** : le pilote GeniusPay réel n'est pas encore développé. Les nouveaux
  espaces ont leurs 14 jours d'essai, mais le bouton « Payer » de « Mon abonnement » renvoie une
  erreur. Ne pas mettre `GENIUSPAY_PLATFORM_DRIVER=simulation` en production : c'est refusé exprès.
- **Tâches planifiées** : il n'y en a aucune dans le code pour l'instant, donc pas de conteneur
  « scheduler ». À ajouter le jour où il y en aura (`php artisan schedule:work`).
- **Sauvegardes** : sur le même serveur que la base. À rapatrier régulièrement (partie 13).
