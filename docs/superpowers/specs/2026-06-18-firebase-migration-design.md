# Firebase Firestore Migration Design

**Date:** 2026-06-18
**Status:** Approved

## Overview

Migrate Project-Flow's persistence layer from `localStorage` to Firebase Firestore. Goals: multi-device sync, data safety, and enabling the `/view` read-only route to serve live cloud data. Scope is single-user for now, with Google Sign-in as the auth mechanism.

## Data Structure

One Firestore document holds the entire project tree, mirroring the current localStorage blob:

```
/users/{userId}/data/projects
  → { projects: ProjectNode[] }
```

One read on load, one write on save. No per-project documents, no schema migrations. The `ProjectNode[]` shape is unchanged.

## Auth

**Google Sign-in** via Firebase Authentication.

- On first app load, if no active session, render a centered "Sign in with Google" button in place of the dashboard.
- After sign-in, Firebase persists the session — subsequent visits auto-sign in silently.
- Firestore security rules split read and write permissions:
  ```
  allow read: if true;
  allow write: if request.auth.uid == "<owner-uid>";
  ```
- Reads are public — anyone with the document path can read. This is required for the `/view` share link to work without forcing recipients to sign in.
- Writes are locked to the owner's UID, set once in the Firestore rules after the first sign-in.

### Local Development Bypass

Set `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` in `.env.local` to skip Google Sign-in during development. When the flag is present, `getAuthUser()` in `lib/firebase.ts` returns a hardcoded `{ uid: "dev-user" }` object and skips all Firebase Auth calls. Firestore reads/writes use the path `/users/dev-user/data/projects`.

`.env.local` is gitignored — the bypass never reaches production.

## New Files

### `lib/firebase.ts`
- Initializes the Firebase app from env vars (`NEXT_PUBLIC_FIREBASE_*`)
- Exports `db` (Firestore client) and `auth` (Auth client)
- Exports `getAuthUser(): Promise<{ uid: string } | null>` — returns the real Firebase user, the dev bypass user, or `null` if signed out
- Exports `signInWithGoogle()` and `signOut()`

## Changed Files

### `lib/data.ts`
- Replace synchronous `loadProjects()` / `saveProjects()` with async `fetchProjects(uid: string): Promise<ProjectNode[]>` and `persistProjects(uid: string, projects: ProjectNode[]): Promise<void>`
- `fetchProjects`: reads `/users/{uid}/data/projects`. If the document doesn't exist, checks `localStorage` for existing data (one-time migration), writes it to Firestore, and returns it.
- `persistProjects`: writes `{ projects }` to `/users/{uid}/data/projects`.

### `App.tsx`
- Adds auth state: `'loading' | 'signed-out' | 'signed-in'`
- On mount: calls `getAuthUser()`. If signed in, calls `fetchProjects(uid)` and enters normal app flow. If signed out, renders the sign-in screen. If loading, renders nothing (avoids flash).
- The save `useEffect` calls `persistProjects(uid, projects)` instead of `saveProjects()`.
- Renders a `<SignInScreen>` component (new, small) when `authState === 'signed-out'`.

### `ViewApp.tsx`
- On mount: calls `getAuthUser()`, then `fetchProjects(uid)` to load data.
- Read-only — never calls `persistProjects`.
- Reads are unauthenticated — no sign-in required to view a shared `/view` link. `getAuthUser()` is not called in `ViewApp.tsx`; `fetchProjects` uses a hardcoded owner UID (from env var `NEXT_PUBLIC_FIREBASE_OWNER_UID`) to locate the document.

## One-Time localStorage Migration

On the first `fetchProjects` call after migration, if the Firestore document does not exist:
1. Read `localStorage.getItem('project-tracker:v3')`
2. Parse and write to Firestore
3. Leave the localStorage key in place as a fallback (do not clear it)

This is handled inside `fetchProjects` transparently — no separate migration script or user action required.

## Auth State in UI

`App.tsx` renders one of three states:

| Auth state | Renders |
|---|---|
| `loading` | Nothing (blank, no flash) |
| `signed-out` | `<SignInScreen>` — centered card with "Sign in with Google" button |
| `signed-in` | Full app as today |

`SignInScreen` is a small new component — a centered card with the app name and a single Google sign-in button. No navigation, no project data.

## Environment Variables

All prefixed `NEXT_PUBLIC_` so they're available in the browser bundle. Set in Vercel project settings for production; in `.env.local` for development.

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_OWNER_UID  # your UID, used by /view to locate the data document
NEXT_PUBLIC_DEV_BYPASS_AUTH     # dev only, in .env.local
```

## Out of Scope

- Multi-user support (other users' projects)
- Real-time listeners / live sync across open tabs (can be added later via `onSnapshot`)
- Firebase Hosting (app stays on Vercel)
- Offline persistence (Firestore's built-in IndexedDB cache provides basic offline reads automatically; explicit `enableIndexedDbPersistence` not configured)
