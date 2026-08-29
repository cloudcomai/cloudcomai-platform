# Chat core

Transport-independent message state and synchronization logic.

`createPollingMessageTransport` implements the Phase 1 transport. It polls only
the active chat, sends the latest message ID as the cursor, avoids overlapping
requests, pauses while the page is hidden, and aborts in-flight work when the
chat closes. The Web app depends on this interface rather than on timers, so a
WebSocket transport can be added later without changing UI components.

Set `VITE_MESSAGE_POLL_INTERVAL_MS` in the Web build environment to configure
the interval. The default is 3000 milliseconds and the minimum is 1000.
