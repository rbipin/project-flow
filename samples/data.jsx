// data.jsx — recursive project tree, persistence, derived stats, relationships
//
// Model: every node has the same shape — { id, name, blurb, tasks[], children[],
// relations[] }. A node with children shows a ROADMAP (each child = a milestone
// that is itself a full project you can open). A node with no children is a leaf
// with a task checklist. `relations` link a node to OTHER nodes anywhere in the
// tree (depends-on / blocks / related-to), shown in the detail view.

const STORAGE_KEY = "project-tracker:v3";
const uid = () => Math.random().toString(36).slice(2, 9);

const REL = {
  depends: { label: "Depends on", rev: "Needed by", tone: "warn" },
  blocks:  { label: "Blocks",     rev: "Blocked by", tone: "danger" },
  related: { label: "Related to", rev: "Related to", tone: "neutral" },
};

// ---- builders ---------------------------------------------------------
function leaf(name, blurb, tasks) {
  return { id: uid(), name, blurb, children: [], relations: [],
    tasks: tasks.map(([title, done]) => ({ id: uid(), title, done })) };
}
function group(name, blurb, children) {
  return { id: uid(), name, blurb, tasks: [], relations: [], children };
}

// ---- seed -------------------------------------------------------------
function seedProjects() {
  const ix = (p, names) => names.map((n) => idOf(p, n)); // helper placeholder

  const mobile = {
    id: uid(), name: "Mobile App Redesign",
    blurb: "Ship the new iOS + Android experience for Q3.",
    created: "2026-03-02", due: "2026-07-15", relations: [], tasks: [],
    children: [
      leaf("Kickoff", "Align the team and frame the problem.", [
        ["Stakeholder kickoff workshop", true], ["Competitive audit", true],
      ]),
      leaf("Research", "Understand users and synthesize insights.", [
        ["User interviews (n=8)", true], ["Synthesize research findings", true],
      ]),
      group("Design", "A project in its own right — IA through design system.", [
        leaf("Information architecture", "Structure and navigation.", [
          ["Site map", true], ["Nav model", true],
        ]),
        leaf("Wireframes", "Low-fi core flows.", [
          ["Wireframe onboarding", true], ["Wireframe home", true], ["Wireframe settings", false],
        ]),
        leaf("Hi-fi screens", "Polished visual designs.", [
          ["Hi-fi onboarding", true], ["Hi-fi home", false], ["Hi-fi profile", false],
        ]),
        leaf("Design system", "Reusable tokens + components.", [
          ["Color + type tokens", false], ["Component library", false],
        ]),
      ]),
      leaf("Build", "Implement and QA the new experience.", [
        ["Frontend build — onboarding", false], ["Frontend build — home", false], ["QA pass", false],
      ]),
      leaf("Launch", "Submit and release to stores.", [
        ["App store submission", false],
      ]),
    ],
  };

  const marketing = {
    id: uid(), name: "Q3 Marketing Site",
    blurb: "New landing pages and brand refresh for launch.",
    created: "2026-04-10", due: "2026-06-30", relations: [], tasks: [],
    children: [
      leaf("Brief", "Lock the creative direction.", [["Creative brief approved", true]]),
      leaf("Copy", "Write the messaging and pages.", [
        ["Messaging framework", true], ["Homepage copy", true], ["Pricing page copy", false],
      ]),
      leaf("Design", "Visual design of key pages.", [
        ["Visual design — hero", false], ["Visual design — pricing", false],
      ]),
      leaf("Launch", "Build and ship.", [["Build + deploy", false]]),
    ],
  };

  const pipeline = {
    id: uid(), name: "Data Pipeline v2",
    blurb: "Migrate ingestion to streaming architecture.",
    created: "2026-05-01", due: "2026-09-01", relations: [], tasks: [],
    children: [
      leaf("Spec", "Decide the architecture.", [["Architecture spec", true]]),
      leaf("Prototype", "Validate the streaming approach.", [
        ["Spike: Kafka vs Kinesis", false], ["Build prototype consumer", false],
      ]),
      leaf("Migrate", "Move data and traffic over.", [
        ["Backfill historical data", false], ["Cutover plan", false],
      ]),
      leaf("Harden", "Make it production-ready.", [["Load testing", false]]),
    ],
  };

  // ---- relationships (by readable lookup) ----
  const find = (root, name) => {
    let hit = null;
    (function walk(n) { if (n.name === name) hit = n; (n.children || []).forEach(walk); })(root);
    return hit;
  };
  // Build depends on Design (must finish design first)
  find(mobile, "Build").relations.push({ to: find(mobile, "Design").id, type: "depends" });
  // Launch depends on Build
  find(mobile, "Launch").relations.push({ to: find(mobile, "Build").id, type: "depends" });
  // Hi-fi screens depend on Wireframes
  find(mobile, "Hi-fi screens").relations.push({ to: find(mobile, "Wireframes").id, type: "depends" });
  // Marketing site relates to the app redesign, and its Design depends on the app's Design system
  marketing.relations.push({ to: mobile.id, type: "related" });
  find(marketing, "Design").relations.push({ to: find(mobile, "Design system").id, type: "depends" });
  // Data pipeline blocks the app's Build (app needs the new data)
  pipeline.relations.push({ to: find(mobile, "Build").id, type: "blocks" });

  return [mobile, marketing, pipeline];
}

function idOf() { return null; }

// ---- persistence ------------------------------------------------------
function loadProjects() {
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch (e) {}
  const seed = seedProjects();
  saveProjects(seed);
  return seed;
}
function saveProjects(projects) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); } catch (e) {}
}

// ---- recursive stats --------------------------------------------------
function nodeStats(node) {
  const children = node.children || [];
  if (children.length > 0) {
    let total = 0, done = 0;
    const markers = children.map((c, i) => {
      const cs = nodeStats(c);
      total += cs.total; done += cs.done;
      return {
        id: c.id, label: c.name, pos: (i + 1) / children.length,
        pct: cs.pct, done: cs.done, total: cs.total,
        complete: cs.complete, started: cs.started,
        hasChildren: (c.children && c.children.length > 0),
        childCount: (c.children ? c.children.length : 0),
        state: cs.complete ? "complete" : cs.started ? "progress" : "todo",
      };
    });
    const pct = total === 0 ? 0 : done / total;
    const reachedCount = markers.filter((m) => m.complete).length;
    let currentIndex = markers.findIndex((m) => !m.complete);
    if (currentIndex === -1) currentIndex = children.length - 1;
    return {
      isLeaf: false, total, done, pct, pctLabel: Math.round(pct * 100),
      markers, reachedCount, milestoneCount: children.length,
      currentIndex, currentLabel: children[currentIndex] ? children[currentIndex].name : "—",
      complete: reachedCount === children.length, started: done > 0,
    };
  }
  const tasks = node.tasks || [];
  const total = tasks.length, done = tasks.filter((t) => t.done).length;
  const pct = total === 0 ? 0 : done / total;
  return {
    isLeaf: true, total, done, pct, pctLabel: Math.round(pct * 100),
    markers: [], reachedCount: 0, milestoneCount: 0,
    complete: total > 0 && done === total, started: done > 0,
  };
}
const projectStats = nodeStats;

// ---- tree helpers (immutable, path = array of ids root→node) ----------
function replaceNodeAtPath(nodes, path, newNode) {
  const [h, ...r] = path;
  return nodes.map((n) =>
    n.id !== h ? n : r.length === 0 ? newNode : { ...n, children: replaceNodeAtPath(n.children || [], r, newNode) }
  );
}
function deleteNodeAtPath(nodes, path) {
  const [h, ...r] = path;
  if (r.length === 0) return nodes.filter((n) => n.id !== h);
  return nodes.map((n) => (n.id !== h ? n : { ...n, children: deleteNodeAtPath(n.children || [], r) }));
}
function findTrail(nodes, path) {
  const trail = []; let cur = nodes;
  for (const id of path) {
    const n = (cur || []).find((x) => x.id === id);
    if (!n) break;
    trail.push(n); cur = n.children || [];
  }
  return trail;
}
function findPathById(nodes, id, prefix = []) {
  for (const n of nodes) {
    const here = [...prefix, n.id];
    if (n.id === id) return here;
    const deep = findPathById(n.children || [], id, here);
    if (deep) return deep;
  }
  return null;
}
// flatten every node with a breadcrumb of names, for pickers
function flattenNodes(nodes, prefix = [], out = []) {
  for (const n of nodes) {
    const crumb = [...prefix, n.name];
    out.push({ id: n.id, name: n.name, breadcrumb: crumb, depth: prefix.length });
    flattenNodes(n.children || [], crumb, out);
  }
  return out;
}
function findNodeById(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const d = findNodeById(n.children || [], id);
    if (d) return d;
  }
  return null;
}

// Collect nested nodes that are themselves project-like (have their own
// sub-milestones), with their full path + a breadcrumb of ancestors.
function collectSubProjects(nodes, trailIds = [], trailNames = [], out = []) {
  for (const n of nodes) {
    const path = [...trailIds, n.id];
    const names = [...trailNames, n.name];
    const hasChildren = n.children && n.children.length > 0;
    if (trailIds.length >= 1 && hasChildren) {
      out.push({ node: n, path, parent: trailNames.join(" › ") });
    }
    collectSubProjects(n.children || [], path, names, out);
  }
  return out;
}

// Gather a node's relationships, both directions, resolved to nodes + paths.
function gatherRelations(projects, node) {
  const outgoing = (node.relations || []).map((rel) => {
    const target = findNodeById(projects, rel.to);
    if (!target) return null;
    return { dir: "out", type: rel.type, label: REL[rel.type].label,
      node: target, path: findPathById(projects, rel.to), stats: nodeStats(target) };
  }).filter(Boolean);

  const incoming = [];
  (function walk(list) {
    for (const n of list) {
      (n.relations || []).forEach((rel) => {
        if (rel.to === node.id) {
          incoming.push({ dir: "in", type: rel.type, label: REL[rel.type].rev,
            node: n, path: findPathById(projects, n.id), stats: nodeStats(n) });
        }
      });
      walk(n.children || []);
    }
  })(projects);

  return { outgoing, incoming, count: outgoing.length + incoming.length };
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function daysLeft(iso) {
  if (!iso) return null;
  const now = new Date("2026-05-29T00:00:00");
  return Math.round((new Date(iso + "T00:00:00") - now) / 86400000);
}

Object.assign(window, {
  uid, REL, leaf, group,
  loadProjects, saveProjects, nodeStats, projectStats,
  replaceNodeAtPath, deleteNodeAtPath, findTrail, findPathById,
  flattenNodes, findNodeById, collectSubProjects, gatherRelations, fmtDate, daysLeft,
});
