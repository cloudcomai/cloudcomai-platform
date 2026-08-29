# Authentication abstractions

Shared session management with an injectable storage adapter. Web can wrap local or session storage, while Expo can later supply secure storage without changing authentication consumers.

This package does not choose credential storage and does not decode or trust JWT claims.
