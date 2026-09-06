# CloudComAI platform release checklist

## Code and CI

- Confirm the release branch is based on the latest `main`.
- Review and merge the open feature PRs in dependency order.
- Confirm GitHub Actions passes JavaScript tests, API contract verification,
  web/mobile builds, PHP lint, and router tests.
- Confirm no production credentials, local `.env` files, or `config.php` are
  committed.

## Database and backend

- Take an application and database backup before deployment.
- Apply `backend/database/fresh-install.sql` once for a new installation.
- Run the authenticated health check after deployment.
- Configure both notification Cron workers and inspect their first logs.

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
- Confirm rollback artifacts are available and document the operator and time.
- Production deployment and app-store submission require explicit approval.
