# Project Flow

![cover image](./assets/cover.jpeg)

<p align="center">
  <em>A local-first project tracker with recursive milestones, roadmaps, and progress rings. All data lives in your browser's localStorage — no backend, no accounts</em>
</p>

## Features

- **Recursive node tree** — projects contain milestones, milestones can contain sub-projects, indefinitely.
- **Three roadmap styles** — track, stations, stepper; switch anytime via the tweaks panel.
- **Progress rings** — circular ring on every card and detail view, derived on the fly from task state.
- **Relationships** — link nodes as "depends on", "blocks", or "related to"; incoming and outgoing edges both resolve.
- **Read-only view** — share a browsable snapshot at `/view` (dashboard) or `/view/<id>/...` (any project or sub-project) with all edit controls hidden.
- **Light / dark theme** — persisted per browser.
- **Grid / list toggle** — persisted per browser.

## Getting started

```bash
pnpm install
pnpm dev
```

Opens at `http://localhost:3000`. Demo data is seeded automatically on first load.

## Routes

| Path              | Description                              |
| ----------------- | ---------------------------------------- |
| `/`               | Editable dashboard and project detail    |
| `/view`           | Read-only dashboard                      |
| `/view/<id>/...`  | Read-only detail for any node in the tree |

## Tech stack

- **Next.js 15** (App Router)
- **React 19** with TypeScript
- **No external UI library** — all components are hand-written
- **localStorage** — single persistence key `project-tracker:v3`

## Project structure

```
src/
  app/             Next.js routes + global styles
  components/      UI components
  lib/             Data model, types, pure helpers
docs/
  superpowers/
    specs/         Design specs
    plans/         Implementation plans
samples/           Original standalone HTML prototype (not the active codebase)
```

See [CLAUDE.md](CLAUDE.md) for architecture details and contributor guidance.
