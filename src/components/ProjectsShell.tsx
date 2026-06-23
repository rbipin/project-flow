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
