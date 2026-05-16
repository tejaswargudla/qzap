# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**QueueZap** is a virtual queue management system ("Skip the Wait, Not the Line") where users join queues by scanning QR codes and receive push notifications when it's their turn. Built for India-specific use cases (clinics, banks, government offices, restaurants).

## Development

```bash
npm install       # install dependencies
npm run dev       # start local Express server (reads .env.local)
npm run dev:tunnel  # start ngrok + local server (public URL for QR codes)
```

There is no build step, no test suite, and no linter configured. The frontend is static HTML/CSS/JS; the backend is Node.js handler modules that run as serverless functions on Vercel or via the local Express server (`scripts/server.js`) in development.

`scripts/server.js` mounts every `api/` handler onto Express and merges `req.params` into `req.query` so all handlers (which use Vercel's `req.query` convention for URL segments) work unchanged.

## Environment Variables

Set on the Vercel platform (not in a `.env` file):

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT` | Full Firebase service account JSON (stringified) |
| `ADMIN_SECRET` | Bearer token for admin API endpoints |

## Architecture

**Two-tier, no build step:**

- `public/` — Static HTML pages (`index.html`, `login.html`, `admin.html`, `queue.html`)
- `api/` — Vercel serverless functions (Node.js 18+), file path = URL path

**Shared API utilities:**
- `api/_firebase.js` — Firebase Admin SDK singleton (prevents re-init on cold starts)
- `api/_helpers.js` — CORS headers, bearer token auth, Haversine geolocation check

**Database:** Cloud Firestore with two collections:
```
queues/{queueId}           — name, category, lat/lng, radius, status, adminId
  └── entries/{entryId}   — name, email, fcmToken, position, status, joinedAt
```

**API routing** (Vercel file-based):
- `api/queues.js` → `POST /api/queues` (create + generate QR code as data URL)
- `api/queues/list.js` → `GET /api/queues/list`
- `api/queues/[id].js` → `GET|PATCH|DELETE /api/queues/:id`
- `api/queues/[id]/join.js` → `POST /api/queues/:id/join` (location-verified)
- `api/queues/[id]/entries.js` → `GET /api/queues/:id/entries`
- `api/queues/[id]/entries/[entryId].js` → `GET` single entry (user polls position)
- `api/queues/[id]/entries/[entryId]/done.js` → `PATCH` mark done + send FCM
- `api/queues/[id]/entries/[entryId]/remove.js` → `DELETE` remove entry

## Key Implementation Details

**Auth:** Admin endpoints use a hardcoded `Authorization: Bearer <ADMIN_SECRET>` header (Phase 1). Phase 2 (Firebase ID tokens) is not yet implemented.

**Location verification:** `join.js` does server-side Haversine distance check against the queue's stored `lat/lng` and `radius`. Users must be within range to join.

**Position:** Not stored statically — recalculated dynamically from the count of `waiting` entries in Firestore on each read.

**FCM push notifications:** Sent on `done.js` to both the next and second-in-line users when an entry is marked complete.

**Queue deletion:** Uses Firestore batch writes to delete the queue document and all its `entries` subcollection documents atomically.

**Frontend:** Vanilla JS only — no framework. Scroll reveal animations use `IntersectionObserver`. The `queue.html` page is driven by `?id={queueId}` in the URL query string.
