# Read-only view design

**Date:** 2026-06-17
**Status:** Draft for implementation

## Summary

Add a read-only mode that lets users browse the project tree — including sub-projects, roadmaps, progress rings, relationships, and tooltips — without any ability to mutate data. Read-only mode is reached strictly via URL: a `/view` dashboard and `/view/[...path]` detail routes, mirroring the editable shell. There is no in-app toggle between edit and view.

## Goals

- A `/view` route renders the dashboard in read-only form.
- A `/view/<rootId>/<childId>/...` route renders any node (root project, milestone, or sub-project) in read-only form.
- All edit affordances — rename inputs, +Add, delete, task checkboxes, drag handles, the New Project flow, and the TweaksPanel — are hidden in view mode.
- Display features — progress rings, roadmap variants, tooltips, breadcrumbs, relationship resolution, grid/list toggle, theme toggle — all work identically to edit mode.
- Navigation between projects and into sub-projects works via URL pushes; the back button restores prior view-mode locations.
- Component code is shared between edit and view via a `readOnly` prop, not forked.

## Non-goals

- No URL-encoded snapshot sharing. The data still comes from `localStorage`, so view-mode links only work on a browser that already has the data. Cross-device sharing is a follow-up that requires a backend.
- No password or auth gating for view mode.
- No "view-as-of" snapshot freezing — view mode reads live `localStorage`. If another tab edits, view-mode tabs reflect the new state on reload.
- No in-app edit↔view toggle button. Mode is determined by URL.

## Routes

| Path              | Renders                                                                  |
| ----------------- | ------------------------------------------------------------------------ |
| `/`               | Existing editable dashboard / detail (unchanged)                         |
| `/view`           | Read-only dashboard                                                      |
| `/view/[...path]` | Read-only detail; `path` is the same ordered ID array used by `findTrail` |

Both view routes render a "Read-only" badge in the header so the mode is unambiguous.

Internal navigation in view mode uses `router.push('/view/' + path.join('/'))`. Sub-project drill-down pushes a longer path; breadcrumb clicks push a shorter one; the dashboard "home" pushes `/view`. The browser back/forward buttons therefore work naturally because mode lives in the URL.

## Component changes

### `ProjectsShell` (new)

Extract the Dashboard-or-Detail switch out of `App.tsx` into a new `ProjectsShell` component:

```ts
type ProjectsShellProps = {
  projects: ProjectNode[];
  path: string[];
  readOnly: boolean;
  view: 'grid' | 'list';
  variant: RoadmapVariant;
  onNavigate: (path: string[]) => void;
  onSetView: (v: 'grid' | 'list') => void;
  // edit-only — undefined in read-only mode
  onUpdateNode?: (n: ProjectNode) => void;
  onDeleteNode?: (path: string[]) => void;
  onNewProject?: () => void;
};
```

`ProjectsShell` derives `trail`/`current` from `projects` + `path` and renders either `Dashboard` or `ProjectDetail`, forwarding `readOnly`. When `readOnly` is true, the edit-only callbacks are not passed.

### `App.tsx` (editable)

Becomes a thin owner of mutation state plus `<ProjectsShell readOnly={false} ... />`. It continues to mount `NewProjectModal`, `ThemeToggle`, and `TweaksPanel`.

### `ViewApp.tsx` (new, read-only)

- Loads projects from `localStorage` (same loader as edit mode), defers to `useEffect` to avoid SSR mismatch.
- Reads `view` (grid/list) and `dark` from `localStorage` the same way `App.tsx` does, so the user's display preferences carry over.
- Reads `path` from `useParams()` (`/view/[...path]`).
- Renders `<ProjectsShell readOnly={true} onNavigate={...} onSetView={...} />`.
- Mounts `<ThemeToggle />` but **not** `NewProjectModal` or `TweaksPanel`.
- Renders a "Read-only" header badge.
- `onNavigate(path)` becomes `router.push('/view/' + path.join('/'))` (or `/view` for empty).

### `Dashboard`

Add `readOnly: boolean`. When true:

- Hide the "New Project" CTA.
- Keep the grid/list toggle (display preference, not data edit).
- `ProjectCard` / `ProjectRow` receive `readOnly` and pass it through where they expose any inline actions (current versions don't, but the prop is wired for future-proofing if a card-level edit affordance is added).

### `ProjectDetail`

Add `readOnly: boolean`. When true:

- Title and blurb render as plain text — no inline edit, no contentEditable, no rename input.
- Hide all "+Add task", "+Add child / sub-project", and delete buttons.
- Task list renders checkboxes as non-interactive (no `onChange`, visually still showing checked/unchecked state). The same applies to any drag handles.
- Roadmap is still rendered in full mode (not `mini`) and `onSelect` is wired to drill into the child via `onNavigate`. The "manage" affordances tied to selection are suppressed.
- Relationship display (`gatherRelations`) is unchanged; the underlying links remain navigable in view mode.
- Breadcrumbs remain clickable and navigate via `onNavigate`.
- Tooltips, progress rings, and any read-only visual elements are unchanged.

### `Roadmap`

Add `readOnly: boolean`. The component already supports `mini` (suppress labels and clicks). For read-only full mode, clicks should still navigate (selecting a child to drill in is viewing, not editing), but any management-style action triggered from selection is suppressed by the parent (`ProjectDetail`) via `readOnly`. No change to `mini` behavior.

### `TweaksPanel`

Not mounted in view mode. No prop changes.

### `NewProjectModal`

Not mounted in view mode. No prop changes.

## Data flow

- View mode reads from the same `loadProjects()` helper. It never calls `saveProjects`.
- View mode never receives `onUpdateNode`, `onDeleteNode`, or any mutation handler. The lack of the prop is the enforcement; components don't need to defensively no-op.
- Path normalization (`findTrail`, drift correction) works the same way in view mode; if the URL path doesn't resolve to a real node, view mode redirects to `/view` (dashboard).

## Error / edge cases

- **Unknown path in `/view/[...path]`:** if `findTrail` returns nothing for the URL path, `ViewApp` calls `router.replace('/view')`.
- **Empty project list:** `/view` shows the same empty state as edit mode, minus the "New Project" CTA — instead, copy reads something like "No projects to view yet."
- **localStorage unavailable / SSR:** same pattern as `App.tsx` — return `null` until mounted.
- **Direct deep link before data hydrates:** `ViewApp` waits for `mounted` flag, then resolves the path.

## Files touched

- `src/app/view/page.tsx` — new; renders `ViewApp` with empty path
- `src/app/view/[...path]/page.tsx` — new; renders `ViewApp` with `useParams().path`
- `src/components/ViewApp.tsx` — new
- `src/components/ProjectsShell.tsx` — new
- `src/components/App.tsx` — refactor to use `ProjectsShell`
- `src/components/Dashboard.tsx` — accept and respect `readOnly`
- `src/components/ProjectDetail.tsx` — accept and respect `readOnly`
- `src/components/Roadmap.tsx` — accept `readOnly` (no behavior change for `mini`; affordance gating handled by parent)
- `src/components/ProjectCard.tsx`, `ProjectRow.tsx` — accept and forward `readOnly`

## Testing

- Manual: visit `/view`, click into a root project, drill into a milestone, then a sub-project; confirm no edit controls appear, no TweaksPanel is mounted, tooltips and rings render, breadcrumbs and back button work.
- Manual: visit `/view/<bogus-id>`; confirm redirect to `/view`.
- Manual: from `/view`, switch grid↔list and toggle theme; confirm both persist in `localStorage` and survive reload.
- Manual: from edit mode at `/`, make a change, then open `/view/<id>` in another tab and reload; confirm the change appears.
