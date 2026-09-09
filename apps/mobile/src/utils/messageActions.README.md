# Message actions

`messageActions.js` is the single source of truth for the mobile long-press action list and forwarding payload shape.

The existing chat screen should use `getMessageLongPressActions()` when rendering its dropdown/action sheet and `buildForwardPayload()` when sending a selected message to another chat. The helpers intentionally do not perform UI or network work.
