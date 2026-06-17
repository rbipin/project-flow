// app.jsx — App shell (recursive path navigation), Dashboard, Tweaks

const { useState: useS, useEffect: useE, useMemo } = React;

// ---------- Dashboard -------------------------------------------------
function Dashboard({ projects, variant, onOpenPath, onNew, view, onSetView }) {
  const totals = useMemo(() => {
    let tasks = 0, done = 0, ms = 0, msReached = 0, complete = 0;
    projects.forEach((p) => {
      const s = nodeStats(p);
      tasks += s.total; done += s.done; ms += s.milestoneCount;
      msReached += s.reachedCount; if (s.complete) complete++;
    });
    return { tasks, done, ms, msReached, complete, count: projects.length };
  }, [projects]);

  const subProjects = useMemo(() => collectSubProjects(projects), [projects]);
  const isList = view === "list";
  const Item = isList ? ProjectRow : ProjectCard;

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Project Tracker</p>
          <h1>Your projects</h1>
        </div>
        <button className="btn primary lg" onClick={onNew}>
          <svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          New project
        </button>
      </header>

      <div className="stat-strip">
        <div className="stat"><b>{totals.count}</b><em>active projects</em></div>
        <div className="stat"><b>{totals.msReached}<span>/{totals.ms}</span></b><em>milestones reached</em></div>
        <div className="stat"><b>{totals.done}<span>/{totals.tasks}</span></b><em>tasks done</em></div>
        <div className="stat"><b>{totals.complete}</b><em>completed</em></div>
      </div>

      <div className="dash-toolbar">
        <h2 className="dash-sec-title">All projects <span>{projects.length}</span></h2>
        <div className="view-toggle" role="tablist" aria-label="View">
          <button className={"vt-btn" + (!isList ? " is-on" : "")} onClick={() => onSetView("grid")} title="Tile view">
            <svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor"/><rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor"/></svg>
            Tiles
          </button>
          <button className={"vt-btn" + (isList ? " is-on" : "")} onClick={() => onSetView("list")} title="List view">
            <svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="3.5" rx="1.5" fill="currentColor"/><rect x="3" y="10.25" width="18" height="3.5" rx="1.5" fill="currentColor"/><rect x="3" y="16.5" width="18" height="3.5" rx="1.5" fill="currentColor"/></svg>
            List
          </button>
        </div>
      </div>

      <div className={isList ? "row-list" : "card-grid"}>
        {projects.map((p) => (
          <Item key={p.id} project={p} variant={variant} onOpen={() => onOpenPath([p.id])} />
        ))}
        {!isList && (
          <button className="card new-card" onClick={onNew}>
            <span className="new-plus">+</span>
            <span>Start a new project</span>
          </button>
        )}
        {isList && (
          <button className="row-new" onClick={onNew}>
            <span className="new-plus">+</span> Start a new project
          </button>
        )}
      </div>

      {subProjects.length > 0 && (
        <div className="subproj-section">
          <div className="section-head">
            <h2>Sub-projects</h2>
            <p>Projects nested inside your projects — each with its own roadmap.</p>
          </div>
          <div className={isList ? "row-list" : "card-grid"}>
            {subProjects.map((sp) => (
              <Item key={sp.path.join("/")} project={sp.node} variant={variant}
                label={sp.parent} onOpen={() => onOpenPath(sp.path)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- App -------------------------------------------------------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "roadmapStyle": "track",
  "accent": "#E8772E",
  "density": "regular",
  "showRing": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [projects, setProjects] = useS(loadProjects);
  const [path, setPath] = useS([]); // array of ids root→node; [] = dashboard
  const [showNew, setShowNew] = useS(false);
  const [dashView, setDashView] = useS(() => {
    try { return localStorage.getItem("project-tracker:view") || "grid"; } catch (e) { return "grid"; }
  });
  const setView = (v) => { setDashView(v); try { localStorage.setItem("project-tracker:view", v); } catch (e) {} };

  useE(() => { saveProjects(projects); }, [projects]);
  useE(() => { document.documentElement.style.setProperty("--accent", t.accent); }, [t.accent]);

  const variant = t.roadmapStyle;

  // resolve current location safely
  const trail = findTrail(projects, path);
  const curPath = trail.map((n) => n.id);
  const current = trail[trail.length - 1] || null;

  // keep state path in sync if the tree changed under us
  useE(() => {
    if (path.length !== curPath.length || path.some((id, i) => id !== curPath[i])) {
      setPath(curPath);
    }
  }); // eslint-disable-line

  const home = () => { setPath([]); window.scrollTo(0, 0); };
  const openTop = (id) => { setPath([id]); window.scrollTo(0, 0); };
  const openChild = (childId) => { setPath([...curPath, childId]); window.scrollTo(0, 0); };
  const navigate = (p) => { setPath(p); window.scrollTo(0, 0); };

  const updateNode = (newNode) => setProjects((arr) => replaceNodeAtPath(arr, curPath, newNode));
  const deleteNode = (targetPath) => {
    setProjects((arr) => deleteNodeAtPath(arr, targetPath));
    setPath(targetPath.slice(0, -1));
    window.scrollTo(0, 0);
  };

  const createProject = (spec) => {
    setProjects((arr) => {
      let pool = arr;
      const children = (spec.children || []).map((c) => {
        if (c && c.__attach) {
          const found = findNodeById(pool, c.__attach);
          if (found) {
            const p = findPathById(pool, c.__attach);
            pool = deleteNodeAtPath(pool, p);
            return found;
          }
          return null;
        }
        return c;
      }).filter(Boolean);
      return [{ ...spec, children }, ...pool];
    });
    setShowNew(false);
    setPath([spec.id]); window.scrollTo(0, 0);
  };

  return (
    <div className={"app dens-" + t.density + (t.showRing ? "" : " no-ring")}>
      {current ? (
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
        />
      ) : (
        <Dashboard projects={projects} variant={variant} onOpenPath={navigate} onNew={() => setShowNew(true)}
          view={dashView} onSetView={setView} />
      )}

      {showNew && <NewProjectModal projects={projects} onClose={() => setShowNew(false)} onCreate={createProject} />}

      <TweaksPanel>
        <TweakSection label="Roadmap" />
        <TweakRadio label="Roadmap style" value={t.roadmapStyle}
          options={["track", "stations", "stepper"]} onChange={(v) => setTweak("roadmapStyle", v)} />
        <TweakSection label="Appearance" />
        <TweakColor label="Accent" value={t.accent}
          options={["#E8772E", "#E0A100", "#D6552B", "#2F8F6B", "#3B6FE0"]} onChange={(v) => setTweak("accent", v)} />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular", "comfy"]} onChange={(v) => setTweak("density", v)} />
        <TweakToggle label="Show progress rings" value={t.showRing} onChange={(v) => setTweak("showRing", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
