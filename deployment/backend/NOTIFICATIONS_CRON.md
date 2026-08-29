# Expo notification Cron jobs

The notification workers are CLI-only PHP scripts and are not HTTP endpoints.
Configure two GoDaddy Cron jobs after the application and consolidated SQL have
been deployed:

```text
php /home/ACCOUNT/public_html/apiapp/cron/send_notifications.php
php /home/ACCOUNT/public_html/apiapp/cron/check_notification_receipts.php
```

Run the send worker every minute and the receipt worker every 15 minutes. Use
the absolute PHP path shown by GoDaddy if `php` is not on the default PATH.

Before enabling them, verify that `notification_devices`,
`notification_history`, and `notification_delivery_queue` exist and that the
backend `config.php` points to the intended database. The workers print a
short result to the Cron log; they do not expose credentials or notification
contents through an HTTP response.

To test safely, register one development Expo token, send a message to that
user, confirm a queue row is created, and then check the worker and receipt
logs. Do not run the workers from a browser.
