# Password recovery

Select **Forgot password?** on web or mobile and enter the registered email,
mobile number, or CloudComAI User ID. Spaces, parentheses, and dashes in a mobile
number are normalized in the same way as sign-in.

The link is emailed to the account's registered email address. Mobile users
complete the reset in their browser, then return to the app to sign in. Accounts
without an email address cannot use email recovery; this flow does not send SMS.

Links expire after 30 minutes. New links use a URL fragment so the token is not
sent to the static web server. Previously emailed query-string links remain
supported and are moved into the fragment when the application opens. Missing,
invalid, expired, or used links offer a new reset request.

Use at least 8 characters. The backend rejects passwords exceeding the bcrypt
limit of 72 UTF-8 bytes instead of silently truncating them. Confirmation must
match. A successful reset does not sign in automatically.

## Hosting configuration

In the server-only backend config, set:

| Setting | Meaning | Example |
| --- | --- | --- |
| app.web_url | Complete location of the deployed web application, including a subdirectory if used; no query or fragment | https://www.cloudcomai.com/app |
| app.mail_from | Real sender mailbox accepted by the hosting PHP mail service | support@cloudcomai.com |

For a root website, use https://www.cloudcomai.com as app.web_url. For local
development, a URL such as http://localhost:5173 is accepted. Reset URLs always
come from this configuration, never the requesting browser's Origin or Host.

The backend uses the hosting account's PHP mail() transport and configured
envelope sender. There is no SMTP service configured by this change. Check that
the host permits outgoing mail, accepts the sender, and delivers to both inbox
and spam folders. Server logs report configuration or transport failures without
logging reset tokens. A successful HTTP response does not prove inbox delivery.
GitHub deployment preserves the server-only config, so changing a repository
variable does not update app.web_url or app.mail_from on the server.

## Security and upgrade behavior

- Recovery returns the same message for active, unavailable, unknown, and
  throttled accounts. The response never contains a reset token.
- Requests are limited per account to one per minute and five per hour. They do
  not lock the account or prevent normal sign-in.
- Only token hashes are stored. A failed mail attempt disables that new token;
  previously delivered links stay valid until expiry or a successful reset.
- Resetting the password consumes every outstanding link for the account
  atomically. Concurrent requests can succeed only once.
- Resetting increments the account's session version and revokes its push device
  registrations. Existing sign-in tokens, including legacy tokens, are rejected
  on their next authenticated request. Web and mobile then return to sign-in.
  Other accounts' sessions are unaffected. Signing in again can register push.

Existing installations must apply
backend/database/migrations/007_password_recovery_sessions.sql before the new
backend code. The GoDaddy incremental deployment includes this migration.
Hosts using manual database imports must apply it manually. Fresh installations
use the consolidated backend/database/fresh-install.sql, which includes the
same table and migration record. This change does not deploy the application.

## Validation

CI runs the real API against a disposable localhost MySQL database and captures
PHP mail to a temporary file. It verifies identifier matching, URL and sender
generation, generic responses, throttling, expiry, invalid inputs, successful
reset/login, token reuse, concurrent requests, session and push revocation, and
idempotent migration. No test contacts a production database or sends an email.

After deployment, use your own test account to request a reset on web and mobile,
open the email, confirm the correct domain and web path, set a new password,
and sign in again. Check that the old password and old link fail, and another
signed-in device returns to sign-in on its next API request. Inbox delivery and
physical-device behavior need this final environment check.
