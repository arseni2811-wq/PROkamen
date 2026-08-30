# Backup and restore runbook

This repository does not contain database credentials and does not claim that a backup exists. The commands below are an operational template; validate them with the infrastructure owner before production use.

## Policy

- Proposed RPO: 24 hours for a daily full backup; reduce to 1 hour by adding encrypted binary-log shipping.
- Proposed RTO: 4 hours, measured by a quarterly restore drill.
- Keep 14 daily, 8 weekly, and 12 monthly encrypted copies.
- Keep at least one copy in a separate provider/account and enable immutable retention where available.
- Alert on backup failure, unexpectedly small output, checksum mismatch, and missed restore drills.

## Secure configuration

Create an untracked MySQL option file readable only by its owner (`chmod 600`):

```ini
[client]
host=db.example.internal
port=3306
user=backup_user
password=use-a-secret-manager
```

The backup user should have only the privileges required by `mysqldump`. Never pass the password on the command line or commit the option file.

## Encrypted backup

```bash
umask 077
mysqldump --defaults-extra-file=/secure/mysql-backup.cnf \
  --single-transaction --routines --triggers --events --hex-blob \
  --set-gtid-purged=OFF prokamen \
  | gzip -9 \
  | age -r AGE_PUBLIC_RECIPIENT -o prokamen-YYYYMMDD-HHMM.sql.gz.age
sha256sum prokamen-YYYYMMDD-HHMM.sql.gz.age > prokamen-YYYYMMDD-HHMM.sha256
```

Upload the encrypted file and checksum to the offsite immutable target. The `age` private key must be held outside the application host.

## Restore drill to an isolated database

1. Download the encrypted backup and verify its checksum.
2. Create a new database whose name is explicitly identified as a restore test.
3. Decrypt and restore only to that database.
4. Run `npm run check:integrity` with `DB_DATABASE` pointing to the restored database.
5. Start the application against the restored database and run the integration smoke scenario.
6. Record duration, row counts, errors, and the tested recovery point; then remove the isolated copy.

Example restore stream:

```bash
sha256sum -c prokamen-YYYYMMDD-HHMM.sha256
age -d -i /secure/age-key.txt prokamen-YYYYMMDD-HHMM.sql.gz.age \
  | gzip -d \
  | mysql --defaults-extra-file=/secure/mysql-restore.cnf prokamen_restore_test_YYYYMMDD
```

Never restore over the live database. For the six currently known financial anomalies, restore to a copy first, establish the source of truth, and produce a before/after report before any production backfill.
