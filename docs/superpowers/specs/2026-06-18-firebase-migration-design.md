# Firebase Firestore Migration + PWA Design

**Date:** 2026-06-18
**Status:** Approved

## Overview

Migrate Project-Flow to an offline-first PWA. Data is always read from and written to `localStorage` immediately (no latency, works offline). Firebase Firestore acts as a background sync target — changes are pushed asynchronously after every local write, and pulled on app load if Firestore has a newer version. Conflict resolution is last-write-wins using a `lastModified` timestamp.

## Architecture

```
Read path:   localStorage → render (instant)
             ↓ async
             Firestore → if newer, update localStorage + re-render

Write path:  localStorage (sync, immediate)
             ↓ fire-and-forget
             Firestore (async, non-blocking)
```

The app is always responsive. Firebase is never in the critical path.

## Data Shape

A `lastModified` ISO timestamp is added to the persisted object in both stores:

```ts
// localStorage key: 'project-tracker:v3'
// Firestore: /users/{uid}/data/projects
{
  projects: ProjectNode[],  // unchanged
  lastModified: string      // ISO 8601, e.g. "2026-06-18T10:32:00.000Z"
}
```

`ProjectNode` shape is unchanged.

## Conflict Resolution

Last-write-wins using `lastModified`:

- On load: read localStorage, render immediately, then fetch Firestore async. If Firestore `lastModified` > local `lastModified`, overwrite localStorage and re-render.
- On save: write localStorage with updated `lastModified`, then push to Firestore async.
- On reconnect (`window` `online` event): push current local state to Firestore (handles writes made while offline).

No UI prompt, no merge logic. For a single-user tool, data-loss from conflicts is negligible — the last device to save wins.

## Auth

**Google Sign-in** via Firebase Authentication. Same as original design:

- On first load, if signed out, render `<SignInScreen>` instead of the dashboard.
- After sign-in, Firebase persists the session — subsequent visits auto-sign in silently.
- Firestore rules split read and write permissions:
  ```
  allow read: if true;
  allow write: if request.auth.uid == "<owner-uid>";
  ```
- Public reads allow the `/view` share route to work without recipients signing in.
- The owner UID is set once in the Firestore rules after first sign-in.

### Local Development Bypass

Set `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` in `.env.local`. When present, `getAuthUser()` returns `{ uid: "dev-user" }` and skips all Firebase Auth calls. `.env.local` is gitignored — never ships to production.

## PWA

Project-Flow becomes installable and fully offline-capable.

### Files added
- `public/manifest.json` — app name, short name, theme color, display: `standalone`, icons
- `public/icons/` — icon set at 192×192 and 512×512 (generated from `assets/cover.png`)
- `next.config.ts` — wrapped with `next-pwa` to generate a service worker at build time

### Service worker behaviour
- Caches the app shell (JS bundles, CSS, fonts) on install
- Serves cached assets when offline
- Does not cache Firestore responses — sync is handled by the app layer, not the SW

### Package
Use `@ducanh2912/next-pwa` (the actively maintained fork of `next-pwa`).

## New Files

### `lib/firebase.ts`
- Initializes Firebase app from `NEXT_PUBLIC_FIREBASE_*` env vars
- Exports `db` (Firestore client), `auth` (Auth client)
- Exports `getAuthUser(): Promise<{ uid: string } | null>`
- Exports `signInWithGoogle()`, `signOut()`

### `lib/sync.ts`
Owns all sync logic. Keeps Firebase out of `data.ts` and `App.tsx`.

- `pushToFirestore(uid, projects, lastModified)` — writes `{ projects, lastModified }` to Firestore. Fire-and-forget; logs errors but does not throw.
- `pullFromFirestore(uid): Promise<{ projects, lastModified } | null>` — reads Firestore document. Returns `null` if offline or document missing.
- `syncOnLoad(uid)` — called once after app mounts. Pulls from Firestore, compares `lastModified`, updates localStorage and returns new projects if Firestore is newer.
- `syncOnReconnect(uid)` — registered on `window` `online` event. Pushes current localStorage state to Firestore.

## Changed Files

### `lib/data.ts`
- `saveProjects(projects)` — writes `{ projects, lastModified: new Date().toISOString() }` to localStorage, then calls `pushToFirestore` (fire-and-forget, no `await`).
- `loadProjects()` — unchanged. Reads `projects` array from localStorage synchronously.
- `seedProjects()` — sets `lastModified` when writing initial seed data.

### `App.tsx`
- Auth state: `'loading' | 'signed-out' | 'signed-in'`
- On mount:
  1. Check `getAuthUser()` → if signed out, show `<SignInScreen>`
  2. If signed in, `loadProjects()` → render immediately
  3. Kick off `syncOnLoad(uid)` async — if it returns newer projects, update state
  4. Register `syncOnReconnect(uid)` on `window` `online` event
- Save `useEffect` unchanged in structure — `saveProjects()` now handles the async push internally.
- Renders `<SignInScreen>` (new component) when signed out.

### `ViewApp.tsx`
- Reads directly from Firestore (not localStorage — viewer is on a different device/browser).
- Uses `NEXT_PUBLIC_FIREBASE_OWNER_UID` to locate the document — no auth required for reads.
- Falls back to a "No projects found" empty state if Firestore is unreachable.

### `next.config.ts`
- Wrapped with `withPWA` from `@ducanh2912/next-pwa`.
- PWA disabled in development (`disable: process.env.NODE_ENV === 'development'`).

## Environment Variables

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_OWNER_UID   # your UID, used by /view to locate the data document
NEXT_PUBLIC_DEV_BYPASS_AUTH      # dev only, in .env.local
```

## One-Time localStorage Migration

On the first `syncOnLoad` call, if the Firestore document does not exist:
1. Read current localStorage data
2. Push it to Firestore as the initial state
3. Leave localStorage intact

## Out of Scope

- Multi-user support
- Real-time listeners across open tabs (`onSnapshot`) — can be added later
- Firebase Hosting (app stays on Vercel)
- Background sync via Service Worker Push API — the `online` event approach is sufficient
- Explicit IndexedDB upgrade — localStorage is retained as the local store
