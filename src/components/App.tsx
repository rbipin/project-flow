'use client';

import { useState, useEffect, useRef } from 'react';
import {
  loadProjects,
  saveProjects,
  findTrail,
  replaceNodeAtPath,
  deleteNodeAtPath,
  findNodeById,
  findPathById,
} from '@/lib/data';
import { ProjectNode, TweakValues } from '@/lib/types';
import {
  TweaksPanel,
  TweakSection,
  TweakRadio,
  TweakColor,
  TweakToggle,
  useTweaks,
} from './TweaksPanel';
import { Dashboard } from './Dashboard';
import { ProjectDetail } from './ProjectDetail';
import { NewProjectModal } from './NewProjectModal';

const TWEAK_DEFAULTS: TweakValues = {
  roadmapStyle: 'track',
  accent: '#E8772E',
  density: 'regular',
  showRing: true,
};

export function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [path, setPath] = useState<string[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [dashView, setDashView] = useState<'grid' | 'list'>('grid');
  const [mounted, setMounted] = useState(false);
  const hasLoaded = useRef(false);

  // Runs before the load effect on mount — hasLoaded is still false, so the write is skipped.
  // After load sets hasLoaded=true, subsequent project changes will trigger a save.
  useEffect(() => {
    if (hasLoaded.current) saveProjects(projects);
  }, [projects]);

  useEffect(() => {
    setProjects(loadProjects());
    try {
      const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list';
      if (stored) setDashView(stored);
    } catch (_) {}
    hasLoaded.current = true;
    setMounted(true);
  }, []);

  const setView = (v: 'grid' | 'list') => {
    setDashView(v);
    try {
      localStorage.setItem('project-tracker:view', v);
    } catch (_) {}
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', t.accent);
  }, [t.accent]);

  const variant = t.roadmapStyle;

  const trail = findTrail(projects, path);
  const curPath = trail.map((n) => n.id);
  const current = trail[trail.length - 1] || null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (path.length !== curPath.length || path.some((id, i) => id !== curPath[i])) {
      setPath(curPath);
    }
  });

  const home = () => {
    setPath([]);
    window.scrollTo(0, 0);
  };
  const openChild = (childId: string) => {
    setPath([...curPath, childId]);
    window.scrollTo(0, 0);
  };
  const navigate = (p: string[]) => {
    setPath(p);
    window.scrollTo(0, 0);
  };

  const updateNode = (newNode: ProjectNode) =>
    setProjects((arr) => replaceNodeAtPath(arr, curPath, newNode));

  const deleteNode = (targetPath: string[]) => {
    setProjects((arr) => deleteNodeAtPath(arr, targetPath));
    setPath(targetPath.slice(0, -1));
    window.scrollTo(0, 0);
  };

  const createProject = (
    spec: Omit<ProjectNode, 'children'> & { children: Array<ProjectNode | { __attach: string }> }
  ) => {
    setProjects((arr) => {
      let pool = arr;
      const children = (spec.children || [])
        .map((c) => {
          if (c && '__attach' in c) {
            const found = findNodeById(pool, c.__attach);
            if (found) {
              const p = findPathById(pool, c.__attach);
              if (p) {
                pool = deleteNodeAtPath(pool, p);
              }
              return found;
            }
            return null;
          }
          return c as ProjectNode;
        })
        .filter((c): c is ProjectNode => c !== null);
      return [{ ...spec, children }, ...pool];
    });
    setShowNew(false);
    setPath([spec.id]);
    window.scrollTo(0, 0);
  };

  if (!mounted) return null;

  return (
    <div className={'app dens-' + t.density + (t.showRing ? '' : ' no-ring')}>
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
        <Dashboard
          projects={projects}
          variant={variant}
          onOpenPath={navigate}
          onNew={() => setShowNew(true)}
          view={dashView}
          onSetView={setView}
        />
      )}
      {showNew && (
        <NewProjectModal
          projects={projects}
          onClose={() => setShowNew(false)}
          onCreate={createProject}
        />
      )}
      <TweaksPanel>
        <TweakSection label="Roadmap" />
        <TweakRadio
          label="Roadmap style"
          value={t.roadmapStyle}
          options={['track', 'stations', 'stepper']}
          onChange={(v) => setTweak('roadmapStyle', v)}
        />
        <TweakSection label="Appearance" />
        <TweakColor
          label="Accent"
          value={t.accent}
          options={['#E8772E', '#E0A100', '#D6552B', '#2F8F6B', '#3B6FE0']}
          onChange={(v) => setTweak('accent', Array.isArray(v) ? v[0] : v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['compact', 'regular', 'comfy']}
          onChange={(v) => setTweak('density', v)}
        />
        <TweakToggle
          label="Show progress rings"
          value={t.showRing}
          onChange={(v) => setTweak('showRing', v)}
        />
      </TweaksPanel>
    </div>
  );
}
