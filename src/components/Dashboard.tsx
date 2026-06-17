'use client';

import { useMemo } from 'react';
import { nodeStats, collectSubProjects } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { ProjectCard } from './ProjectCard';
import { ProjectRow } from './ProjectRow';

interface DashboardProps {
  projects: ProjectNode[];
  variant: 'track' | 'stations' | 'stepper';
  onOpenPath: (path: string[]) => void;
  onNew: () => void;
  view: 'grid' | 'list';
  onSetView: (v: 'grid' | 'list') => void;
}

export function Dashboard({
  projects,
  variant,
  onOpenPath,
  onNew,
  view,
  onSetView,
}: DashboardProps) {
  const totals = useMemo(() => {
    let tasks = 0, done = 0, ms = 0, msReached = 0, complete = 0;
    projects.forEach((p) => {
      const s = nodeStats(p);
      tasks += s.total;
      done += s.done;
      ms += s.milestoneCount;
      msReached += s.reachedCount;
      if (s.complete) complete++;
    });
    return { tasks, done, ms, msReached, complete, count: projects.length };
  }, [projects]);

  const subProjects = useMemo(() => collectSubProjects(projects), [projects]);
  const isList = view === 'list';
  const Item = isList ? ProjectRow : ProjectCard;

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Project Tracker</p>
          <h1>Your projects</h1>
        </div>
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
      </header>

      <div className="stat-strip">
        <div className="stat">
          <b>{totals.count}</b>
          <em>active projects</em>
        </div>
        <div className="stat">
          <b>
            {totals.msReached}
            <span>/{totals.ms}</span>
          </b>
          <em>milestones reached</em>
        </div>
        <div className="stat">
          <b>
            {totals.done}
            <span>/{totals.tasks}</span>
          </b>
          <em>tasks done</em>
        </div>
        <div className="stat">
          <b>{totals.complete}</b>
          <em>completed</em>
        </div>
      </div>

      <div className="dash-toolbar">
        <h2 className="dash-sec-title">
          All projects <span>{projects.length}</span>
        </h2>
        <div className="view-toggle" role="tablist" aria-label="View">
          <button
            className={'vt-btn' + (!isList ? ' is-on' : '')}
            onClick={() => onSetView('grid')}
            title="Tile view"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" fill="currentColor" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" />
            </svg>
            Tiles
          </button>
          <button
            className={'vt-btn' + (isList ? ' is-on' : '')}
            onClick={() => onSetView('list')}
            title="List view"
          >
            <svg viewBox="0 0 24 24" width="16" height="16">
              <rect x="3" y="4" width="18" height="3.5" rx="1.5" fill="currentColor" />
              <rect x="3" y="10.25" width="18" height="3.5" rx="1.5" fill="currentColor" />
              <rect x="3" y="16.5" width="18" height="3.5" rx="1.5" fill="currentColor" />
            </svg>
            List
          </button>
        </div>
      </div>

      <div className={isList ? 'row-list' : 'card-grid'}>
        {projects.map((p) => (
          <Item
            key={p.id}
            project={p}
            variant={variant}
            onOpen={() => onOpenPath([p.id])}
          />
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
          <div className={isList ? 'row-list' : 'card-grid'}>
            {subProjects.map((sp) => (
              <Item
                key={sp.path.join('/')}
                project={sp.node}
                variant={variant}
                label={sp.parent}
                onOpen={() => onOpenPath(sp.path)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
