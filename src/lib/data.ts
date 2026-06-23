import type {
  ProjectNode, NodeStats, Marker, FlatNode, SubProject,
  GatheredRelations, ResolvedRelation, RelMeta, RelationType,
} from './types';
import { getActiveUid, pushToFirestore } from './sync';

const STORAGE_KEY = 'project-tracker:v3';

export const uid = (): string => Math.random().toString(36).slice(2, 9);

export const REL: Record<RelationType, RelMeta> = {
  depends: { label: 'Depends on', rev: 'Needed by',  tone: 'warn' },
  blocks:  { label: 'Blocks',     rev: 'Blocked by', tone: 'danger' },
  related: { label: 'Related to', rev: 'Related to', tone: 'neutral' },
};

// ---- builders ----------------------------------------------------------------

function leaf(name: string, blurb: string, tasks: [string, boolean][]): ProjectNode {
  return {
    id: uid(), name, blurb, children: [], relations: [],
    tasks: tasks.map(([title, done]) => ({ id: uid(), title, done })),
  };
}

function group(name: string, blurb: string, children: ProjectNode[]): ProjectNode {
  return { id: uid(), name, blurb, tasks: [], relations: [], children };
}

// ---- seed --------------------------------------------------------------------

function seedProjects(): ProjectNode[] {
  const mobile: ProjectNode = {
    id: uid(), name: 'Mobile App Redesign',
    blurb: 'Ship the new iOS + Android experience for Q3.',
    created: '2026-03-02', due: '2026-07-15', relations: [], tasks: [],
    children: [
      leaf('Kickoff', 'Align the team and frame the problem.', [
        ['Stakeholder kickoff workshop', true], ['Competitive audit', true],
      ]),
      leaf('Research', 'Understand users and synthesize insights.', [
        ['User interviews (n=8)', true], ['Synthesize research findings', true],
      ]),
      group('Design', 'A project in its own right — IA through design system.', [
        leaf('Information architecture', 'Structure and navigation.', [
          ['Site map', true], ['Nav model', true],
        ]),
        leaf('Wireframes', 'Low-fi core flows.', [
          ['Wireframe onboarding', true], ['Wireframe home', true], ['Wireframe settings', false],
        ]),
        leaf('Hi-fi screens', 'Polished visual designs.', [
          ['Hi-fi onboarding', true], ['Hi-fi home', false], ['Hi-fi profile', false],
        ]),
        leaf('Design system', 'Reusable tokens + components.', [
          ['Color + type tokens', false], ['Component library', false],
        ]),
      ]),
      leaf('Build', 'Implement and QA the new experience.', [
        ['Frontend build — onboarding', false], ['Frontend build — home', false], ['QA pass', false],
      ]),
      leaf('Launch', 'Submit and release to stores.', [['App store submission', false]]),
    ],
  };

  const marketing: ProjectNode = {
    id: uid(), name: 'Q3 Marketing Site',
    blurb: 'New landing pages and brand refresh for launch.',
    created: '2026-04-10', due: '2026-06-30', relations: [], tasks: [],
    children: [
      leaf('Brief', 'Lock the creative direction.', [['Creative brief approved', true]]),
      leaf('Copy', 'Write the messaging and pages.', [
        ['Messaging framework', true], ['Homepage copy', true], ['Pricing page copy', false],
      ]),
      leaf('Design', 'Visual design of key pages.', [
        ['Visual design — hero', false], ['Visual design — pricing', false],
      ]),
      leaf('Launch', 'Build and ship.', [['Build + deploy', false]]),
    ],
  };

  const pipeline: ProjectNode = {
    id: uid(), name: 'Data Pipeline v2',
    blurb: 'Migrate ingestion to streaming architecture.',
    created: '2026-05-01', due: '2026-09-01', relations: [], tasks: [],
    children: [
      leaf('Spec', 'Decide the architecture.', [['Architecture spec', true]]),
      leaf('Prototype', 'Validate the streaming approach.', [
        ['Spike: Kafka vs Kinesis', false], ['Build prototype consumer', false],
      ]),
      leaf('Migrate', 'Move data and traffic over.', [
        ['Backfill historical data', false], ['Cutover plan', false],
      ]),
      leaf('Harden', 'Make it production-ready.', [['Load testing', false]]),
    ],
  };

  // relationships
  const find = (root: ProjectNode, name: string): ProjectNode => {
    let hit: ProjectNode | null = null;
    (function walk(n: ProjectNode) {
      if (n.name === name) hit = n;
      n.children.forEach(walk);
    })(root);
    if (!hit) throw new Error(`node "${name}" not found`);
    return hit;
  };

  find(mobile, 'Build').relations.push({ to: find(mobile, 'Design').id, type: 'depends' });
  find(mobile, 'Launch').relations.push({ to: find(mobile, 'Build').id, type: 'depends' });
  find(mobile, 'Hi-fi screens').relations.push({ to: find(mobile, 'Wireframes').id, type: 'depends' });
  marketing.relations.push({ to: mobile.id, type: 'related' });
  find(marketing, 'Design').relations.push({ to: find(mobile, 'Design system').id, type: 'depends' });
  pipeline.relations.push({ to: find(mobile, 'Build').id, type: 'blocks' });

  return [mobile, marketing, pipeline];
}

// ---- persistence -------------------------------------------------------------

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

export function saveProjects(projects: ProjectNode[]): void {
  if (typeof window === 'undefined') return;
  const lastModified = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, lastModified }));
  } catch (_) {}
  const uid = getActiveUid();
  if (uid) pushToFirestore(uid, projects, lastModified);
}

// ---- recursive stats ---------------------------------------------------------

export function nodeStats(node: ProjectNode): NodeStats {
  const children = node.children ?? [];
  if (children.length > 0) {
    let total = 0, done = 0;
    const markers: Marker[] = children.map((c, i) => {
      const cs = nodeStats(c);
      total += cs.total;
      done += cs.done;
      return {
        id: c.id, label: c.name, pos: (i + 1) / children.length,
        pct: cs.pct, done: cs.done, total: cs.total,
        complete: cs.complete, started: cs.started,
        hasChildren: c.children.length > 0,
        childCount: c.children.length,
        state: cs.complete ? 'complete' : cs.started ? 'progress' : 'todo',
      };
    });
    const pct = total === 0 ? 0 : done / total;
    const reachedCount = markers.filter((m) => m.complete).length;
    let currentIndex = markers.findIndex((m) => !m.complete);
    if (currentIndex === -1) currentIndex = children.length - 1;
    return {
      isLeaf: false, total, done, pct, pctLabel: Math.round(pct * 100),
      markers, reachedCount, milestoneCount: children.length,
      currentIndex, currentLabel: children[currentIndex]?.name ?? '—',
      complete: reachedCount === children.length, started: done > 0,
    };
  }
  const tasks = node.tasks ?? [];
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total === 0 ? 0 : done / total;
  return {
    isLeaf: true, total, done, pct, pctLabel: Math.round(pct * 100),
    markers: [], reachedCount: 0, milestoneCount: 0,
    currentIndex: 0, currentLabel: '—',
    complete: total > 0 && done === total, started: done > 0,
  };
}

// ---- immutable tree helpers (path = ordered array of ids root→node) ----------

export function replaceNodeAtPath(
  nodes: ProjectNode[], path: string[], newNode: ProjectNode,
): ProjectNode[] {
  const [h, ...rest] = path;
  return nodes.map((n) =>
    n.id !== h ? n
      : rest.length === 0 ? newNode
      : { ...n, children: replaceNodeAtPath(n.children, rest, newNode) },
  );
}

export function deleteNodeAtPath(nodes: ProjectNode[], path: string[]): ProjectNode[] {
  const [h, ...rest] = path;
  if (rest.length === 0) return nodes.filter((n) => n.id !== h);
  return nodes.map((n) =>
    n.id !== h ? n : { ...n, children: deleteNodeAtPath(n.children, rest) },
  );
}

export function findTrail(nodes: ProjectNode[], path: string[]): ProjectNode[] {
  const trail: ProjectNode[] = [];
  let cur = nodes;
  for (const id of path) {
    const n = cur.find((x) => x.id === id);
    if (!n) break;
    trail.push(n);
    cur = n.children;
  }
  return trail;
}

export function findPathById(
  nodes: ProjectNode[], id: string, prefix: string[] = [],
): string[] | null {
  for (const n of nodes) {
    const here = [...prefix, n.id];
    if (n.id === id) return here;
    const deep = findPathById(n.children, id, here);
    if (deep) return deep;
  }
  return null;
}

export function flattenNodes(
  nodes: ProjectNode[], prefix: string[] = [], out: FlatNode[] = [],
): FlatNode[] {
  for (const n of nodes) {
    const crumb = [...prefix, n.name];
    out.push({ id: n.id, name: n.name, breadcrumb: crumb, depth: prefix.length });
    flattenNodes(n.children, crumb, out);
  }
  return out;
}

export function findNodeById(nodes: ProjectNode[], id: string): ProjectNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const d = findNodeById(n.children, id);
    if (d) return d;
  }
  return null;
}

export function collectSubProjects(
  nodes: ProjectNode[], trailIds: string[] = [], trailNames: string[] = [],
  out: SubProject[] = [],
): SubProject[] {
  for (const n of nodes) {
    const path = [...trailIds, n.id];
    const names = [...trailNames, n.name];
    if (trailIds.length >= 1 && n.children.length > 0) {
      out.push({ node: n, path, parent: trailNames.join(' › ') });
    }
    collectSubProjects(n.children, path, names, out);
  }
  return out;
}

export function gatherRelations(projects: ProjectNode[], node: ProjectNode): GatheredRelations {
  const outgoing: ResolvedRelation[] = (node.relations ?? []).flatMap((rel) => {
    const target = findNodeById(projects, rel.to);
    const path = target ? findPathById(projects, rel.to) : null;
    if (!target || !path) return [];
    return [{ dir: 'out' as const, type: rel.type, label: REL[rel.type].label, node: target, path, stats: nodeStats(target) }];
  });

  const incoming: ResolvedRelation[] = [];
  (function walk(list: ProjectNode[]) {
    for (const n of list) {
      for (const rel of n.relations ?? []) {
        if (rel.to === node.id) {
          const path = findPathById(projects, n.id);
          if (path) incoming.push({ dir: 'in', type: rel.type, label: REL[rel.type].rev, node: n, path, stats: nodeStats(n) });
        }
      }
      walk(n.children);
    }
  })(projects);

  return { outgoing, incoming, count: outgoing.length + incoming.length };
}

export function fmtDate(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function daysLeft(iso: string | undefined): number | null {
  if (!iso) return null;
  const now = new Date('2026-05-29T00:00:00');
  return Math.round((new Date(iso + 'T00:00:00').getTime() - now.getTime()) / 86400000);
}
