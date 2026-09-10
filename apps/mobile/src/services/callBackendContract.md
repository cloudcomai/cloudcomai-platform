# Calling backend contract

The mobile call UI in this branch is intentionally transport-agnostic. It provides the complete call state model and UI states while keeping WebRTC/signaling behind a small integration boundary.

## Required backend/API pieces

1. **Call invitation**: authenticated `POST /v1/calls` accepting `chat_id`, `type` (`audio`/`video`), and selected participant IDs; returns a durable `call_id` and participant state.
2. **Call lifecycle**: authenticated accept, decline, end, timeout/missed transitions for `call_id`.
3. **Realtime signaling**: WebSocket (preferred) or equivalent realtime channel for offer/answer and ICE candidate exchange, plus ringing/accept/decline/end events.
4. **WebRTC media**: STUN/TURN configuration and client-side WebRTC implementation. PHP REST alone cannot carry the live audio/video media stream.
5. **Group membership authorization**: server verifies the caller belongs to the group and only selected members can be invited.
6. **Push/incoming-call delivery**: device-token delivery for calls when the app is backgrounded/closed, with a short ringing timeout.
7. **Call history**: durable records containing call ID, chat ID, type, participants, timestamps, terminal status, and optional duration.

## Mobile integration boundary

The screen component should receive a `callTransport` with `startCall`, `acceptCall`, `declineCall`, `endCall`, `subscribe`, and `connectMedia` operations. This keeps the UI/state machine testable and allows the real signaling/WebRTC provider to be added without rewriting the call screens.

## Important limitation

The current repository's mobile dependency set has no WebRTC package. Do not label the placeholder video surface as a working camera stream until a WebRTC implementation and signaling service are connected.
