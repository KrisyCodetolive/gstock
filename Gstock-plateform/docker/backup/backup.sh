#!/bin/sh
# Une sauvegarde au démarrage puis toutes les 24 h, dans /backups (volume).
# Restauration : pg_restore --clean --if-exists -d gstock /backups/<fichier>.dump
set -eu
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
mkdir -p /backups
until pg_isready -q; do sleep 5; done
while true; do
    file="/backups/gstock-$(date +%Y-%m-%d-%H%M).dump"
    if pg_dump --format=custom --file="$file.tmp"; then
        mv "$file.tmp" "$file"
        echo "Sauvegarde faite : $file ($(du -h "$file" | cut -f1))"
    else
        rm -f "$file.tmp"
        echo "ÉCHEC de la sauvegarde" >&2
    fi
    find /backups -name 'gstock-*.dump' -mtime +"$KEEP_DAYS" -delete
    sleep 86400
done
