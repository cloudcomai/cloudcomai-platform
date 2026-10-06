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
