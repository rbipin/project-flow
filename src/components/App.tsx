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
import { ProjectsShell } from './ProjectsShell';
import { NewProjectModal } from './NewProjectModal';
import { ThemeToggle } from './ThemeToggle';
import { subscribeToAuthState, signOut } from '@/lib/firebase';
import { setActiveUid, syncOnLoad, syncOnReconnect } from '@/lib/sync';
import { SignInScreen } from './SignInScreen';

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
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);
  const hasLoaded = useRef(false);
  const skipNextSave = useRef(false);
  const [authState, setAuthState] = useState<'loading' | 'signed-out' | 'signed-in'>('loading');
  const [uid, setUid] = useState<string | null>(null);

  // Runs before the load effect on mount — hasLoaded is still false, so the write is skipped.
  // After load sets hasLoaded=true, subsequent project changes will trigger a save.
  // skipNextSave is set before setProjects(remoteProjects) to avoid a redundant Firestore write
  // when syncOnLoad pulls remote data that is already persisted to localStorage.
  useEffect(() => {
    if (hasLoaded.current && !skipNextSave.current) saveProjects(projects);
    skipNextSave.current = false;
  }, [projects]);

  useEffect(() => {
    return subscribeToAuthState((user) => {
      if (user) {
        setUid(user.uid);
        setActiveUid(user.uid);
        setAuthState('signed-in');
      } else {
        setUid(null);
        setActiveUid(null);
        setAuthState('signed-out');
      }
    });
  }, []);

  useEffect(() => {
    if (authState !== 'signed-in' || !uid) return;

    try {
      const stored = localStorage.getItem('project-tracker:view') as 'grid' | 'list';
      if (stored) setDashView(stored);
    } catch (_) {}
    try {
      setDark(localStorage.getItem('project-tracker:theme') === 'dark');
    } catch (_) {}

    skipNextSave.current = true;
    setProjects(loadProjects());
    hasLoaded.current = true;
    setMounted(true);

    syncOnLoad(uid).then((remoteProjects) => {
      if (remoteProjects) {
        skipNextSave.current = true;
        setProjects(remoteProjects);
      }
    });

    const cleanup = syncOnReconnect(uid);
    return cleanup;
  }, [authState, uid]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('project-tracker:theme', dark ? 'dark' : 'light'); } catch (_) {}
  }, [dark]);

  const toggleTheme = () => {
    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    setTimeout(() => root.classList.remove('theme-transitioning'), 320);
    setDark((d) => !d);
  };

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

  if (authState === 'loading') return null;
  if (authState === 'signed-out') return <SignInScreen />;
  if (!mounted) return null;

  return (
    <div className={'app dens-' + t.density + (t.showRing ? '' : ' no-ring')}>
      <ProjectsShell
        projects={projects}
        path={curPath}
        readOnly={false}
        view={dashView}
        variant={variant}
        onNavigate={navigate}
        onHome={home}
        onOpenChild={openChild}
        onSetView={setView}
        onNewProject={() => setShowNew(true)}
        onUpdateNode={updateNode}
        onDeleteNode={deleteNode}
      />
      {showNew && (
        <NewProjectModal
          projects={projects}
          onClose={() => setShowNew(false)}
          onCreate={createProject}
        />
      )}
      <ThemeToggle dark={dark} onToggle={toggleTheme} />
      {process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH !== 'true' && (
        <button
          className="btn ghost sm"
          onClick={() => signOut()}
          style={{ position: 'fixed', bottom: 14, left: 14, zIndex: 40, fontSize: 12, opacity: 0.6 }}
        >
          Sign out
        </button>
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
