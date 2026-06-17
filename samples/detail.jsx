// detail.jsx — recursive project detail: breadcrumb, roadmap of sub-projects,
// open-any-milestone-as-its-own-project, task checklists, and relationships.

const { useState: useDS, useRef: useDR } = React;

// ---- reusable task checklist -----------------------------------------
function TaskChecklist({ tasks, onChange, placeholder }) {
  const [draft, setDraft] = useDS("");
  const add = () => {
    const v = draft.trim(); if (!v) return;
    onChange([...tasks, { id: uid(), title: v, done: false }]); setDraft("");
  };
  const toggle = (id) => onChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id) => onChange(tasks.filter((t) => t.id !== id));
  return (
    <div>
      <div className="task-adder big">
        <input className="input" value={draft} placeholder={placeholder || "Add a task…"}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn primary" onClick={add}>Add task</button>
      </div>
      <ul className="task-list">
        {tasks.length === 0 && <li className="task-empty">No tasks yet — add the first one above.</li>}
        {tasks.map((t) => (
          <li key={t.id} className={"task-row" + (t.done ? " done" : "")}>
            <button className="check" onClick={() => toggle(t.id)} aria-label="Toggle">
              {t.done && <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </button>
            <span className="task-title">{t.title}</span>
            <button className="task-del" onClick={() => remove(t.id)} aria-label="Delete">
              <svg viewBox="0 0 24 24" width="15" height="15"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- selected milestone (sub-project) panel --------------------------
function ChildPanel({ child, variant, path, onUpdateChild, onDeleteChild, onOpen, onNavigate }) {
  const st = nodeStats(child);
  const status = st.complete ? "Complete" : st.started ? "In progress" : "Not started";
  const badgeState = st.complete ? "complete" : st.started ? "progress" : "todo";

  return (
    <section className="sub-panel">
      <div className="sub-head">
        <div className="sub-head-main">
          <span className={"sub-badge is-" + badgeState}>
            {st.complete && <svg viewBox="0 0 24 24" width="15" height="15"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
          <div className="sub-titles">
            <input className="sub-name-input" value={child.name} placeholder="Milestone name"
              onChange={(e) => onUpdateChild({ ...child, name: e.target.value })} />
            <input className="sub-blurb-input" value={child.blurb || ""} placeholder="Add a description…"
              onChange={(e) => onUpdateChild({ ...child, blurb: e.target.value })} />
          </div>
        </div>
        <div className="sub-head-right">
          <span className={"chip" + (st.complete ? " chip-done" : "")}>{status} · {st.done}/{st.total}</span>
          <button className="btn ghost sm" onClick={onOpen}>Open
            <svg viewBox="0 0 24 24" width="14" height="14" style={{ marginLeft: 2 }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button className="icon-btn" onClick={() => onDeleteChild(child.id)} aria-label="Delete milestone" title="Delete milestone">
            <svg viewBox="0 0 24 24" width="17" height="17"><path d="M5 7h14M10 7V5h4v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      </div>

      <div className="sub-bar"><div className="sub-bar-fill" style={{ width: st.pct * 100 + "%" }} /></div>

      {st.isLeaf ? (
        <TaskChecklist tasks={child.tasks} placeholder={`Add a task to “${child.name || "this milestone"}”…`}
          onChange={(tasks) => onUpdateChild({ ...child, tasks })} />
      ) : (
        <div className="sub-asproject">
          <p className="sub-asproject-note">
            “{child.name || "This milestone"}” is its own project with {st.milestoneCount} milestones and {st.total} task{st.total === 1 ? "" : "s"} inside. Open it to manage everything — or jump straight into one:
          </p>
          <div className="sub-childlist">
            {st.markers.map((m) => (
              <button key={m.id} className="scl-item" onClick={() => onNavigate([...path, child.id, m.id])}>
                <span className={"scl-dot is-" + m.state} />
                <span className="scl-name">{m.label}</span>
                <span className="scl-meta">{m.hasChildren ? m.childCount + " ms" : m.done + "/" + m.total}</span>
                <svg viewBox="0 0 24 24" width="13" height="13" className="scl-chev"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={onOpen}>Open “{child.name}”
            <svg viewBox="0 0 24 24" width="15" height="15" style={{ marginLeft: 3 }}><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </section>
  );
}

// ---- relationships ----------------------------------------------------
function RelItem({ rel, onOpen, onRemove }) {
  const s = rel.stats;
  const state = s.complete ? "complete" : s.started ? "progress" : "todo";
  const crumb = (rel.path && rel.path.length > 1) ? rel.node.name : rel.node.name;
  return (
    <li className={"rel-item tone-" + REL[rel.type].tone}>
      <span className="rel-type">{rel.label}</span>
      <button className="rel-target" onClick={() => onOpen(rel.path)} title="Open">
        <span className={"scl-dot is-" + state} />
        <span className="rel-name">{rel.node.name}</span>
        <svg viewBox="0 0 24 24" width="13" height="13" className="rel-arrow"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {onRemove && (
        <button className="rel-x" onClick={onRemove} aria-label="Remove link">
          <svg viewBox="0 0 24 24" width="13" height="13"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      )}
    </li>
  );
}

function RelationshipsPanel({ projects, node, relations, onOpen, onUpdateNode }) {
  const [adding, setAdding] = useDS(false);
  const [target, setTarget] = useDS("");
  const [type, setType] = useDS("depends");

  // descendants to exclude from link targets
  const exclude = new Set();
  (function walk(n) { exclude.add(n.id); (n.children || []).forEach(walk); })(node);
  const options = flattenNodes(projects).filter((o) => !exclude.has(o.id));

  const removeOut = (idx) => {
    const rels = (node.relations || []).slice();
    rels.splice(idx, 1);
    onUpdateNode({ ...node, relations: rels });
  };
  const addLink = () => {
    if (!target) return;
    onUpdateNode({ ...node, relations: [...(node.relations || []), { to: target, type }] });
    setAdding(false); setTarget(""); setType("depends");
  };

  return (
    <section className="rel-panel">
      <div className="rel-head">
        <h2>Relationships <span className="count">{relations.count}</span></h2>
        <button className="btn ghost sm" onClick={() => setAdding((a) => !a)}>
          {adding ? "Cancel" : "+ Link"}
        </button>
      </div>

      {adding && (
        <div className="rel-add">
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="depends">Depends on</option>
            <option value="blocks">Blocks</option>
            <option value="related">Related to</option>
          </select>
          <select className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">Choose a project or milestone…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.breadcrumb.join("  ›  ")}</option>
            ))}
          </select>
          <button className="btn primary" onClick={addLink} disabled={!target}>Add</button>
        </div>
      )}

      {relations.count === 0 && !adding && (
        <p className="rel-empty">No links yet. Use <b>+ Link</b> to connect this to other projects or milestones.</p>
      )}

      {relations.outgoing.length > 0 && (
        <ul className="rel-list">
          {relations.outgoing.map((rel, i) => (
            <RelItem key={"o" + i} rel={rel} onOpen={onOpen} onRemove={() => removeOut(i)} />
          ))}
        </ul>
      )}
      {relations.incoming.length > 0 && (
        <ul className="rel-list rel-incoming">
          {relations.incoming.map((rel, i) => (
            <RelItem key={"i" + i} rel={rel} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ---- breadcrumb -------------------------------------------------------
function Breadcrumb({ trail, path, onNavigate, onHome }) {
  return (
    <nav className="crumb">
      <button className="crumb-link" onClick={onHome}>All projects</button>
      {trail.map((n, i) => (
        <React.Fragment key={n.id}>
          <span className="crumb-sep">›</span>
          {i === trail.length - 1 ? (
            <span className="crumb-current">{n.name}</span>
          ) : (
            <button className="crumb-link" onClick={() => onNavigate(path.slice(0, i + 1))}>{n.name}</button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

// ---- detail -----------------------------------------------------------
function ProjectDetail({ projects, path, node, trail, variant, onUpdateNode, onOpenChild, onNavigate, onHome, onDeleteNode }) {
  const stats = nodeStats(node);
  const relations = gatherRelations(projects, node);
  const isTop = path.length === 1;
  const children = node.children || [];

  const [selectedId, setSelectedId] = useDS(() => {
    const cur = stats.markers[stats.currentIndex];
    return cur ? cur.id : null;
  });
  React.useEffect(() => {
    if (children.length && !children.find((c) => c.id === selectedId)) {
      const cur = stats.markers[stats.currentIndex];
      setSelectedId(cur ? cur.id : children[0].id);
    }
  }, [node.id, children.length]);

  const selected = children.find((c) => c.id === selectedId);

  const updateChild = (nc) => onUpdateNode({ ...node, children: children.map((c) => (c.id === nc.id ? nc : c)) });
  const deleteChild = (id) => {
    const remaining = children.filter((c) => c.id !== id);
    onUpdateNode({ ...node, children: remaining });
    setSelectedId(remaining[0] ? remaining[0].id : null);
  };
  const addMilestone = () => {
    const ns = { id: uid(), name: "New milestone", blurb: "", tasks: [], children: [], relations: [] };
    onUpdateNode({ ...node, children: [...children, ns] });
    setSelectedId(ns.id);
  };

  const dl = daysLeft(node.due);
  const nextMarker = stats.markers.find((m) => !m.complete);

  return (
    <div className="detail">
      <Breadcrumb trail={trail} path={path} onNavigate={onNavigate} onHome={onHome} />

      <header className="detail-head">
        <div className="dh-left">
          <input className="dh-name-input" value={node.name}
            onChange={(e) => onUpdateNode({ ...node, name: e.target.value })} />
          <input className="dh-blurb-input" value={node.blurb || ""} placeholder="Add a description…"
            onChange={(e) => onUpdateNode({ ...node, blurb: e.target.value })} />
          <div className="dh-meta">
            {isTop && node.created && <span className="chip">Started {fmtDate(node.created)}</span>}
            {isTop && node.due && (
              <span className={"chip" + (dl < 0 && !stats.complete ? " chip-late" : "")}>
                Target {fmtDate(node.due)}{dl != null && !stats.complete ? ` · ${dl < 0 ? -dl + "d over" : dl + "d left"}` : ""}
              </span>
            )}
            {!isTop && trail.length >= 2 && (
              <span className="chip">Part of {trail[trail.length - 2].name}</span>
            )}
            <button className="chip chip-btn danger" onClick={() => onDeleteNode(path)}>
              {isTop ? "Delete project" : "Delete this"}
            </button>
          </div>
        </div>
        <div className="dh-right">
          <Ring pct={stats.pct} size={88} stroke={7} />
          <div className="dh-stat">
            {stats.isLeaf ? (
              <><b>{stats.done} <span>/ {stats.total}</span></b><em>tasks done</em></>
            ) : (
              <><b>{stats.reachedCount} <span>/ {stats.milestoneCount}</span></b><em>milestones reached</em></>
            )}
          </div>
        </div>
      </header>

      <RelationshipsPanel projects={projects} node={node} relations={relations}
        onOpen={onNavigate} onUpdateNode={onUpdateNode} />

      {children.length > 0 ? (
        <>
          <section className="roadmap-panel">
            <div className="rp-head">
              <h2>Roadmap</h2>
              <div className="rp-head-right">
                {stats.complete ? (
                  <span className="rp-status done">All milestones reached</span>
                ) : nextMarker ? (
                  <span className="rp-status">Up next: <b>{nextMarker.label}</b></span>
                ) : null}
                <button className="btn ghost sm" onClick={addMilestone}>+ Add milestone</button>
              </div>
            </div>
            <div className={"roadmap-stage v-" + variant}>
              <Roadmap stats={stats} variant={variant} selectedId={selectedId} onSelect={setSelectedId} />
            </div>
            <p className="rp-hint">Click a milestone to manage it below · open it to make it its own project.</p>
          </section>

          {selected && (
            <ChildPanel child={selected} variant={variant} path={path}
              onUpdateChild={updateChild} onDeleteChild={deleteChild}
              onOpen={() => onOpenChild(selected.id)} onNavigate={onNavigate} />
          )}

          {node.tasks && node.tasks.length > 0 && (
            <section className="sub-panel">
              <div className="rp-head"><h2>Direct tasks</h2></div>
              <div className="sub-bar" style={{ marginTop: 14 }}>
                <div className="sub-bar-fill" style={{ width: (node.tasks.filter((t) => t.done).length / node.tasks.length) * 100 + "%" }} />
              </div>
              <TaskChecklist tasks={node.tasks} onChange={(tasks) => onUpdateNode({ ...node, tasks })} />
            </section>
          )}
        </>
      ) : (
        <section className="sub-panel">
          <div className="rp-head">
            <h2>Tasks <span className="count">{stats.done}/{stats.total}</span></h2>
            <button className="btn ghost sm" onClick={addMilestone}>Break into milestones</button>
          </div>
          <div className="sub-bar" style={{ marginTop: 14 }}><div className="sub-bar-fill" style={{ width: stats.pct * 100 + "%" }} /></div>
          <TaskChecklist tasks={node.tasks || []} onChange={(tasks) => onUpdateNode({ ...node, tasks })} />
        </section>
      )}
    </div>
  );
}

Object.assign(window, { ProjectDetail });
