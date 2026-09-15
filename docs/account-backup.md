# Account backup and restore

Cloud backup requires an active account with a verified registered email address. The API always uses the authenticated account ID; email addresses and request headers cannot select another account's backup.

## Server setup

Apply the pending migrations through `016_account_backup.sql` using the existing migration workflow. Migration 016 creates the backup tables and the compatible `phone_contacts` table if it is absent. New installations use `backend/database/fresh-install.sql`, which includes the same definitions and migration records.

Set `app.backup_encryption_key` in the private production configuration to a randomly generated secret of at least 32 bytes. Keep this secret stable and backed up separately: changing or losing it makes existing backups unreadable. Do not use the example placeholder or reuse the login token secret. PHP must support OpenSSL AES-256-GCM.

`app.backup_dir` defaults to `backend/storage/backups`. The PHP and cron processes need write access. Keep this directory inaccessible over HTTP; the supplied Apache rules deny direct storage access. Files use mode 0600 and the directory uses mode 0700. For other web servers, configure the equivalent storage denial before enabling backups.

`app.backup_max_bytes` defaults to 25 MiB for the complete JSON payload, including base64 media. Larger backups fail without replacing the current backup. The latest encrypted file is retained; previous version metadata is retained, but previous files are removed after the new database transaction commits.

Install the CLI schedule from `backend/cron/account-backup.cron.example` using the same configuration and filesystem permissions as the API. Daily, weekly, and monthly frequencies correspond to 24 hours, 7 days, and 30 days. Jobs create backups only when due. The cron script cannot be invoked through HTTP and does not use privileged HTTP headers.

## Restore behavior

Restoring reapplies saved preferences, privacy settings, phone contacts, blocks, and the account's visibility of backed-up messages. It does not duplicate chats or messages, change senders or group ownership, rejoin rooms, or overwrite current message edits. Repeating a restore is safe.

Only messages that still exist, have not expired or been deleted for everyone, and belong to a chat in which the account is currently active are restored. Hidden messages absent from the backup remain hidden. Missing attachment files are restored only when their original message is eligible and the account still has permission to download them. Video bytes are optional. Google contacts and profile details are included for export but do not replace current identity or provider synchronization state during restore.

Backups are encrypted in server storage with AES-256-GCM and bound to the account ID. They are not end-to-end encrypted; the server holds the encryption key. An account lock prevents simultaneous manual backup and restore operations.

## Client compatibility

`GET /v1/users/backup` and `?export=1` preserve the readable JSON export. `GET /v1/users/backup?status=1` returns cloud backup status, `PUT` updates settings, and `POST` accepts `action: backup` or `action: restore`.

Manual mobile backups honor the Wi-Fi-only setting. Scheduled backups run on the server and do not transfer data from the phone. Privacy controls and JSON export remain usable when cloud backup is unavailable.

The mobile app now uses `expo-network`. Build and distribute a new native app binary containing this module; a JavaScript-only update cannot add a missing native module.
