# CloudComAI Frontend Beta

React + Vite frontend for the CloudComAI Messenger beta.

## Included UI
- Registration and login
- Contact-interest personalization
- Private chat screen
- Reply to any accessible message
- One-time message editing UI
- Audio/video call screens
- Live-location sharing screen
- Poll creation screen
- Status/Stories screen
- Required group-category dropdown
- Group shortcut option
- Group-specific sharing actions
- Responsive desktop/mobile design

## Local setup
1. Install Node.js 20 or later.
2. Copy `.env.example` to `.env`.
3. Set `VITE_API_BASE_URL` to your backend URL.
4. Run:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

The production files will be generated in `dist/`.

## GoDaddy deployment
See `GODADDY_FRONTEND_DEPLOYMENT.md`.

## Important
This is a functional beta foundation. Production audio/video calls require WebRTC signaling and STUN/TURN services. Production maps require a map provider and secure API configuration. End-to-end encryption requires a separately reviewed cryptographic design.
