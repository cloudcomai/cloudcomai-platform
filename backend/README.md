# CloudComAI PHP/MySQL Backend Beta

## Included
- Registration and login
- Backend age 18+ validation
- Male/Female validation
- Bearer-token authentication
- Chat and message APIs
- Reply relationships
- One-time message editing
- Group category creation
- Group-specific invitation links
- In-app group shortcuts
- Poll creation
- 24-hour stories
- Live-location sessions
- Audio/video call session records and signaling token foundation
- Retention cleanup cron

## Fresh website setup
1. Create or select an empty MySQL database in your hosting control panel.
2. Import `database/fresh-install.sql` once. It contains the base schema and all current database migrations.
3. Do not separately import files from `sql/` or `database/migrations/` for a fresh installation.
4. Copy `config/config.example.php` to `config/config.php`.
5. Fill in database credentials, allowed frontend origin and a long token secret.
6. Upload to a PHP 8.3 host.
7. Confirm `api/health.php` returns `{"status":"ok"...}`.

## Existing website upgrades

The consolidated fresh-install file must not be imported into an existing CloudComAI database. Existing installations continue to use the versioned migration process.

## Security limitations
This is a beta foundation, not a final audited production messenger. Before public launch add verified OTP/email delivery, stronger session storage and revocation, robust rate limiting, file scanning, audited E2EE, push notification workers, WebRTC signaling transport, STUN/TURN, privacy/legal review, and full automated tests.

## GoDaddy
See `GODADDY_BACKEND_DEPLOYMENT.md`.
