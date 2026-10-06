# CloudComAI generic logging

## Backend log file

Backend logs are written to a dedicated application file.

Default:
- Directory: `backend/storage/logs`
- Active file: `cloudcomai.log`
- Backups: `cloudcomai.log.YYYYMMDD_HH.bak`
- Retention: 168 hours (7 days)

Configuration is in `backend/config/logging.php`. Environment overrides:
- `CLOUDCOMAI_LOG_DIR`
- `CLOUDCOMAI_LOG_FILE`
- `CLOUDCOMAI_LOG_RETENTION_HOURS`

`backend/cron/rotate_logs.php` rotates the active log hourly. Configure the GoDaddy cron scheduler to run it once per hour using the absolute PHP path and deployed script path.

The log directory is protected from direct web access and generated logs/backups are excluded from Git.

## Frontend

The shared logger is exported by `@cloudcomai/api-client`. The API client logs request timing, status and correlation IDs for web/mobile API calls.

## Privacy

Logging must never contain passwords, tokens, authorization headers, OTPs, contact email/phone values, private message bodies, or request bodies. The shared logger filters these context keys before emission.
