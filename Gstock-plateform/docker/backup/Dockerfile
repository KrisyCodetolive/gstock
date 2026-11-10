# Sauvegarde quotidienne de la base (§12.5) : pg_dump au format custom, gardé BACKUP_KEEP_DAYS jours.
FROM postgres:16-alpine
COPY backup.sh /usr/local/bin/gstock-backup
RUN chmod +x /usr/local/bin/gstock-backup
ENTRYPOINT ["gstock-backup"]
