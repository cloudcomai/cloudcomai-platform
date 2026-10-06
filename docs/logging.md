# CloudComAI generic logging

CloudComAI uses a common logging contract across mobile, web and API modules.

## Levels

- `debug`: detailed diagnostics and request-start information
- `info`: successful application operations and timings
- `warn`: recoverable or non-successful operations
- `error`: failures and exceptions

## Frontend

The shared logger is exported by `@cloudcomai/api-client`:

```js
import { createLogger } from '@cloudcomai/api-client';
const log = createLogger('contacts');
log.info('Contacts loaded', { count: 42 });
const timer = log.time('Contacts loading');
// ...
timer.end();
```

The API client automatically logs request timing, status and a correlation ID for every web/mobile API call.

Set `globalThis.__CLOUDCOMAI_LOG_LEVEL__` to `debug`, `info`, `warn`, or `error` when deeper diagnostics are required.

## Backend

`backend/lib/logger.php` provides the same levels and emits structured JSON through PHP's standard error log. The API router loads it for every routed API request and adds an `X-Request-Id` correlation ID.

Backend log level can be controlled with `CLOUDCOMAI_LOG_LEVEL` (`info` by default).

## Privacy

Logging must never contain passwords, tokens, authorization headers, OTPs, contact email/phone values, private message bodies, or request bodies. The shared logger filters these context keys before emission.


## Backend log file

Backend logs are written to a dedicated application file instead of relying only on the hosting provider's PHP error log.

Default configuration:

- Directory: `backend/storage/logs`
- Active file: `cloudcomai.log`
- Full default path: `backend/storage/logs/cloudcomai.log`
- File permissions are set to `0640` where the hosting filesystem permits it.
- The log directory contains an Apache `.htaccess` rule that denies direct web access.

The location and filename are configurable in `backend/config/logging.php`:

- `CLOUDCOMAI_LOG_DIR` — absolute log directory override.
- `CLOUDCOMAI_LOG_FILE` — active log filename override.
- `CLOUDCOMAI_LOG_RETENTION_HOURS` — backup retention; default is 168 hours (7 days).

### Hourly log backup

`backend/cron/rotate_logs.php` rotates the active log once per hour. A backup is created using the pattern:

`cloudcomai.log.YYYYMMDD_HH.bak`

The active `cloudcomai.log` is then recreated and new requests continue writing to it. Backups older than the configured retention period are removed.

For GoDaddy cPanel, create a cron job that runs the script hourly. GoDaddy documents PHP cron commands using the PHP binary and the absolute path to the script, for example:

`/usr/local/bin/php -q /home/[account]/[path]/backend/cron/rotate_logs.php`

Use the actual account and deployment path for the CloudComAI installation.
