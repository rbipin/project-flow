// components.jsx — cards, rings, modals

const { useState, useEffect, useRef } = React;

// ---- circular progress ring ------------------------------------------
function Ring({ pct, size = 56, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  return (
    <svg width={size} height={size} className="ring" viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rail)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset .6s cubic-bezier(.4,0,.2,1)" }}
      />
      <text x="50%" y="50%" className="ring-text" dominantBaseline="central" textAnchor="middle">
        {Math.round(pct * 100)}
      </text>
    </svg>
  );
}

// ---- project card ----------------------------------------------------
function ProjectCard({ project, variant, onOpen, label }) {
  const stats = projectStats(project);
  const dl = daysLeft(project.due);
  const cardState = stats.complete ? "state-complete" : (dl != null && dl < 0) ? "state-overdue" : stats.started ? "state-progress" : "state-new";
  return (
    <button className={"card project-card " + cardState} onClick={onOpen}>
      <div className="pc-top">
        <div className="pc-titles">
          {label && <span className="pc-crumb">{label}</span>}
          <h3 className="pc-name">{project.name}</h3>
          <p className="pc-blurb">{project.blurb}</p>
        </div>
        <Ring pct={stats.pct} />
      </div>

      <div className="pc-roadmap">
        <Roadmap stats={stats} variant={variant} mini />
      </div>

      <div className="pc-meta">
        <span className="chip">
          <b>{stats.reachedCount}</b>/{stats.milestoneCount} milestones
        </span>
        <span className="chip">
          <b>{stats.done}</b>/{stats.total} tasks
        </span>
        {stats.complete ? (
          <span className="chip chip-done">Complete</span>
        ) : dl != null ? (
          <span className={"chip" + (dl < 0 ? " chip-late" : "")}>
            {dl < 0 ? `${-dl}d overdue` : `${dl}d left`}
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ---- generic modal ----------------------------------------------------
function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ---- new project modal ------------------------------------------------
const DEFAULT_MILESTONES = ["Kickoff", "Build", "Review", "Launch"];

let _rk = 0;
const rowKey = () => "r" + _rk++;

function NewProjectModal({ projects, onClose, onCreate }) {
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [due, setDue] = useState("");
  const [rows, setRows] = useState(() =>
    DEFAULT_MILESTONES.map((m) => ({ key: rowKey(), kind: "new", name: m }))
  );
  const [relations, setRelations] = useState([]);
  const [relType, setRelType] = useState("depends");
  const [relTarget, setRelTarget] = useState("");
  const nameRef = useRef(null);

  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);

  const allNodes = flattenNodes(projects || []);
  const topProjects = (projects || []).map((p) => ({ id: p.id, name: p.name }));
  const attachedIds = rows.filter((r) => r.kind === "attach").map((r) => r.id);
  const attachOptions = topProjects.filter((p) => !attachedIds.includes(p.id));

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addNew = () => setRows((rs) => [...rs, { key: rowKey(), kind: "new", name: "" }]);
  const addAttach = () => setRows((rs) => [...rs, { key: rowKey(), kind: "attach", id: "" }]);
  const removeRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  const addRelation = () => {
    if (!relTarget) return;
    setRelations((rl) => [...rl, { to: relTarget, type: relType }]);
    setRelTarget(""); setRelType("depends");
  };
  const removeRelation = (i) => setRelations((rl) => rl.filter((_, idx) => idx !== i));

  const nodeName = (id) => { const n = allNodes.find((o) => o.id === id); return n ? n.breadcrumb.join(" › ") : "—"; };

  const validRows = rows.filter((r) => (r.kind === "new" ? r.name.trim() : r.id));
  const canCreate = name.trim() && validRows.length >= 1;

  const submit = () => {
    if (!canCreate) return;
    const children = validRows.map((r) =>
      r.kind === "attach"
        ? { __attach: r.id }
        : { id: uid(), name: r.name.trim(), blurb: "", tasks: [], children: [], relations: [] }
    );
    onCreate({
      id: uid(),
      name: name.trim(),
      blurb: blurb.trim() || "No description yet.",
      created: "2026-05-29",
      due: due || "",
      tasks: [],
      relations: relations.slice(),
      children,
    });
  };

  return (
    <Modal
      title="New project"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!canCreate} onClick={submit}>Create project</button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Project name</span>
        <input ref={nameRef} className="input" value={name} placeholder="e.g. Website Relaunch"
          onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span className="field-label">Short description</span>
        <input className="input" value={blurb} placeholder="One line about the goal"
          onChange={(e) => setBlurb(e.target.value)} />
      </label>

      <label className="field field-half">
        <span className="field-label">Target date</span>
        <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </label>

      <div className="field">
        <span className="field-label">
          Milestones <em className="hint">— add new ones, or attach an existing project</em>
        </span>
        <div className="ms-editor">
          {rows.map((r, i) => (
            <div className="ms-row" key={r.key}>
              <span className="ms-idx">{i + 1}</span>
              {r.kind === "attach" ? (
                <select className="input" value={r.id} onChange={(e) => setRow(r.key, { id: e.target.value })}>
                  <option value="">Choose a project to attach…</option>
                  {topProjects.map((p) => (
                    <option key={p.id} value={p.id} disabled={attachedIds.includes(p.id) && p.id !== r.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="input" value={r.name} placeholder="Milestone name"
                  onChange={(e) => setRow(r.key, { name: e.target.value })} />
              )}
              {r.kind === "attach" && <span className="ms-tag">attached</span>}
              <button className="icon-btn sm" onClick={() => removeRow(r.key)} aria-label="Remove"
                disabled={rows.length <= 1}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
          <div className="ms-addrow">
            <button className="btn ghost sm" onClick={addNew}>+ Add milestone</button>
            {attachOptions.length > 0 && (
              <button className="btn ghost sm" onClick={addAttach}>↳ Attach a project</button>
            )}
          </div>
        </div>
      </div>

      {allNodes.length > 0 && (
        <div className="field">
          <span className="field-label">
            Relationships <em className="hint">— link this to other projects (optional)</em>
          </span>
          {relations.length > 0 && (
            <ul className="draft-tasks">
              {relations.map((rl, i) => (
                <li key={i}>
                  <span><b style={{ fontWeight: 700 }}>{REL[rl.type].label}</b> · {nodeName(rl.to)}</span>
                  <button className="x" onClick={() => removeRelation(i)}>×</button>
                </li>
              ))}
            </ul>
          )}
          <div className="rel-add" style={{ marginTop: 9 }}>
            <select className="input" value={relType} onChange={(e) => setRelType(e.target.value)}>
              <option value="depends">Depends on</option>
              <option value="blocks">Blocks</option>
              <option value="related">Related to</option>
            </select>
            <select className="input" value={relTarget} onChange={(e) => setRelTarget(e.target.value)}>
              <option value="">Choose a project or milestone…</option>
              {allNodes.map((o) => (
                <option key={o.id} value={o.id}>{o.breadcrumb.join("  ›  ")}</option>
              ))}
            </select>
            <button className="btn ghost sm" onClick={addRelation} disabled={!relTarget}>Add link</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ---- project row (list view) -----------------------------------------
function ProjectRow({ project, variant, onOpen, label }) {
  const stats = projectStats(project);
  const dl = daysLeft(project.due);
  const cardState = stats.complete ? "state-complete" : (dl != null && dl < 0) ? "state-overdue" : stats.started ? "state-progress" : "state-new";
  return (
    <button className={"card project-row " + cardState} onClick={onOpen}>
      <div className="prow-lead">
        <Ring pct={stats.pct} size={44} stroke={4} />
      </div>
      <div className="prow-titles">
        {label && <span className="pc-crumb">{label}</span>}
        <h3 className="prow-name">{project.name}</h3>
        <p className="prow-blurb">{project.blurb}</p>
      </div>
      <div className="prow-roadmap">
        <Roadmap stats={stats} variant={variant} mini />
      </div>
      <div className="prow-meta">
        <span className="chip"><b>{stats.reachedCount}</b>/{stats.milestoneCount} ms</span>
        <span className="chip"><b>{stats.done}</b>/{stats.total} tasks</span>
        {stats.complete ? (
          <span className="chip chip-done">Complete</span>
        ) : dl != null ? (
          <span className={"chip" + (dl < 0 ? " chip-late" : "")}>{dl < 0 ? `${-dl}d over` : `${dl}d left`}</span>
        ) : null}
      </div>
      <svg viewBox="0 0 24 24" width="18" height="18" className="prow-chev"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}

Object.assign(window, { Ring, ProjectCard, ProjectRow, Modal, NewProjectModal });
