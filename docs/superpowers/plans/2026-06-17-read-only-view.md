# Read-only View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a URL-driven read-only mode (`/view` and `/view/[...path]`) that lets users browse the project tree — including sub-projects, roadmaps, rings, tooltips, and relationships — with all edit affordances suppressed.

**Architecture:** Thread a single `readOnly: boolean` prop through the existing shell. Extract a `ProjectsShell` component that both the editable `App` and a new `ViewApp` render. Mount the read-only flow under a new Next.js App Router segment `/view`. No backend; data continues to come from `localStorage`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript. No test framework is configured; verification is `pnpm type-check`, `pnpm build`, and manual browser checks via `pnpm dev`.

## Global Constraints

- App Router only — no `pages/` directory.
- Components stay `'use client'` consistent with current code.
- `localStorage` keys are `project-tracker:v3`, `project-tracker:view`, `project-tracker:theme`. Do not change them.
- No new dependencies. Use `next/navigation` (`useParams`, `useRouter`) which is already on the install.
- `nodeStats` must remain pure (no caching) — do not change it.
- Tweak defaults stay in `App.tsx` (`TWEAK_DEFAULTS`). View mode hardcodes the same defaults locally — it does not import them from `App.tsx`. Keep the two literals identical.
- All file paths are project-relative to `/Users/bipin/repo/project-flow`.

---

## File Structure

| File                                       | New / Modify | Responsibility                                                  |
| ------------------------------------------ | ------------ | --------------------------------------------------------------- |
| `src/components/Roadmap.tsx`               | Modify       | Accept `readOnly` prop (forwarded; no internal behavior change) |
| `src/components/ProjectCard.tsx`           | Modify       | Accept and forward `readOnly`                                   |
| `src/components/ProjectRow.tsx`            | Modify       | Accept and forward `readOnly`                                   |
| `src/components/Dashboard.tsx`             | Modify       | Hide "New project" CTA when `readOnly`                          |
| `src/components/ProjectDetail.tsx`         | Modify       | Hide all mutation UI when `readOnly`; keep navigation           |
| `src/components/ProjectsShell.tsx`         | Create       | Dashboard-or-Detail switch, used by `App` and `ViewApp`         |
| `src/components/App.tsx`                   | Modify       | Render `ProjectsShell` with `readOnly={false}`                  |
| `src/components/ViewApp.tsx`               | Create       | Read-only shell; reads `localStorage`, owns navigation only     |
| `src/app/view/page.tsx`                    | Create       | Read-only dashboard route                                       |
| `src/app/view/[...path]/page.tsx`          | Create       | Read-only detail route                                          |

---

## Task 1: Plumb `readOnly` through leaf display components

Foundation task: add the prop to `Roadmap`, `ProjectCard`, `ProjectRow`. Default to `false` so nothing changes in edit mode. No behavior change inside `Roadmap` (clicks navigate in both modes; "manage" gating is at `ProjectDetail`). `Card`/`Row` accept and ignore for now (future-proofing per spec); we wire them so Dashboard can pass the value.

**Files:**

- Modify: `src/components/Roadmap.tsx` (interface only)
- Modify: `src/components/ProjectCard.tsx` (interface only)
- Modify: `src/components/ProjectRow.tsx` (interface only)

**Interfaces:**

- Produces:
  - `RoadmapProps` gains optional `readOnly?: boolean` (default `false`)
  - `ProjectCardProps` gains optional `readOnly?: boolean` (default `false`)
  - `ProjectRowProps` gains optional `readOnly?: boolean` (default `false`)

- [ ] **Step 1: Add `readOnly` to `RoadmapProps`**

In `src/components/Roadmap.tsx`, change the interface:

```ts
interface RoadmapProps {
  stats: NodeStats;
  variant: 'track' | 'stations' | 'stepper';
  mini?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  readOnly?: boolean;
}
```

No code inside the component changes — the prop is purely additive.

- [ ] **Step 2: Add `readOnly` to `ProjectCardProps`**

In `src/components/ProjectCard.tsx`:

```ts
interface ProjectCardProps {
  project: ProjectNode;
  variant: 'track' | 'stations' | 'stepper';
  onOpen: () => void;
  label?: string;
  readOnly?: boolean;
}
```

Destructure but don't use it yet:

```ts
export function ProjectCard({ project, variant, onOpen, label, readOnly: _readOnly }: ProjectCardProps) {
```

- [ ] **Step 3: Add `readOnly` to `ProjectRowProps`**

Same change in `src/components/ProjectRow.tsx`:

```ts
interface ProjectRowProps {
  project: ProjectNode;
  variant: 'track' | 'stations' | 'stepper';
  onOpen: () => void;
  label?: string;
  readOnly?: boolean;
}
```

```ts
export function ProjectRow({ project, variant, onOpen, label, readOnly: _readOnly }: ProjectRowProps) {
```

- [ ] **Step 4: Type-check**

Run: `pnpm type-check`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Roadmap.tsx src/components/ProjectCard.tsx src/components/ProjectRow.tsx
git commit -m "feat: add readOnly prop to Roadmap, ProjectCard, ProjectRow"
```

---

## Task 2: Make `Dashboard` honor `readOnly`

Hide the "New project" header button and the in-grid / in-list "Start a new project" buttons when `readOnly` is true. Keep the grid/list toggle and the stat strip.

**Files:**

- Modify: `src/components/Dashboard.tsx`

**Interfaces:**

- Consumes: `ProjectCardProps.readOnly`, `ProjectRowProps.readOnly` from Task 1.
- Produces: `DashboardProps` gains required `readOnly: boolean` and `onNew` becomes optional.

- [ ] **Step 1: Update `DashboardProps`**

In `src/components/Dashboard.tsx`, change the interface:

```ts
interface DashboardProps {
  projects: ProjectNode[];
  variant: 'track' | 'stations' | 'stepper';
  onOpenPath: (path: string[]) => void;
  onNew?: () => void;
  view: 'grid' | 'list';
  onSetView: (v: 'grid' | 'list') => void;
  readOnly: boolean;
}
```

Destructure in the signature:

```ts
export function Dashboard({
  projects,
  variant,
  onOpenPath,
  onNew,
  view,
  onSetView,
  readOnly,
}: DashboardProps) {
```

- [ ] **Step 2: Gate the header "New project" button**

Replace the existing `<button className="btn primary lg" onClick={onNew}>` block (currently at the end of `<header className="dash-head">`) with:

```tsx
{!readOnly && onNew && (
  <button className="btn primary lg" onClick={onNew}>
    <svg viewBox="0 0 24 24" width="18" height="18">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
    New project
  </button>
)}
```

- [ ] **Step 3: Gate the in-grid and in-list "Start a new project" buttons**

In the All-projects list, change the two existing trailing buttons:

```tsx
{!readOnly && !isList && (
  <button className="card new-card" onClick={onNew}>
    <span className="new-plus">+</span>
    <span>Start a new project</span>
  </button>
)}
{!readOnly && isList && (
  <button className="row-new" onClick={onNew}>
    <span className="new-plus">+</span> Start a new project
  </button>
)}
```

- [ ] **Step 4: Forward `readOnly` to cards/rows**

Both `<Item ... />` usages should pass `readOnly`:

```tsx
<Item
  key={p.id}
  project={p}
  variant={variant}
  readOnly={readOnly}
  onOpen={() => onOpenPath([p.id])}
/>
```

And in the sub-projects loop:

```tsx
<Item
  key={sp.path.join('/')}
  project={sp.node}
  variant={variant}
  label={sp.parent}
  readOnly={readOnly}
  onOpen={() => onOpenPath(sp.path)}
/>
```

- [ ] **Step 5: Update the existing caller in `App.tsx`**

In `src/components/App.tsx`, the `<Dashboard ... />` render must pass `readOnly={false}`:

```tsx
<Dashboard
  projects={projects}
  variant={variant}
  onOpenPath={navigate}
  onNew={() => setShowNew(true)}
  view={dashView}
  onSetView={setView}
  readOnly={false}
/>
```

- [ ] **Step 6: Type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 7: Manual smoke**

Run: `pnpm dev`
Open `http://localhost:3000`. Confirm "New project" button still appears, the empty/new-card tiles still appear, and clicking them still opens the create modal.

- [ ] **Step 8: Commit**

```bash
git add src/components/Dashboard.tsx src/components/App.tsx
git commit -m "feat: gate Dashboard mutation UI on readOnly prop"
```

---

## Task 3: Make `ProjectDetail` honor `readOnly`

Hide every mutation surface: rename inputs, blurb inputs, +Add milestone, Add task, delete buttons, task checkbox toggles, task delete, "+ Link" relationship adder, and the per-relation remove button. Keep navigation, roadmap clicks (to select a child for viewing), the ring, the breadcrumbs, the tooltip strings, and the relationships display.

**Files:**

- Modify: `src/components/ProjectDetail.tsx`

**Interfaces:**

- Consumes: `RoadmapProps.readOnly` from Task 1.
- Produces:
  - `ProjectDetailProps` gains required `readOnly: boolean`; `onUpdateNode` and `onDeleteNode` become optional.
  - Internal `TaskChecklistProps` gains `readOnly: boolean`; `onChange` becomes optional.
  - Internal `ChildPanelProps` gains `readOnly: boolean`; `onUpdateChild`, `onDeleteChild` become optional.
  - Internal `RelationshipsPanelProps` gains `readOnly: boolean`; `onUpdateNode` becomes optional.

- [ ] **Step 1: Update internal `TaskChecklist` to honor `readOnly`**

In `src/components/ProjectDetail.tsx`, change `TaskChecklistProps`:

```ts
interface TaskChecklistProps {
  tasks: Task[];
  onChange?: (tasks: Task[]) => void;
  placeholder?: string;
  readOnly: boolean;
}
```

Update the component to hide the adder and the row delete button, and to no-op the check toggle, when `readOnly`:

```tsx
function TaskChecklist({ tasks, onChange, placeholder, readOnly }: TaskChecklistProps) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (!v || !onChange) return;
    onChange([...tasks, { id: uid(), title: v, done: false }]);
    setDraft('');
  };
  const toggle = (id: string) => {
    if (!onChange) return;
    onChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };
  const remove = (id: string) => {
    if (!onChange) return;
    onChange(tasks.filter((t) => t.id !== id));
  };
  return (
    <div>
      {!readOnly && (
        <div className="task-adder big">
          <input
            className="input"
            value={draft}
            placeholder={placeholder || 'Add a task…'}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn primary" onClick={add}>
            Add task
          </button>
        </div>
      )}
      <ul className="task-list">
        {tasks.length === 0 && (
          <li className="task-empty">
            {readOnly ? 'No tasks yet.' : 'No tasks yet — add the first one above.'}
          </li>
        )}
        {tasks.map((t) => (
          <li key={t.id} className={'task-row' + (t.done ? ' done' : '')}>
            <button
              className="check"
              onClick={() => toggle(t.id)}
              aria-label="Toggle"
              disabled={readOnly}
            >
              {t.done && (
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path
                    d="M5 12.5l4.2 4.2L19 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
            <span className="task-title">{t.title}</span>
            {!readOnly && (
              <button className="task-del" onClick={() => remove(t.id)} aria-label="Delete">
                <svg viewBox="0 0 24 24" width="15" height="15">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Update `ChildPanel` to honor `readOnly`**

Change `ChildPanelProps`:

```ts
interface ChildPanelProps {
  child: ProjectNode;
  variant: 'track' | 'stations' | 'stepper';
  path: string[];
  onUpdateChild?: (child: ProjectNode) => void;
  onDeleteChild?: (id: string) => void;
  onOpen: () => void;
  onNavigate: (path: string[]) => void;
  readOnly: boolean;
}
```

In the component body, replace the editable name/blurb inputs and the delete icon with a read-only branch. Also forward `readOnly` to `TaskChecklist` and only wire `onChange` if not read-only:

```tsx
function ChildPanel({
  child,
  variant,
  path,
  onUpdateChild,
  onDeleteChild,
  onOpen,
  onNavigate,
  readOnly,
}: ChildPanelProps) {
  const st = nodeStats(child);
  const status = st.complete ? 'Complete' : st.started ? 'In progress' : 'Not started';
  const badgeState = st.complete ? 'complete' : st.started ? 'progress' : 'todo';
  return (
    <section className="sub-panel">
      <div className="sub-head">
        <div className="sub-head-main">
          <span className={'sub-badge is-' + badgeState}>
            {st.complete && (
              <svg viewBox="0 0 24 24" width="15" height="15">
                <path
                  d="M5 12.5l4.2 4.2L19 7"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <div className="sub-titles">
            {readOnly ? (
              <>
                <div className="sub-name-input" aria-readonly>{child.name}</div>
                {child.blurb && <div className="sub-blurb-input" aria-readonly>{child.blurb}</div>}
              </>
            ) : (
              <>
                <input
                  className="sub-name-input"
                  value={child.name}
                  placeholder="Milestone name"
                  onChange={(e) => onUpdateChild && onUpdateChild({ ...child, name: e.target.value })}
                />
                <input
                  className="sub-blurb-input"
                  value={child.blurb || ''}
                  placeholder="Add a description…"
                  onChange={(e) => onUpdateChild && onUpdateChild({ ...child, blurb: e.target.value })}
                />
              </>
            )}
          </div>
        </div>
        <div className="sub-head-right">
          <span className={'chip' + (st.complete ? ' chip-done' : '')}>
            {status} · {st.done}/{st.total}
          </span>
          <button className="btn ghost sm" onClick={onOpen}>
            Open
            <svg viewBox="0 0 24 24" width="14" height="14" style={{ marginLeft: 2 }}>
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {!readOnly && (
            <button
              className="icon-btn"
              onClick={() => onDeleteChild && onDeleteChild(child.id)}
              aria-label="Delete milestone"
            >
              <svg viewBox="0 0 24 24" width="17" height="17">
                <path
                  d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="sub-bar">
        <div className="sub-bar-fill" style={{ width: st.pct * 100 + '%' }} />
      </div>
      {st.isLeaf ? (
        <TaskChecklist
          tasks={child.tasks}
          placeholder={`Add a task to "${child.name || 'this milestone'}"…`}
          onChange={
            readOnly || !onUpdateChild
              ? undefined
              : (tasks) => onUpdateChild({ ...child, tasks })
          }
          readOnly={readOnly}
        />
      ) : (
        <div className="sub-asproject">
          <p className="sub-asproject-note">
            &quot;{child.name || 'This milestone'}&quot; is its own project with{' '}
            {st.milestoneCount} milestones and {st.total} task{st.total === 1 ? '' : 's'} inside.
            Open it to {readOnly ? 'view' : 'manage'} everything — or jump straight into one:
          </p>
          <div className="sub-childlist">
            {st.markers.map((m) => (
              <button
                key={m.id}
                className="scl-item"
                onClick={() => onNavigate([...path, child.id, m.id])}
              >
                <span className={'scl-dot is-' + m.state} />
                <span className="scl-name">{m.label}</span>
                <span className="scl-meta">
                  {m.hasChildren ? m.childCount + ' ms' : m.done + '/' + m.total}
                </span>
                <svg viewBox="0 0 24 24" width="13" height="13" className="scl-chev">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={onOpen}>
            Open &quot;{child.name}&quot;
            <svg viewBox="0 0 24 24" width="15" height="15" style={{ marginLeft: 3 }}>
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Update `RelationshipsPanel` to honor `readOnly`**

Change `RelationshipsPanelProps`:

```ts
interface RelationshipsPanelProps {
  projects: ProjectNode[];
  node: ProjectNode;
  relations: GatheredRelations;
  onOpen: (path: string[]) => void;
  onUpdateNode?: (node: ProjectNode) => void;
  readOnly: boolean;
}
```

Inside, gate the "+ Link" button, the add form, and the per-row remove on `!readOnly`. Both `removeOut` and `addLink` should bail out if `onUpdateNode` is undefined:

```tsx
function RelationshipsPanel({
  projects,
  node,
  relations,
  onOpen,
  onUpdateNode,
  readOnly,
}: RelationshipsPanelProps) {
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState('');
  const [type, setType] = useState<RelationType>('depends');

  const exclude = new Set<string>();
  (function walk(n: ProjectNode) {
    exclude.add(n.id);
    (n.children || []).forEach(walk);
  })(node);
  const options = flattenNodes(projects).filter((o) => !exclude.has(o.id));

  const removeOut = (idx: number) => {
    if (!onUpdateNode) return;
    const rels = (node.relations || []).slice();
    rels.splice(idx, 1);
    onUpdateNode({ ...node, relations: rels });
  };
  const addLink = () => {
    if (!target || !onUpdateNode) return;
    onUpdateNode({
      ...node,
      relations: [...(node.relations || []), { to: target, type }],
    });
    setAdding(false);
    setTarget('');
    setType('depends');
  };

  return (
    <section className="rel-panel">
      <div className="rel-head">
        <h2>
          Relationships <span className="count">{relations.count}</span>
        </h2>
        {!readOnly && (
          <button className="btn ghost sm" onClick={() => setAdding((a) => !a)}>
            {adding ? 'Cancel' : '+ Link'}
          </button>
        )}
      </div>
      {!readOnly && adding && (
        <div className="rel-add">
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as RelationType)}
          >
            <option value="depends">Depends on</option>
            <option value="blocks">Blocks</option>
            <option value="related">Related to</option>
          </select>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a project or milestone…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.breadcrumb.join('  ›  ')}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={addLink} disabled={!target}>
            Add
          </button>
        </div>
      )}
      {relations.count === 0 && !adding && (
        <p className="rel-empty">
          {readOnly
            ? 'No links.'
            : (<>No links yet. Use <b>+ Link</b> to connect this to other projects or milestones.</>)}
        </p>
      )}
      {relations.outgoing.length > 0 && (
        <ul className="rel-list">
          {relations.outgoing.map((rel, i) => (
            <RelItem
              key={'o' + i}
              rel={rel}
              onOpen={onOpen}
              onRemove={readOnly ? undefined : () => removeOut(i)}
            />
          ))}
        </ul>
      )}
      {relations.incoming.length > 0 && (
        <ul className="rel-list rel-incoming">
          {relations.incoming.map((rel, i) => (
            <RelItem key={'i' + i} rel={rel} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}
```

The `rel-empty` JSX needs an inline fix — the conditional must produce a valid expression; restructure if your linter dislikes the parenthesized fragment:

```tsx
{relations.count === 0 && !adding && (
  readOnly ? (
    <p className="rel-empty">No links.</p>
  ) : (
    <p className="rel-empty">
      No links yet. Use <b>+ Link</b> to connect this to other projects or milestones.
    </p>
  )
)}
```

Use this form.

- [ ] **Step 4: Update `ProjectDetailProps` and the component**

Change the exported interface:

```ts
export interface ProjectDetailProps {
  projects: ProjectNode[];
  path: string[];
  node: ProjectNode;
  trail: ProjectNode[];
  variant: 'track' | 'stations' | 'stepper';
  onUpdateNode?: (node: ProjectNode) => void;
  onOpenChild: (childId: string) => void;
  onNavigate: (path: string[]) => void;
  onHome: () => void;
  onDeleteNode?: (path: string[]) => void;
  readOnly: boolean;
}
```

Destructure `readOnly` in the signature.

Inside, where mutations are derived, make them no-op if their callback is absent (covers the read-only case structurally):

```ts
const updateChild = (nc: ProjectNode) => {
  if (!onUpdateNode) return;
  onUpdateNode({ ...node, children: children.map((c) => (c.id === nc.id ? nc : c)) });
};
const deleteChild = (id: string) => {
  if (!onUpdateNode) return;
  const remaining = children.filter((c) => c.id !== id);
  onUpdateNode({ ...node, children: remaining });
  setSelectedId(remaining[0] ? remaining[0].id : null);
};
const addMilestone = () => {
  if (!onUpdateNode) return;
  const ns: ProjectNode = {
    id: uid(),
    name: 'New milestone',
    blurb: '',
    tasks: [],
    children: [],
    relations: [],
  };
  onUpdateNode({ ...node, children: [...children, ns] });
  setSelectedId(ns.id);
};
```

- [ ] **Step 5: Gate the detail header (name/blurb inputs, delete chip)**

Replace the `<div className="dh-left">` body:

```tsx
<div className="dh-left">
  {readOnly ? (
    <>
      <div className="dh-name-input" aria-readonly>{node.name}</div>
      {node.blurb && <div className="dh-blurb-input" aria-readonly>{node.blurb}</div>}
    </>
  ) : (
    <>
      <input
        className="dh-name-input"
        value={node.name}
        onChange={(e) => onUpdateNode && onUpdateNode({ ...node, name: e.target.value })}
      />
      <input
        className="dh-blurb-input"
        value={node.blurb || ''}
        placeholder="Add a description…"
        onChange={(e) => onUpdateNode && onUpdateNode({ ...node, blurb: e.target.value })}
      />
    </>
  )}
  <div className="dh-meta">
    {isTop && node.created && (
      <span className="chip">Started {fmtDate(node.created)}</span>
    )}
    {isTop && node.due && (
      <span
        className={
          'chip' +
          (dl != null && dl < 0 && !stats.complete ? ' chip-late' : '')
        }
      >
        Target {fmtDate(node.due)}
        {dl != null && !stats.complete
          ? ` · ${dl < 0 ? -dl + 'd over' : dl + 'd left'}`
          : ''}
      </span>
    )}
    {!isTop && trail.length >= 2 && (
      <span className="chip">Part of {trail[trail.length - 2].name}</span>
    )}
    {!readOnly && (
      <button className="chip chip-btn danger" onClick={() => onDeleteNode && onDeleteNode(path)}>
        {isTop ? 'Delete project' : 'Delete this'}
      </button>
    )}
  </div>
</div>
```

- [ ] **Step 6: Gate the roadmap panel's "+ Add milestone" and forward `readOnly`**

In the `<section className="roadmap-panel">` block, change the right side and the `<Roadmap />` call:

```tsx
<div className="rp-head-right">
  {stats.complete ? (
    <span className="rp-status done">All milestones reached</span>
  ) : nextMarker ? (
    <span className="rp-status">
      Up next: <b>{nextMarker.label}</b>
    </span>
  ) : null}
  {!readOnly && (
    <button className="btn ghost sm" onClick={addMilestone}>
      + Add milestone
    </button>
  )}
</div>
```

```tsx
<Roadmap
  stats={stats}
  variant={variant}
  selectedId={selectedId}
  onSelect={setSelectedId}
  readOnly={readOnly}
/>
```

Also change the hint line to be mode-aware:

```tsx
<p className="rp-hint">
  {readOnly
    ? 'Click a milestone to preview it below · open it to drill in.'
    : 'Click a milestone to manage it below · open it to make it its own project.'}
</p>
```

- [ ] **Step 7: Forward `readOnly` to `ChildPanel`, `RelationshipsPanel`, the leaf-tasks branch, and the empty-children branch**

`<ChildPanel ... />`:

```tsx
<ChildPanel
  child={selected}
  variant={variant}
  path={path}
  onUpdateChild={readOnly ? undefined : updateChild}
  onDeleteChild={readOnly ? undefined : deleteChild}
  onOpen={() => onOpenChild(selected.id)}
  onNavigate={onNavigate}
  readOnly={readOnly}
/>
```

`<RelationshipsPanel ... />`:

```tsx
<RelationshipsPanel
  projects={projects}
  node={node}
  relations={relations}
  onOpen={onNavigate}
  onUpdateNode={readOnly ? undefined : onUpdateNode}
  readOnly={readOnly}
/>
```

Direct-tasks `<TaskChecklist ... />` (inside the `node.tasks && node.tasks.length > 0` block):

```tsx
<TaskChecklist
  tasks={node.tasks}
  onChange={
    readOnly || !onUpdateNode ? undefined : (tasks) => onUpdateNode({ ...node, tasks })
  }
  readOnly={readOnly}
/>
```

In the leaf branch (no children), gate the "Break into milestones" button and forward `readOnly`:

```tsx
<section className="sub-panel">
  <div className="rp-head">
    <h2>
      Tasks <span className="count">{stats.done}/{stats.total}</span>
    </h2>
    {!readOnly && (
      <button className="btn ghost sm" onClick={addMilestone}>
        Break into milestones
      </button>
    )}
  </div>
  <div className="sub-bar" style={{ marginTop: 14 }}>
    <div className="sub-bar-fill" style={{ width: stats.pct * 100 + '%' }} />
  </div>
  <TaskChecklist
    tasks={node.tasks || []}
    onChange={
      readOnly || !onUpdateNode ? undefined : (tasks) => onUpdateNode({ ...node, tasks })
    }
    readOnly={readOnly}
  />
</section>
```

- [ ] **Step 8: Update the `App.tsx` caller**

In `src/components/App.tsx`, the `<ProjectDetail ... />` render must pass `readOnly={false}`:

```tsx
<ProjectDetail
  key={current.id}
  projects={projects}
  path={curPath}
  node={current}
  trail={trail}
  variant={variant}
  onUpdateNode={updateNode}
  onOpenChild={openChild}
  onNavigate={navigate}
  onHome={home}
  onDeleteNode={deleteNode}
  readOnly={false}
/>
```

- [ ] **Step 9: Type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 10: Manual smoke (edit mode unaffected)**

Run: `pnpm dev`. At `http://localhost:3000`:

- Open a project, rename it, add a task, check/uncheck it, delete it.
- Open a milestone with children, add and remove a relationship link, add a milestone, drill into a sub-project.

All edit features must still work — Task 3 must not regress edit mode.

- [ ] **Step 11: Commit**

```bash
git add src/components/ProjectDetail.tsx src/components/App.tsx
git commit -m "feat: gate ProjectDetail mutation UI on readOnly prop"
```

---

## Task 4: Extract `ProjectsShell`

Move the Dashboard-or-Detail switch out of `App.tsx` into a reusable shell. `App.tsx` keeps its mutation handlers and forwards them through `ProjectsShell` with `readOnly={false}`. The shell is the single place that decides which view to render given a `path`.

**Files:**

- Create: `src/components/ProjectsShell.tsx`
- Modify: `src/components/App.tsx`

**Interfaces:**

- Produces:
  ```ts
  type ProjectsShellProps = {
    projects: ProjectNode[];
    path: string[];
    readOnly: boolean;
    view: 'grid' | 'list';
    variant: 'track' | 'stations' | 'stepper';
    onNavigate: (path: string[]) => void;
    onHome: () => void;
    onOpenChild: (childId: string) => void;
    onSetView: (v: 'grid' | 'list') => void;
    onNewProject?: () => void;
    onUpdateNode?: (n: ProjectNode) => void;
    onDeleteNode?: (path: string[]) => void;
  };
  ```
  Default export: `ProjectsShell`.

- [ ] **Step 1: Create `ProjectsShell.tsx`**

Write `src/components/ProjectsShell.tsx`:

```tsx
'use client';

import { findTrail } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { Dashboard } from './Dashboard';
import { ProjectDetail } from './ProjectDetail';

export interface ProjectsShellProps {
  projects: ProjectNode[];
  path: string[];
  readOnly: boolean;
  view: 'grid' | 'list';
  variant: 'track' | 'stations' | 'stepper';
  onNavigate: (path: string[]) => void;
  onHome: () => void;
  onOpenChild: (childId: string) => void;
  onSetView: (v: 'grid' | 'list') => void;
  onNewProject?: () => void;
  onUpdateNode?: (n: ProjectNode) => void;
  onDeleteNode?: (path: string[]) => void;
}

export function ProjectsShell({
  projects,
  path,
  readOnly,
  view,
  variant,
  onNavigate,
  onHome,
  onOpenChild,
  onSetView,
  onNewProject,
  onUpdateNode,
  onDeleteNode,
}: ProjectsShellProps) {
  const trail = findTrail(projects, path);
  const current = trail[trail.length - 1] || null;
  const curPath = trail.map((n) => n.id);

  if (current) {
    return (
      <ProjectDetail
        key={current.id}
        projects={projects}
        path={curPath}
        node={current}
        trail={trail}
        variant={variant}
        onUpdateNode={onUpdateNode}
        onOpenChild={onOpenChild}
        onNavigate={onNavigate}
        onHome={onHome}
        onDeleteNode={onDeleteNode}
        readOnly={readOnly}
      />
    );
  }

  return (
    <Dashboard
      projects={projects}
      variant={variant}
      onOpenPath={onNavigate}
      onNew={onNewProject}
      view={view}
      onSetView={onSetView}
      readOnly={readOnly}
    />
  );
}

export default ProjectsShell;
```

- [ ] **Step 2: Refactor `App.tsx` to use `ProjectsShell`**

In `src/components/App.tsx`, replace the `current ? <ProjectDetail .../> : <Dashboard .../>` block with a single `<ProjectsShell .../>` render:

```tsx
<ProjectsShell
  projects={projects}
  path={curPath}
  readOnly={false}
  view={dashView}
  variant={variant}
  onNavigate={navigate}
  onHome={home}
  onOpenChild={openChild}
  onSetView={setView}
  onNewProject={() => setShowNew(true)}
  onUpdateNode={updateNode}
  onDeleteNode={deleteNode}
/>
```

Add the import near the top:

```ts
import { ProjectsShell } from './ProjectsShell';
```

Remove the now-unused `Dashboard` and `ProjectDetail` imports from `App.tsx` if no longer referenced.

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 4: Manual smoke (edit mode still works)**

Run: `pnpm dev`. At `http://localhost:3000`:

- Dashboard loads with cards/rows.
- Open a project, navigate to a milestone, then back via breadcrumb and the back button.
- Create a project via "New project" modal.

All edit flows must continue to work — Task 4 is a pure refactor.

- [ ] **Step 5: Commit**

```bash
git add src/components/ProjectsShell.tsx src/components/App.tsx
git commit -m "refactor: extract ProjectsShell from App"
```

---

## Task 5: Build `ViewApp` (the read-only shell)

A self-contained read-only counterpart to `App.tsx`. Owns no mutation state. Reads `localStorage` the same way. Routes navigation through `next/navigation`. Mounts only `ProjectsShell` and `ThemeToggle` (no TweaksPanel, no NewProjectModal). Renders a "Read-only" badge.

**Files:**

- Create: `src/components/ViewApp.tsx`

**Interfaces:**

- Consumes: `ProjectsShellProps` from Task 4.
- Produces:
  ```ts
  interface ViewAppProps { path: string[]; }
  ```
  Default export: `ViewApp`.

- [ ] **Step 1: Create `ViewApp.tsx`**

Write `src/components/ViewApp.tsx`:

```tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { loadProjects, findTrail } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { ProjectsShell } from './ProjectsShell';
import { ThemeToggle } from './ThemeToggle';

// Hardcoded view-mode display defaults. Mirrors TWEAK_DEFAULTS in App.tsx.
const VIEW_DEFAULTS = {
  roadmapStyle: 'track' as 'track' | 'stations' | 'stepper',
  accent: '#E8772E',
  density: 'regular' as 'compact' | 'regular' | 'comfy',
  showRing: true,
};

export interface ViewAppProps {
  path: string[];
}

export function ViewApp({ path }: ViewAppProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [view, setViewState] = useState<'grid' | 'list'>('grid');
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProjects(loadProjects());
    try {
      const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list' | null;
      if (stored) setViewState(stored);
    } catch (_) {}
    try {
      setDark(localStorage.getItem('project-tracker:theme') === 'dark');
    } catch (_) {}
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('project-tracker:theme', dark ? 'dark' : 'light'); } catch (_) {}
  }, [dark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', VIEW_DEFAULTS.accent);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 320);
    setDark((d) => !d);
  };

  const setView = (v: 'grid' | 'list') => {
    setViewState(v);
    try { localStorage.setItem('project-tracker:view', v); } catch (_) {}
  };

  const pushPath = (next: string[]) => {
    const suffix = next.length === 0 ? '' : '/' + next.map(encodeURIComponent).join('/');
    router.push('/view' + suffix);
    window.scrollTo(0, 0);
  };

  const validPath = useMemo(() => {
    if (!mounted) return path;
    const trail = findTrail(projects, path);
    return trail.map((n) => n.id);
  }, [mounted, projects, path]);

  useEffect(() => {
    if (!mounted) return;
    if (path.length === 0) return;
    if (validPath.length !== path.length) {
      router.replace('/view');
    }
  }, [mounted, validPath, path, router]);

  if (!mounted) return null;

  return (
    <div className={'app dens-' + VIEW_DEFAULTS.density + (VIEW_DEFAULTS.showRing ? '' : ' no-ring')}>
      <div className="readonly-badge" aria-label="Read-only mode">Read-only</div>
      <ProjectsShell
        projects={projects}
        path={validPath}
        readOnly
        view={view}
        variant={VIEW_DEFAULTS.roadmapStyle}
        onNavigate={pushPath}
        onHome={() => pushPath([])}
        onOpenChild={(childId) => pushPath([...validPath, childId])}
        onSetView={setView}
      />
      <ThemeToggle dark={dark} onToggle={toggleTheme} />
    </div>
  );
}

export default ViewApp;
```

- [ ] **Step 2: Add minimal CSS for the badge**

Open `src/app/globals.css` and append at the bottom:

```css
.readonly-badge {
  position: fixed;
  top: 14px;
  left: 14px;
  z-index: 50;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--ink, #111);
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 999px;
  backdrop-filter: blur(6px);
}

[data-theme='dark'] .readonly-badge {
  color: #fff;
  background: rgba(20, 20, 20, 0.7);
  border-color: rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/ViewApp.tsx src/app/globals.css
git commit -m "feat: add ViewApp read-only shell"
```

---

## Task 6: Add `/view` and `/view/[...path]` routes

Wire the new routes. Both are server components that render `ViewApp` with the path derived from the URL.

**Files:**

- Create: `src/app/view/page.tsx`
- Create: `src/app/view/[...path]/page.tsx`

**Interfaces:**

- Consumes: `ViewAppProps` from Task 5.

- [ ] **Step 1: Create the bare `/view` page**

Write `src/app/view/page.tsx`:

```tsx
import { ViewApp } from '@/components/ViewApp';

export default function ViewDashboard() {
  return <ViewApp path={[]} />;
}
```

- [ ] **Step 2: Create the catch-all `/view/[...path]` page**

Write `src/app/view/[...path]/page.tsx`:

```tsx
import { ViewApp } from '@/components/ViewApp';

interface ViewPathProps {
  params: Promise<{ path: string[] }>;
}

export default async function ViewPath({ params }: ViewPathProps) {
  const { path } = await params;
  const decoded = (path || []).map((seg) => decodeURIComponent(seg));
  return <ViewApp path={decoded} />;
}
```

(Next.js 15 makes `params` a Promise.)

- [ ] **Step 3: Type-check**

Run: `pnpm type-check`
Expected: exit 0.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: build succeeds; the output lists routes `/`, `/view`, and `/view/[...path]`.

- [ ] **Step 5: Commit**

```bash
git add src/app/view/page.tsx src/app/view/[...path]/page.tsx
git commit -m "feat: add /view and /view/[...path] routes"
```

---

## Task 7: End-to-end manual verification

No new code — exercise the feature through the browser to confirm the spec's behavior.

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev`

- [ ] **Step 2: Edit-mode regression sweep**

Open `http://localhost:3000`. Confirm:

- "New project" button visible and works.
- Open a project; rename, edit blurb, add a task, check it off, delete it.
- Open a milestone, add and remove a relationship.
- Add a milestone, drill into it, drill back via breadcrumb and browser back.

- [ ] **Step 3: Read-only dashboard**

Navigate to `http://localhost:3000/view`. Confirm:

- "Read-only" badge appears top-left.
- Project cards/rows render with the same rings and roadmaps.
- No "New project" header button, no "+ Start a new project" tile/row.
- Grid/list toggle works and persists across reload.
- Theme toggle works and persists.
- No TweaksPanel visible.

- [ ] **Step 4: Read-only project detail**

Click any card. Confirm URL becomes `/view/<id>` and:

- Name and blurb render as plain text — no inputs.
- "Delete project" chip is gone.
- "+ Add milestone" / "Break into milestones" is gone.
- "+ Link" button on Relationships is gone; existing relations render with no remove button.
- Task rows render checked/unchecked correctly; check button is disabled; no delete-task button.
- Roadmap markers are clickable and select a child; the selected `ChildPanel` renders without name/blurb inputs, without the delete icon, without the task adder.

- [ ] **Step 5: Drill into a sub-project**

Click a milestone marker, then "Open". URL becomes `/view/<rootId>/<childId>`. Repeat on a deeper child. Confirm breadcrumb is clickable and the browser back button restores prior `/view/...` locations.

- [ ] **Step 6: Bogus path redirect**

Visit `http://localhost:3000/view/does-not-exist`. Confirm the URL replaces to `/view` and the dashboard renders.

- [ ] **Step 7: Live data through tab switch**

In a second tab at `/`, edit a project name. Reload the `/view/...` tab. Confirm the new name appears.

- [ ] **Step 8: Type-check + build final**

Run: `pnpm type-check && pnpm build`
Expected: both succeed.

- [ ] **Step 9: Commit (if any tweaks during verification)**

If no further changes, skip. Otherwise:

```bash
git add <files>
git commit -m "fix: <what>"
```

---

## Self-Review Notes

Coverage of spec sections:

- Routes (`/view`, `/view/[...path]`) — Task 6.
- Component reuse via `readOnly` prop — Tasks 1, 2, 3.
- `ProjectsShell` split — Task 4.
- `ViewApp` shell, badge, theme + grid/list preserved, no TweaksPanel/NewProjectModal — Task 5.
- Live `localStorage` reads (no snapshot freeze) — Task 5 (`loadProjects` in `useEffect`).
- Unknown-path redirect to `/view` — Task 5 (`validPath` effect).
- Manual test plan — Task 7.

No placeholders or `TBD`s. Type/prop names are consistent: `readOnly`, `ProjectsShell`, `ViewApp`, `VIEW_DEFAULTS`. The `findTrail` helper exists in `src/lib/data.ts` and is already used by `App.tsx`.
