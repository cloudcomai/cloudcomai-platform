# GoDaddy production deployment

CloudComAI production is deployed as static web files plus PHP 8.3 and MySQL. The
production workflow is separate from InfinityFree and runs only when manually
started from `main` with an explicit production confirmation.

## 1. Choose the web location

Set the repository variables to one of these supported layouts:

| Layout | `GODADDY_WEB_DIR` | `GODADDY_WEB_BASE_PATH` | Web URL |
| --- | --- | --- | --- |
| Replace the root website | `/public_html/` | `/` | `https://www.cloudcomai.com` |
| Keep the application under `/app` | `/public_html/app/` | `/app/` | `https://www.cloudcomai.com/app` |

The API directory remains `/public_html/apiapp/` in both layouts. A root web
deployment excludes `apiapp/`, so backend files are not treated as web build
artifacts.

## 2. Configure GitHub

Create a GitHub environment named `production`. Add approval protection there
when the repository plan supports it.

Add these GitHub Actions secrets:

- `GODADDY_FTP_SERVER`
- `GODADDY_FTP_USERNAME`
- `GODADDY_FTP_PASSWORD`
- `GODADDY_MIGRATION_TOKEN`

The migration-token value may be the existing secure GoDaddy deployment token.
Do not use the InfinityFree FTP credentials or Google OAuth client secret as the
migration token.

Add these repository variables:

- `GODADDY_WEB_DIR` — required; choose a layout from the table above.
- `GODADDY_API_DIR` — required; normally `/public_html/apiapp/`.
- `GODADDY_WEB_BASE_PATH` — optional; defaults to `/`.
- `PRODUCTION_WEB_URL` — optional; defaults to
  `https://www.cloudcomai.com`.
- `PRODUCTION_API_URL` — optional; defaults to
  `https://www.cloudcomai.com/apiapp/api`.

## 3. Configure GoDaddy-only secrets

Create `/public_html/apiapp/config/config.php` using
`backend/config/config.example.php`. Supply the actual GoDaddy MySQL hostname,
database, user and password. Do not assume that the database host is
`localhost`; use the hostname shown in the GoDaddy database panel.

For an existing installation, keep the current production `token_secret`.
Changing it invalidates application tokens and prevents existing encrypted
Google refresh tokens from being decrypted. For a fresh database, generate the
secret once and keep it stable.

Create this token file outside `public_html`, using GoDaddy File Manager:

```php
<?php
return [
    'migration_token' => 'THE_SAME_VALUE_AS_GODADDY_MIGRATION_TOKEN',
];
```

Save it as `.cloudcomai_migration_token.php` in the hosting account home
directory. It must not be committed or placed in `public_html`.

The FTP workflow always excludes `config/`, `storage/` and uploaded content.
Production configuration and user files therefore remain server-managed.

## 4. Prepare the database

Choose exactly one workflow mode:

### Fresh installation

1. Create an empty MySQL database in GoDaddy.
2. Import `backend/database/fresh-install.sql` once through phpMyAdmin.
3. Create the server-only `config.php`.
4. Run the workflow with `fresh-install-already-imported`.

The workflow never imports `fresh-install.sql`, because running the consolidated
file against an existing database could overwrite or conflict with production
data.

### Existing production database

1. Export a current database backup from GoDaddy/phpMyAdmin.
2. Confirm the migration-token file and GitHub secret contain the same value.
3. Run the workflow with `existing-production`.

This mode creates a compressed filesystem backup, uploads the isolated migration
package and applies only unapplied versioned migrations. Future migrations use
the same workflow; the consolidated fresh-install file is not used for upgrades.

## 5. Configure production Google OAuth

Use the existing production Web application OAuth client in the GoDaddy
`config.php`. Keep the test OAuth client only on InfinityFree.

Add this exact authorized redirect URI to the production OAuth client:

```text
https://www.cloudcomai.com/apiapp/api/v1/integrations/google/callback
```

The old `.php` callback can remain temporarily during rollout. Remove it only
after the clean callback succeeds in production. Ensure the Google OAuth consent
application is published and approved for the requested Contacts scope before a
public launch.

## 6. Run and verify

Open **Actions → Deploy CloudComAI to GoDaddy Production → Run workflow** on
`main` and select:

- `confirmation`: `DEPLOY`
- the correct database mode
- `database_ready`: `YES` only after the required database preparation

The workflow validates code, builds the web application with the production API
URL, creates the applicable backup, runs migrations when required, deploys the
backend before the web application, and verifies:

```text
https://www.cloudcomai.com/apiapp/api/v1/health
https://www.cloudcomai.com/apiapp/api/v1/integrations/google/callback
https://www.cloudcomai.com
```

The callback probe intentionally omits OAuth parameters and expects the safe
"Invalid Google authorization response" page. It does not authorize an account.

## Rollback boundary

For an existing installation, a failed workflow attempts to restore the previous
`apiapp` filesystem backup while preserving the live `config/` directory. It
does not restore the database export or partially uploaded web files. Keep the
manual database export and the previous web build until production verification
is complete.
