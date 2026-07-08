# Vercel Deployment Design

**Date:** 2026-07-07
**Goal:** Deploy project-flow to production at `projectflow.bipin.io` using Vercel Dashboard + GitHub Actions CI.

## Overview

The app is deployed via a GitHub Actions pipeline that already exists in `.github/workflows/deploy.yml`. The pipeline runs `vercel pull` → `vercel build` → `vercel deploy` on every push to main. The Vercel project is created via dashboard; env vars live in Vercel and are fetched by CI at build time.

## Steps

### 1. Vercel Project Creation (Dashboard)

- Go to vercel.com/new and import the GitHub repo `rbipin/project-flow`
- Vercel auto-detects Next.js — no framework override needed
- Do not deploy yet; finish env var and secret setup first

### 2. Environment Variables (Vercel Dashboard)

In the Vercel project → Settings → Environment Variables, add all 9 vars for the **Production** environment:

| Variable | Source |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `.env.local` |
| `NEXT_PUBLIC_FIREBASE_OWNER_UID` | `.env.local` |
| `NEXT_PUBLIC_DEV_BYPASS_AUTH` | `false` (must be explicit) |

### 3. GitHub Secrets

Set these in GitHub repo → Settings → Secrets and variables → Actions:

| Secret | How to get it |
|---|---|
| `VERCEL_TOKEN` | vercel.com → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | `.vercel/project.json` after linking project with CLI once, or Vercel team settings |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after linking |

To get `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` without the CLI: Vercel Dashboard → project → Settings → General → scroll to "Project ID" and "Team ID".

### 4. Code Fix: pnpm Build Scripts

pnpm 9+ blocks native build scripts by default. Three dependencies need to run postinstall scripts (`@firebase/util`, `protobufjs`, `sharp`). Add this to `package.json`:

```json
"pnpm": {
  "onlyBuiltDependencies": ["@firebase/util", "protobufjs", "sharp"]
}
```

This is the only code change required.

### 5. Custom Domain (Vercel Dashboard)

- Vercel project → Settings → Domains → Add `projectflow.bipin.io`
- Vercel shows a CNAME record: `projectflow` → `cname.vercel-dns.com`
- Add that CNAME at your DNS provider
- Vercel auto-provisions SSL once DNS propagates (~5–30 min)

### 6. Firebase Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains, add:
- `projectflow.bipin.io`

Without this, Google sign-in will be blocked on the live domain.

## What Does Not Need to Change

- `next.config.ts` — PWA is already configured correctly (disabled in dev, enabled in prod)
- `src/lib/sync.ts` — Firestore sync is fully wired
- `.github/workflows/deploy.yml` — pipeline is correct once secrets are in place

## Success Criteria

1. Push to `main` triggers the GitHub Actions workflow and completes without error
2. `https://projectflow.bipin.io` loads the app
3. Google sign-in works on the live domain
4. Firestore sync works after sign-in (projects persist across devices)
