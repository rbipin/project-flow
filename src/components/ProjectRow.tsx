'use client';

import { nodeStats, daysLeft } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { Ring } from './Ring';
import { Roadmap } from './Roadmap';

interface ProjectRowProps {
  project: ProjectNode;
  variant: 'track' | 'stations' | 'stepper';
  onOpen: () => void;
  label?: string;
}

export function ProjectRow({ project, variant, onOpen, label }: ProjectRowProps) {
  const stats = nodeStats(project);
  const dl = daysLeft(project.due);
  const cardState = stats.complete
    ? 'state-complete'
    : dl != null && dl < 0
    ? 'state-overdue'
    : stats.started
    ? 'state-progress'
    : 'state-new';

  return (
    <button className={'card project-row ' + cardState} onClick={onOpen}>
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
        <span className="chip">
          <b>{stats.reachedCount}</b>/{stats.milestoneCount} ms
        </span>
        <span className="chip">
          <b>{stats.done}</b>/{stats.total} tasks
        </span>
        {stats.complete ? (
          <span className="chip chip-done">Complete</span>
        ) : dl != null ? (
          <span className={'chip' + (dl < 0 ? ' chip-late' : '')}>
            {dl < 0 ? `${-dl}d over` : `${dl}d left`}
          </span>
        ) : null}
      </div>
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        className="prow-chev"
      >
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
  );
}

export default ProjectRow;
