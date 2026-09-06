# CloudComAI platform release checklist

## Code and CI

- Confirm the release branch is based on the latest `main`.
- Review and merge the open feature PRs in dependency order.
- Confirm GitHub Actions passes JavaScript tests, API contract verification,
  web/mobile builds, PHP lint, and router tests.
- Confirm no production credentials, local `.env` files, or `config.php` are
  committed.

## Database and backend

- Follow [`deployment/GODADDY_PRODUCTION.md`](../deployment/GODADDY_PRODUCTION.md).
- Export a GoDaddy database backup before an existing-site deployment.
- Apply `backend/database/fresh-install.sql` once only for a new, empty database.
- Select `existing-production` to apply future versioned migrations.
- Confirm the production `token_secret` remains unchanged for an existing site.
- Verify `/apiapp/api/v1/health` and the clean Google callback route after deployment.
- Configure both notification Cron workers and inspect their first logs.

## Google OAuth

- Keep test and production OAuth clients separate.
- Confirm the production client uses the exact extensionless callback URL.
- Confirm the OAuth consent application is published and ready for public users.
- Test connect, callback, contact sync and registered-user filtering.

## Expo validation

- Set the final Android package and iOS bundle identifier in `app.json`.
- Configure `EXPO_TOKEN` and `EAS_PROJECT_ID` outside the repository.
- Configure `EXPO_PUBLIC_API_BASE_URL` in both the EAS `preview` and
  `production` environments.
- Test registration, global/category toggles, message delivery, receipt
  reconciliation, invalid-token revocation, and notification tap navigation.
- Build and install new baseline artifacts after any native runtime change.
- Publish an OTA update to `preview` and verify it before publishing the same
  commit to `production`.
- Build preview artifacts before a production build.

## Launch and rollback

- Validate login, private/group chats, attachments, and notification inbox on
  web and mobile.
- Keep the database export and previous web build until verification completes.
- Confirm rollback artifacts are available and document the operator and time.
- Run production deployment only by manually dispatching the GoDaddy workflow
  from `main` with the production environment selected.
