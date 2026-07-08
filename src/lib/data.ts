import type {
  ProjectNode, NodeStats, Marker, FlatNode, SubProject,
  GatheredRelations, ResolvedRelation, RelMeta, RelationType,
} from './types';
import { getActiveUid, pushToFirestore } from './sync';

export const STORAGE_KEY = 'project-tracker:v3';

export const uid = (): string => Math.random().toString(36).slice(2, 9);

export const REL: Record<RelationType, RelMeta> = {
  depends: { label: 'Depends on', rev: 'Needed by',  tone: 'warn' },
  blocks:  { label: 'Blocks',     rev: 'Blocked by', tone: 'danger' },
  related: { label: 'Related to', rev: 'Related to', tone: 'neutral' },
};

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
  return [];
}

export function saveProjects(projects: ProjectNode[]): void {
  if (typeof window === 'undefined') return;
  const lastModified = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects, lastModified }));
  } catch (_) {}
  const activeUid = getActiveUid();
  if (activeUid) pushToFirestore(activeUid, projects, lastModified);
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
