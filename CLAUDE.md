# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
pnpm dev
```

Opens at `http://localhost:3000`. This is a Next.js 15 app using the App Router with TypeScript.

The `samples/` directory contains the original standalone HTML prototype — it is not the active codebase.

## Project Structure

```
src/
  app/
    layout.tsx      — root layout, fonts (Hanken Grotesk, JetBrains Mono)
    page.tsx        — renders <App />
    globals.css     — CSS variables, base styles
  components/
    App.tsx         — app shell, top-level state, routing
    Dashboard.tsx   — project grid/list view
    ProjectDetail.tsx — detail view for a node
    ProjectCard.tsx — card used in grid view
    ProjectRow.tsx  — row used in list view
    Roadmap.tsx     — roadmap rendering (track/stations/stepper variants)
    Ring.tsx        — circular progress ring
    Modal.tsx       — base modal shell
    NewProjectModal.tsx — create project flow
    TweaksPanel.tsx — floating tweaks panel + useTweaks hook
  lib/
    data.ts         — data model, persistence, tree helpers
    types.ts        — shared TypeScript types
```

## Architecture

### Recursive node tree
Every entity — projects, milestones, sub-projects — shares one shape:
```ts
{ id, name, blurb, tasks[], children[], relations[] }
```
- Nodes with `children` are **milestones/roadmap parents**: each child is a sub-project with its own roadmap.
- Nodes with no `children` are **leaf nodes**: they have a task checklist.
- This recursion is unbounded — any milestone can itself contain milestones.

### Path-based navigation
Current location is `path: string[]`, an ordered array of IDs from root to the current node. All tree mutations (`replaceNodeAtPath`, `deleteNodeAtPath`, `findTrail`) take a path array. Navigation is just `setPath(newArray)`.

### Data persistence
Projects are stored in `localStorage` under key `project-tracker:v3`. On first load, `seedProjects()` populates demo data. `saveProjects` / `loadProjects` are the only persistence layer.

`App.tsx` defers localStorage reads to `useEffect` (after hydration) to avoid SSR/client mismatches. The save effect is ordered before the load effect so it skips the initial empty-state write via a `hasLoaded` ref.

### Relationships
Nodes carry `relations: [{ to: nodeId, type: "depends"|"blocks"|"related" }]`. These are one-directional; `gatherRelations()` in `data.ts` resolves both outgoing and incoming edges for display.

### TweaksPanel protocol
`TweaksPanel.tsx` implements a host-side postMessage protocol for an "edit mode" that allows external tooling to read/write tweak values. The `TWEAK_DEFAULTS` object in `App.tsx` is the canonical source for tweak keys and defaults.

### Roadmap variants
The `Roadmap` component accepts `variant: "track" | "stations" | "stepper"` and `mini: boolean`. In `mini` mode, labels are hidden and markers are not clickable — used on dashboard cards. Full mode is used in the detail view with `selectedId` + `onSelect` for click-to-manage.

### Stats derivation
`nodeStats(node)` in `data.ts` recursively derives all display data (progress %, milestone counts, completion state, `markers[]` for roadmap rendering). It is called at render time and never cached — keep it pure and side-effect-free.
