#!/usr/bin/env bash
# Commit + push en une commande. Usage : ./publier.sh "message du commit"
# Sans message : pousse seulement les commits déjà faits.
# Remote cible : "gstock" (https://github.com/KrisyCodetolive/gstock.git), branche courante.
set -euo pipefail
cd "$(dirname "$0")"

branche=$(git rev-parse --abbrev-ref HEAD)

if [ $# -ge 1 ]; then
  git add -A
  if git diff --cached --quiet; then
    echo "Rien à commiter."
  else
    git commit -m "$*"
  fi
fi

git push -u gstock "$branche"
echo "✓ Poussé sur gstock/$branche. Coolify redéploie si le déploiement automatique est activé."
