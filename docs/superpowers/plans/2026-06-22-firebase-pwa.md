# Firebase + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate Project-Flow to an offline-first PWA with Google Sign-in, Firestore background sync, and installability.

**Architecture:** localStorage remains the primary store — all reads/writes are instant and offline-safe. Firebase Firestore is a background sync target only: writes are fire-and-forget, reads happen async on load and on reconnect. Conflict resolution is last-write-wins via `lastModified`. Google Auth gates the editor; the `/view` read-only route reads Firestore directly using a pre-configured owner UID with no auth required.

**Tech Stack:** Firebase JS SDK v10+, `@ducanh2912/next-pwa`, Next.js 15 App Router, TypeScript.

## Prerequisite

**The read-only view plan must be completed first.**
`docs/superpowers/plans/2026-06-17-read-only-view.md`

This plan depends on `src/components/ViewApp.tsx` and `src/components/ProjectsShell.tsx` existing. Do not start Task 7 until those files exist.

## Global Constraints

- All `NEXT_PUBLIC_FIREBASE_*` env vars are set in `.env.local` (never committed).
- `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` in `.env.local` skips Firebase Auth in development.
- localStorage keys unchanged: `project-tracker:v3`, `project-tracker:view`, `project-tracker:theme`.
- `saveProjects` signature unchanged — callers pass only `ProjectNode[]`.
- Firestore document path: `/users/{uid}/data/projects`.
- `pushToFirestore` errors are logged but never thrown — Firebase is never in the critical path.
- PWA disabled in development (`NODE_ENV === 'development'`).
- No test framework — verification is `pnpm type-check`, `pnpm build`, and manual browser checks.
- All file paths are project-relative to `/Users/bipin/repo/project-flow`.

---

## File Structure

| File | New / Modify | Responsibility |
|------|-------------|----------------|
| `src/lib/firebase.ts` | Create | Firebase app init, auth exports, `subscribeToAuthState`, `signInWithGoogle`, `signOut` |
| `src/lib/sync.ts` | Create | `pushToFirestore`, `pullFromFirestore`, `syncOnLoad`, `syncOnReconnect`, `setActiveUid` |
| `src/lib/data.ts` | Modify | `saveProjects` writes `{ projects, lastModified }` shape; `loadProjects` parses both old and new shape; `seedProjects` sets `lastModified` |
| `src/components/SignInScreen.tsx` | Create | Google sign-in UI shown when `authState === 'signed-out'` |
| `src/components/App.tsx` | Modify | Auth state machine, Firestore sync on load + reconnect |
| `src/components/ViewApp.tsx` | Modify | Reads from Firestore via owner UID instead of localStorage |
| `next.config.ts` | Modify | Wrapped with `withPWA` |
| `public/manifest.json` | Create | PWA manifest |
| `public/icons/` | Create | 192×192 and 512×512 app icons |

---

## Task 1: Install packages

**Files:** none (package.json updated by package manager)

- [ ] **Step 1: Install Firebase and next-pwa**

```bash
pnpm add firebase @ducanh2912/next-pwa
```

- [ ] **Step 2: Verify install**

```bash
pnpm type-check
```

Expected: exit 0. If `firebase` types are missing, run `pnpm add -D @firebase/app-types` — but they're bundled in the v10 SDK so this should not be needed.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add firebase and next-pwa packages"
```

---

## Task 2: Create `src/lib/firebase.ts`

Initializes the Firebase app once (guards against double-init in Next.js hot-reload), exports the Firestore client, auth client, and a `subscribeToAuthState` function that handles the dev bypass.

**Files:**
- Create: `src/lib/firebase.ts`

**Interfaces — Produces:**
```ts
export const db: Firestore
export const auth: Auth
export function subscribeToAuthState(cb: (user: { uid: string } | null) => void): () => void
export function signInWithGoogle(): Promise<void>
export function signOut(): Promise<void>
```

- [ ] **Step 1: Create `src/lib/firebase.ts`**

```ts
import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db: Firestore = getFirestore(app);
export const auth: Auth = getAuth(app);

export function subscribeToAuthState(
  callback: (user: { uid: string } | null) => void,
): () => void {
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true') {
    callback({ uid: 'dev-user' });
    return () => {};
  }
  return onAuthStateChanged(auth, (user) =>
    callback(user ? { uid: user.uid } : null),
  );
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase.ts
git commit -m "feat: add Firebase client initialization"
```

---

## Task 3: Create `src/lib/sync.ts`

All Firestore read/write logic lives here. `data.ts` and `App.tsx` never import from `firebase/firestore` directly.

**Files:**
- Create: `src/lib/sync.ts`

**Interfaces — Produces:**
```ts
export function setActiveUid(uid: string | null): void
export function getActiveUid(): string | null
export async function pushToFirestore(uid: string, projects: ProjectNode[], lastModified: string): Promise<void>
export async function pullFromFirestore(uid: string): Promise<{ projects: ProjectNode[]; lastModified: string } | null>
export async function syncOnLoad(uid: string): Promise<ProjectNode[] | null>
export function syncOnReconnect(uid: string): () => void
```

- [ ] **Step 1: Create `src/lib/sync.ts`**

```ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ProjectNode } from './types';

const STORAGE_KEY = 'project-tracker:v3';

let activeUid: string | null = null;
export function setActiveUid(uid: string | null): void { activeUid = uid; }
export function getActiveUid(): string | null { return activeUid; }

type SyncDoc = { projects: ProjectNode[]; lastModified: string };

function docRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'projects');
}

export async function pushToFirestore(
  uid: string,
  projects: ProjectNode[],
  lastModified: string,
): Promise<void> {
  try {
    await setDoc(docRef(uid), { projects, lastModified });
  } catch (e) {
    console.error('[sync] push failed', e);
  }
}

export async function pullFromFirestore(uid: string): Promise<SyncDoc | null> {
  try {
    const snap = await getDoc(docRef(uid));
    if (!snap.exists()) return null;
    return snap.data() as SyncDoc;
  } catch (e) {
    console.error('[sync] pull failed', e);
    return null;
  }
}

function readLocalRaw(): { projects: ProjectNode[]; lastModified: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { projects: parsed, lastModified: '1970-01-01T00:00:00.000Z' };
    }
    return { projects: parsed.projects ?? [], lastModified: parsed.lastModified ?? '1970-01-01T00:00:00.000Z' };
  } catch (_) {
    return null;
  }
}

export async function syncOnLoad(uid: string): Promise<ProjectNode[] | null> {
  const remote = await pullFromFirestore(uid);

  if (!remote) {
    // No remote doc — bootstrap Firestore from current local state
    const local = readLocalRaw();
    if (local) {
      pushToFirestore(uid, local.projects, local.lastModified);
    }
    return null;
  }

  const local = readLocalRaw();
  const localTs = local?.lastModified ?? '1970-01-01T00:00:00.000Z';
  if (remote.lastModified > localTs) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projects: remote.projects, lastModified: remote.lastModified }),
      );
    } catch (_) {}
    return remote.projects;
  }

  return null;
}

export function syncOnReconnect(uid: string): () => void {
  const handler = () => {
    const local = readLocalRaw();
    if (!local) return;
    pushToFirestore(uid, local.projects, local.lastModified);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/sync.ts
git commit -m "feat: add Firestore sync layer"
```

---

## Task 4: Update `src/lib/data.ts`

Three changes: (1) `saveProjects` wraps data in `{ projects, lastModified }` and fire-and-forgets to Firestore. (2) `loadProjects` handles both the old raw-array format and the new object format. (3) `seedProjects` write path is unchanged — `saveProjects` now handles `lastModified` itself.

**Files:**
- Modify: `src/lib/data.ts`

**Interfaces — Consumes:**
```ts
// from sync.ts
getActiveUid(): string | null
pushToFirestore(uid, projects, lastModified): Promise<void>
```

- [ ] **Step 1: Add sync import to `data.ts`**

At the top of `src/lib/data.ts`, after the existing imports, add:

```ts
import { getActiveUid, pushToFirestore } from './sync';
```

- [ ] **Step 2: Replace `saveProjects`**

Replace the existing `saveProjects` function:

```ts
export function saveProjects(projects: ProjectNode[]): void {
  if (typeof window === 'undefined') return;
  const lastModified = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, lastModified }));
  } catch (_) {}
  const uid = getActiveUid();
  if (uid) pushToFirestore(uid, projects, lastModified);
}
```

- [ ] **Step 3: Replace `loadProjects`**

Replace the existing `loadProjects` function:

```ts
export function loadProjects(): ProjectNode[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : (parsed.projects ?? []);
    }
  } catch (_) {}
  const seed = seedProjects();
  saveProjects(seed);
  return seed;
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 5: Manual smoke — verify existing save/load still works**

```bash
pnpm dev
```

Open `http://localhost:3000`. Add a task, reload the page — confirm task persists. (Firebase push will fail silently since uid isn't set yet — that's expected at this stage.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: update data.ts to sync lastModified shape with Firestore"
```

---

## Task 5: Create `src/components/SignInScreen.tsx`

A full-screen sign-in page shown when auth state is `'signed-out'`. Calls `signInWithGoogle()` on button click. No state — the auth subscription in `App.tsx` drives the transition.

**Files:**
- Create: `src/components/SignInScreen.tsx`

**Interfaces — Consumes:**
```ts
// from firebase.ts
signInWithGoogle(): Promise<void>
```

- [ ] **Step 1: Create `src/components/SignInScreen.tsx`**

```tsx
'use client';

import { signInWithGoogle } from '@/lib/firebase';

export function SignInScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        fontFamily: 'inherit',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Project Flow</h1>
      <p style={{ color: 'var(--ink-2, #666)', margin: 0 }}>Sign in to access your projects.</p>
      <button
        className="btn primary lg"
        onClick={() => signInWithGoogle()}
        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/SignInScreen.tsx
git commit -m "feat: add SignInScreen component"
```

---

## Task 6: Wire auth + sync into `App.tsx`

Adds three new pieces to `App.tsx`: (1) `authState` state machine (`'loading' | 'signed-out' | 'signed-in'`), (2) a `subscribeToAuthState` effect that drives transitions, (3) a load+sync effect that fires when `authState` becomes `'signed-in'`. Replaces the single load effect that previously ran unconditionally on mount.

**Files:**
- Modify: `src/components/App.tsx`

**Interfaces — Consumes:**
```ts
// from firebase.ts
subscribeToAuthState(cb: (user: { uid: string } | null) => void): () => void
signOut(): Promise<void>
// from sync.ts
setActiveUid(uid: string | null): void
syncOnLoad(uid: string): Promise<ProjectNode[] | null>
syncOnReconnect(uid: string): () => void
// from components
SignInScreen
```

- [ ] **Step 1: Add new imports to `App.tsx`**

Add to the import block at the top of `src/components/App.tsx`:

```ts
import { subscribeToAuthState, signOut } from '@/lib/firebase';
import { setActiveUid, syncOnLoad, syncOnReconnect } from '@/lib/sync';
import { SignInScreen } from './SignInScreen';
```

- [ ] **Step 2: Add `authState` and `uid` state**

Inside the `App` function, after the existing `useState` declarations, add:

```ts
const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
const [uid, setUid] = useState<string | null>(null);
```

- [ ] **Step 3: Replace the load `useEffect` with auth subscription + auth-gated load**

The current `App.tsx` has a single `useEffect` that calls `loadProjects()` and reads localStorage preferences. Replace that effect with two effects:

**Effect A — auth subscription (replaces the `hasLoaded` + `setMounted` part of the old load effect):**

```ts
useEffect(() => {
  return subscribeToAuthState((user) => {
    if (user) {
      setUid(user.uid);
      setActiveUid(user.uid);
      setAuthState('signed-in');
    } else {
      setUid(null);
      setActiveUid(null);
      setAuthState('signed-out');
    }
  });
}, []);
```

**Effect B — load + sync when signed in (replaces the body of the old load effect):**

```ts
useEffect(() => {
  if (authState !== 'signed-in' || !uid) return;

  try {
    const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list';
    if (stored) setDashView(stored);
  } catch (_) {}
  try {
    setDark(localStorage.getItem('project-tracker:theme') === 'dark');
  } catch (_) {}

  setProjects(loadProjects());
  hasLoaded.current = true;
  setMounted(true);

  syncOnLoad(uid).then((remoteProjects) => {
    if (remoteProjects) setProjects(remoteProjects);
  });

  const cleanup = syncOnReconnect(uid);
  return cleanup;
}, [authState, uid]);
```

Remove the old load `useEffect` that previously contained these lines.

- [ ] **Step 4: Update the render block**

Replace `if (!mounted) return null;` with the auth-aware guard:

```tsx
if (authState === 'loading') return null;
if (authState === 'signed-out') return <SignInScreen />;
if (!mounted) return null;
```

- [ ] **Step 5: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 6: Manual smoke — dev bypass auth**

`.env.local` must have `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`.

```bash
pnpm dev
```

Open `http://localhost:3000`. Confirm:
- App loads without showing the sign-in screen.
- Projects load from localStorage.
- Creating/editing projects still works.
- Check the browser console — you may see a `[sync] push failed` error because Firestore rules haven't been set yet. That's expected and safe.

- [ ] **Step 7: Commit**

```bash
git add src/components/App.tsx
git commit -m "feat: wire Google auth and Firestore sync into App"
```

---

## Task 7: Update `ViewApp.tsx` to read from Firestore

**Prerequisite:** `src/components/ViewApp.tsx` must exist (created by the read-only view plan).

Replace the `loadProjects()` localStorage call with a `pullFromFirestore` call using `NEXT_PUBLIC_FIREBASE_OWNER_UID`. Add a loading state and "No projects found" fallback.

**Files:**
- Modify: `src/components/ViewApp.tsx`

**Interfaces — Consumes:**
```ts
// from sync.ts
pullFromFirestore(uid: string): Promise<{ projects: ProjectNode[]; lastModified: string } | null>
```

- [ ] **Step 1: Add import to `ViewApp.tsx`**

Add to the import block at the top of `src/components/ViewApp.tsx`:

```ts
import { pullFromFirestore } from '@/lib/sync';
```

Remove the `loadProjects` import from `@/lib/data` if it is no longer used by ViewApp.

- [ ] **Step 2: Replace the load `useEffect`**

Find the `useEffect` in `ViewApp.tsx` that calls `loadProjects()` and replace its body:

```ts
useEffect(() => {
  const ownerUid = process.env.NEXT_PUBLIC_FIREBASE_OWNER_UID;
  if (!ownerUid) {
    setMounted(true);
    return;
  }

  try {
    const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list' | null;
    if (stored) setViewState(stored);
  } catch (_) {}
  try {
    setDark(localStorage.getItem('project-tracker:theme') === 'dark');
  } catch (_) {}

  pullFromFirestore(ownerUid).then((data) => {
    if (data) setProjects(data.projects);
    setMounted(true);
  });
}, []);
```

- [ ] **Step 3: Add "No projects found" fallback**

After `if (!mounted) return null;` in the ViewApp render, add:

```tsx
if (projects.length === 0) {
  return (
    <div className="app">
      <div className="readonly-badge" aria-label="Read-only mode">Read-only</div>
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--ink-2, #666)' }}>
        No projects found.
      </div>
      <ThemeToggle dark={dark} onToggle={toggleTheme} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewApp.tsx
git commit -m "feat: ViewApp reads from Firestore instead of localStorage"
```

---

## Task 8: Set Firestore security rules

This is a one-time manual step done in the Firebase console. No code changes.

- [ ] **Step 1: Sign in to the app and find your UID**

Set `NEXT_PUBLIC_DEV_BYPASS_AUTH=` (empty, or remove the line) in `.env.local` temporarily to force real Google auth. Run `pnpm dev`, visit `http://localhost:3000`, and sign in with Google.

In the browser console, run:
```js
// After sign-in, the UID is in the Firebase auth object
// App.tsx logs nothing, so use the Firebase SDK directly:
firebase.auth().currentUser.uid
```

Or: in Firebase Console → Authentication → Users tab — your UID appears in the "User UID" column.

- [ ] **Step 2: Copy the UID into `.env.local`**

```bash
NEXT_PUBLIC_FIREBASE_OWNER_UID=paste_your_uid_here
```

Re-enable dev bypass if desired: `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`.

- [ ] **Step 3: Set Firestore security rules**

In Firebase Console → Firestore Database → Rules tab, replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/data/projects {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == "YOUR_UID_HERE";
    }
  }
}
```

Replace `YOUR_UID_HERE` with the actual UID from Step 1. Click **Publish**.

- [ ] **Step 4: Verify Firestore write works**

Set `NEXT_PUBLIC_DEV_BYPASS_AUTH=` (empty) to use real auth. Run `pnpm dev`, sign in, create or edit a project. In Firebase Console → Firestore Database → Data tab, confirm `/users/{your-uid}/data/projects` contains your data.

- [ ] **Step 5: Re-enable dev bypass**

```bash
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

- [ ] **Step 6: Verify `/view` reads from Firestore**

Navigate to `http://localhost:3000/view`. Confirm projects appear (pulled from Firestore).

---

## Task 9: PWA setup

Makes the app installable and offline-capable.

**Files:**
- Modify: `next.config.ts`
- Create: `public/manifest.json`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`

- [ ] **Step 1: Generate icons**

From the project root, generate icons from `assets/cover.png` (or any square source image):

```bash
npx pwa-asset-generator assets/cover.png public/icons --icon-only --background "#ffffff" --manifest public/manifest.json --index src/app/layout.tsx
```

If `assets/cover.png` doesn't exist, use any square PNG (≥512×512). The command creates `public/icons/icon-192.png` and `public/icons/icon-512.png` and writes the manifest.

If you'd prefer to skip the generator and create files manually, use Step 1b instead:

**Step 1b (manual alternative):** Copy any 192×192 PNG to `public/icons/icon-192.png` and any 512×512 PNG to `public/icons/icon-512.png`. Then create `public/manifest.json` in Step 2 manually.

- [ ] **Step 2: Verify or create `public/manifest.json`**

If the pwa-asset-generator created it, open it and confirm the content. If creating manually, write `public/manifest.json`:

```json
{
  "name": "Project Flow",
  "short_name": "ProjectFlow",
  "description": "Offline-first project tracker",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#E8772E",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 3: Update `next.config.ts`**

Read the current `next.config.ts`:
```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

Replace it with:

```ts
import type { NextConfig } from 'next';
import withPWAInit from '@ducanh2912/next-pwa';

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
});

const nextConfig: NextConfig = {};

export default withPWA(nextConfig);
```

- [ ] **Step 4: Add manifest link to layout**

If pwa-asset-generator didn't already add it, open `src/app/layout.tsx` and ensure the `<head>` includes:

```tsx
<link rel="manifest" href="/manifest.json" />
```

- [ ] **Step 5: Type-check**

```bash
pnpm type-check
```

Expected: exit 0.

- [ ] **Step 6: Build to verify PWA output**

```bash
pnpm build
```

Expected: build succeeds. In the output, you should see `Service Worker` or `sw.js` generated into `public/`.

- [ ] **Step 7: Commit**

```bash
git add next.config.ts public/manifest.json public/icons/
git commit -m "feat: add PWA support with manifest and service worker"
```

---

## Task 10: End-to-end manual verification

No new code — exercise the full feature through the browser.

- [ ] **Step 1: Start dev server**

```bash
pnpm dev
```

- [ ] **Step 2: Auth flow**

Temporarily set `NEXT_PUBLIC_DEV_BYPASS_AUTH=` (empty). Visit `http://localhost:3000`. Confirm:
- Sign-in screen appears.
- Click "Sign in with Google" — Google OAuth popup opens.
- After sign-in, app loads with projects from localStorage.
- Reload page — auto-sign-in, app loads immediately without sign-in screen.

- [ ] **Step 3: Firestore sync on edit**

Edit a project name. In Firebase Console → Firestore → Data, confirm `/users/{uid}/data/projects` updates within a few seconds.

- [ ] **Step 4: Cross-device sync simulation**

Open a private/incognito window and navigate to `http://localhost:3000/view`. Confirm the same projects appear (pulled from Firestore, not localStorage).

- [ ] **Step 5: Offline edit + reconnect sync**

In DevTools → Network → throttle to "Offline". Edit a project. Firebase push fails silently (expected). Switch network back to "Online". The `online` event fires — confirm in Firestore that the edit appears after reconnect.

- [ ] **Step 6: `/view` empty state**

In Firebase Console, temporarily delete the projects document. Reload `/view`. Confirm "No projects found." renders and no JS error occurs.

- [ ] **Step 7: Re-enable dev bypass**

```bash
NEXT_PUBLIC_DEV_BYPASS_AUTH=true
```

- [ ] **Step 8: Build + type-check**

```bash
pnpm type-check && pnpm build
```

Expected: both succeed.

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `lib/firebase.ts` — init, db, auth, getAuthUser, signInWithGoogle, signOut | Task 2 |
| `lib/sync.ts` — push/pull/syncOnLoad/syncOnReconnect | Task 3 |
| `data.ts` saveProjects with lastModified, fire-and-forget push | Task 4 |
| `data.ts` loadProjects reads projects array | Task 4 |
| `seedProjects` sets lastModified | Task 4 (via saveProjects) |
| Auth state machine in App.tsx | Task 6 |
| syncOnLoad + syncOnReconnect wired in App.tsx | Task 6 |
| SignInScreen shown when signed out | Tasks 5 + 6 |
| ViewApp reads from Firestore via owner UID | Task 7 |
| ViewApp "No projects found" fallback | Task 7 |
| Firestore security rules | Task 8 |
| PWA manifest + service worker | Task 9 |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` dev bypass | Tasks 2 + 6 |
| One-time localStorage → Firestore bootstrap | Task 3 (syncOnLoad no-remote branch) |
| `window` `online` reconnect sync | Task 3 (syncOnReconnect) |

**Type consistency:**
- `pushToFirestore(uid, projects, lastModified)` — consistent across Task 3 (definition), Task 4 (caller), Task 6 (indirect via saveProjects).
- `setActiveUid` defined in Task 3, called in Task 6.
- `syncOnLoad` returns `ProjectNode[] | null` — consistent with Task 6 `.then((remoteProjects) => ...)`.
- `pullFromFirestore` returns `{ projects, lastModified } | null` — consistent with Task 7 `data.projects`.

No placeholders. No TBDs.
