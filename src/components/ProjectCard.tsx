'use client';

import { nodeStats, daysLeft } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { Ring } from './Ring';
import { Roadmap } from './Roadmap';

interface ProjectCardProps {
  project: ProjectNode;
  variant: 'track' | 'stations' | 'stepper';
  onOpen: () => void;
  label?: string;
  readOnly?: boolean;
}

export function ProjectCard({ project, variant, onOpen, label, readOnly: _readOnly }: ProjectCardProps) {
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
    <button className={'card project-card ' + cardState} onClick={onOpen}>
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
          <span className={'chip' + (dl < 0 ? ' chip-late' : '')}>
            {dl < 0 ? `${-dl}d overdue` : `${dl}d left`}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default ProjectCard;
