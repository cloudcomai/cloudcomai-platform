# CloudComAI Platform

CloudComAI Platform is the independent monorepo for the CloudComAI web, mobile, shared client packages, and PHP backend applications.

## Repository layout

- `apps/web` — React and Vite web application migrated from `cloudcomai_chat_ui`
- `apps/mobile` — React Native and Expo mobile application foundation
- `packages/api-client` — shared HTTP client boundary
- `packages/auth` — shared authentication contracts and abstractions
- `packages/types` — shared domain types
- `packages/chat-core` — transport-independent chat synchronization boundary
- `packages/validation` — shared validation rules
- `packages/utils` — shared utilities
- `backend` — PHP 8.3 and MySQL backend migrated from `cloudcomai-backend`
- `deployment` — deployment documentation and scripts, separated by application

## Hosting constraints

The production architecture targets static web assets plus PHP 8.3 and MySQL on GoDaddy Web Hosting Starter. Phase 1 does not depend on a Node.js production server, Redis, WebSockets, persistent processes, Docker, Kubernetes, or SSH deployment.

## Local web development

1. Install Node.js and pnpm.
2. Copy `apps/web/.env.example` to `apps/web/.env`.
3. Configure `VITE_API_BASE_URL`.
4. Run `pnpm install` and `pnpm dev:web`.

## Backend setup

See [`backend/README.md`](backend/README.md). Production credentials and generated runtime files must not be committed.

## Implementation status

This branch establishes the approved monorepo foundation by reusing the latest code from the existing frontend and backend repositories. The existing repositories remain unchanged. Production deployment is outside this milestone.

