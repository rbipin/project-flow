# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy project-flow to `projectflow.bipin.io` via Vercel Dashboard + GitHub Actions CI.

**Architecture:** One code change (pnpm build script allowlist) unblocks the existing GitHub Actions pipeline. The pipeline does `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` on every push to `main`. Env vars live in the Vercel dashboard and are fetched by CI at build time.

**Tech Stack:** Next.js 15, pnpm, GitHub Actions, Vercel, Firebase Auth + Firestore

## Global Constraints

- Do not change `NEXT_PUBLIC_DEV_BYPASS_AUTH` to anything other than `false` in production
- Do not commit `.env.local` — it contains secrets
- The workflow file is `.github/workflows/deploy.yml` — do not modify it
- The only code change in this plan is to `package.json`

---

### Task 1: Fix pnpm Build Scripts

**Files:**
- Modify: `package.json` (add `pnpm.onlyBuiltDependencies`)

**Interfaces:**
- Produces: CI `pnpm install` step completes without `ERR_PNPM_IGNORED_BUILDS`

- [ ] **Step 1: Add `onlyBuiltDependencies` to `package.json`**

Open `package.json` and add a top-level `"pnpm"` key. The three packages that need native build scripts are `@firebase/util`, `protobufjs`, and `sharp`:

```json
{
  "name": "project-flow",
  ...existing fields...,
  "pnpm": {
    "onlyBuiltDependencies": ["@firebase/util", "protobufjs", "sharp"]
  }
}
```

- [ ] **Step 2: Verify locally**

```bash
pnpm install --frozen-lockfile
```

Expected: No `ERR_PNPM_IGNORED_BUILDS` warning. Exit code 0.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "fix: allow pnpm build scripts for firebase, protobufjs, sharp"
```

---

### Task 2: Create Vercel Project

**Manual steps — done in the Vercel web dashboard.**

- [ ] **Step 1: Import repo**

Go to https://vercel.com/new → "Import Git Repository" → select `rbipin/project-flow`.

- [ ] **Step 2: Accept auto-detected settings**

Vercel detects Next.js. Leave all framework settings as-is:
- Framework Preset: `Next.js`
- Build Command: (leave blank — uses `next build`)
- Output Directory: (leave blank — auto)
- Install Command: (leave blank — uses `pnpm install`)

- [ ] **Step 3: Do NOT deploy yet**

Click "Configure Project" to expand settings but do NOT click the final deploy button. Env vars must be set first (Task 3).

- [ ] **Step 4: Note your Project ID and Org/Team ID**

After project creation, go to Settings → General. Copy:
- **Project ID** — looks like `prj_xxxxxxxxxxxx`
- **Team ID** (shown as "Org ID" if on a team) — looks like `team_xxxxxxxxxxxx`. If on a personal account, use your user ID from vercel.com/account.

You'll need these in Task 4.

---

### Task 3: Set Environment Variables in Vercel

**Manual steps — done in Vercel Dashboard → project → Settings → Environment Variables.**

Add each variable below. Set the environment to **Production** (and optionally Preview).

- [ ] **Step 1: Add all 9 variables**

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | value from `.env.local` |
| `NEXT_PUBLIC_FIREBASE_OWNER_UID` | value from `.env.local` |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | `false` |

- [ ] **Step 2: Verify**

All 9 variables should appear in the Environment Variables list under Production.

---

### Task 4: Set GitHub Actions Secrets

**Manual steps — done in GitHub repo → Settings → Secrets and variables → Actions.**

- [ ] **Step 1: Create a Vercel token**

Go to https://vercel.com/account/tokens → "Create Token" → name it `github-actions` → copy the token value.

- [ ] **Step 2: Add three secrets**

In GitHub: repo → Settings → Secrets and variables → Actions → New repository secret.

| Secret name | Value |
| --- | --- |
| `VERCEL_TOKEN` | token from Step 1 |
| `VERCEL_PROJECT_ID` | Project ID from Task 2 Step 4 |
| `VERCEL_ORG_ID` | Team/Org ID from Task 2 Step 4 |

- [ ] **Step 3: Trigger a deployment**

Push the commit from Task 1 to `main` (or push any change). This triggers `.github/workflows/deploy.yml`.

```bash
git push origin main
```

- [ ] **Step 4: Verify CI passes**

Go to GitHub → Actions tab → watch the "Deploy to Vercel" workflow run. All steps should be green. The final "Deploy to Vercel" step logs a URL like `https://project-flow-xxxx.vercel.app`.

---

### Task 5: Set Up Custom Domain

**Manual steps — done in Vercel Dashboard and at your DNS provider.**

- [ ] **Step 1: Add domain in Vercel**

Vercel project → Settings → Domains → type `projectflow.bipin.io` → Add.

Vercel shows a DNS record to create — it will be a CNAME:
- Host/Name: `projectflow`
- Value: `cname.vercel-dns.com`

- [ ] **Step 2: Add CNAME at your DNS provider**

Log in to wherever `bipin.io` is managed (Cloudflare, Namecheap, etc.) and create that CNAME record.

- [ ] **Step 3: Wait for propagation**

DNS typically propagates in 5–30 minutes. Vercel auto-provisions an SSL certificate once it resolves. The domain status in Vercel will change from "Invalid Configuration" to a green checkmark.

- [ ] **Step 4: Verify**

Open https://projectflow.bipin.io in a browser. The app should load with a valid SSL certificate.

---

### Task 6: Add Firebase Authorized Domain

**Manual steps — done in Firebase Console.**

Without this step, Google sign-in will fail on the live domain with an "unauthorized domain" error.

- [ ] **Step 1: Add domain**

Go to [Firebase Console](https://console.firebase.google.com) → select project `apps-rbipin` → Authentication → Settings → Authorized domains → Add domain → enter `projectflow.bipin.io`.

- [ ] **Step 2: Verify sign-in**

Open https://projectflow.bipin.io → click Sign In with Google → complete the sign-in flow. Should succeed without any auth domain error.

- [ ] **Step 3: Verify Firestore sync**

After signing in, create a project in the app. Open Firebase Console → Firestore Database → `users/{your-uid}/data/projects`. The document should exist with your project data.

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Test the full flow**

On https://projectflow.bipin.io:
1. Sign in with Google — should succeed
2. Create a new project — should appear on dashboard
3. Open Firestore Console — verify `users/{uid}/data/projects` document updated
4. Open the site in a second browser/incognito — sign in again — projects should sync from Firestore

- [ ] **Step 2: Test the read-only view**

Open https://projectflow.bipin.io/view — should show the owner's projects (loaded via `NEXT_PUBLIC_FIREBASE_OWNER_UID`) without requiring sign-in.

- [ ] **Step 3: Test CI on next push**

Make a trivial change (e.g., update a comment), push to `main`, and confirm the GitHub Actions workflow deploys successfully to the live URL.
