'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { loadProjects, findTrail } from '@/lib/data';
import type { ProjectNode } from '@/lib/types';
import { ProjectsShell } from './ProjectsShell';
import { ThemeToggle } from './ThemeToggle';

// Hardcoded view-mode display defaults. Mirrors TWEAK_DEFAULTS in App.tsx.
const VIEW_DEFAULTS = {
  roadmapStyle: 'track' as 'track' | 'stations' | 'stepper',
  accent: '#E8772E',
  density: 'regular' as 'compact' | 'regular' | 'comfy',
  showRing: true,
};

export interface ViewAppProps {
  path: string[];
}

export function ViewApp({ path }: ViewAppProps) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectNode[]>([]);
  const [view, setViewState] = useState<'grid' | 'list'>('grid');
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setProjects(loadProjects());
    try {
      const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list' | null;
      if (stored) setViewState(stored);
    } catch (_) {}
    try {
      setDark(localStorage.getItem('project-tracker:theme') === 'dark');
    } catch (_) {}
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('project-tracker:theme', dark ? 'dark' : 'light'); } catch (_) {}
  }, [dark]);

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', VIEW_DEFAULTS.accent);
  }, []);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 320);
    setDark((d) => !d);
  };

  const setView = (v: 'grid' | 'list') => {
    setViewState(v);
    try { localStorage.setItem('project-tracker:view', v); } catch (_) {}
  };

  const pushPath = (next: string[]) => {
    const suffix = next.length === 0 ? '' : '/' + next.map(encodeURIComponent).join('/');
    router.push('/view' + suffix);
    window.scrollTo(0, 0);
  };

  const validPath = useMemo(() => {
    if (!mounted) return path;
    const trail = findTrail(projects, path);
    return trail.map((n) => n.id);
  }, [mounted, projects, path]);

  useEffect(() => {
    if (!mounted) return;
    if (path.length === 0) return;
    if (validPath.length !== path.length) {
      router.replace('/view');
    }
  }, [mounted, validPath, path, router]);

  if (!mounted) return null;

  return (
    <div className={'app dens-' + VIEW_DEFAULTS.density + (VIEW_DEFAULTS.showRing ? '' : ' no-ring')}>
      <div className="readonly-badge" aria-label="Read-only mode">Read-only</div>
      <ProjectsShell
        projects={projects}
        path={validPath}
        readOnly
        view={view}
        variant={VIEW_DEFAULTS.roadmapStyle}
        onNavigate={pushPath}
        onHome={() => pushPath([])}
        onOpenChild={(childId) => pushPath([...validPath, childId])}
        onSetView={setView}
      />
      <ThemeToggle dark={dark} onToggle={toggleTheme} />
    </div>
  );
}

export default ViewApp;
