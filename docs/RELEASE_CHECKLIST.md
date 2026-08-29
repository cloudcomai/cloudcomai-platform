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
- Configure Expo/EAS credentials outside the repository.
- Test registration, global/category toggles, message delivery, receipt
  reconciliation, invalid-token revocation, and notification tap navigation.
- Build preview artifacts before a production build.

## Launch and rollback

- Validate login, private/group chats, attachments, and notification inbox on
  web and mobile.
- Confirm rollback artifacts are available and document the operator and time.
- Production deployment and app-store submission require explicit approval.
