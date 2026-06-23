import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { ProjectNode } from './types';
import { STORAGE_KEY } from './data';

let activeUid: string | null = null;
export function setActiveUid(uid: string | null): void { activeUid = uid; }
export function getActiveUid(): string | null { return activeUid; }

type SyncDoc = { projects: ProjectNode[]; lastModified: string };

function docRef(uid: string) {
  return doc(db, 'users', uid, 'data', 'projects');
}

export async function pushToFirestore(
  uid: string,
  projects: ProjectNode[],
  lastModified: string,
): Promise<void> {
  try {
    await setDoc(docRef(uid), { projects, lastModified });
  } catch (e) {
    console.error('[sync] push failed', e);
  }
}

export async function pullFromFirestore(uid: string): Promise<SyncDoc | null> {
  try {
    const snap = await getDoc(docRef(uid));
    if (!snap.exists()) return null;
    return snap.data() as SyncDoc;
  } catch (e) {
    console.error('[sync] pull failed', e);
    return null;
  }
}

function readLocalRaw(): { projects: ProjectNode[]; lastModified: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { projects: parsed, lastModified: '1970-01-01T00:00:00.000Z' };
    }
    return { projects: parsed.projects ?? [], lastModified: parsed.lastModified ?? '1970-01-01T00:00:00.000Z' };
  } catch (_) {
    return null;
  }
}

export async function syncOnLoad(uid: string): Promise<ProjectNode[] | null> {
  const remote = await pullFromFirestore(uid);

  if (!remote) {
    // No remote doc — bootstrap Firestore from current local state
    const local = readLocalRaw();
    if (local) {
      pushToFirestore(uid, local.projects, local.lastModified);
    }
    return null;
  }

  const local = readLocalRaw();
  const localTs = local?.lastModified ?? '1970-01-01T00:00:00.000Z';
  if (remote.lastModified > localTs) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ projects: remote.projects, lastModified: remote.lastModified }),
      );
    } catch (_) {}
    return remote.projects;
  }

  return null;
}

export async function fetchOwnerProjects(): Promise<ProjectNode[] | null> {
  const ownerUid = process.env.NEXT_PUBLIC_FIREBASE_OWNER_UID;
  if (!ownerUid) return null;
  const result = await pullFromFirestore(ownerUid);
  return result?.projects ?? null;
}

export function syncOnReconnect(uid: string): () => void {
  const handler = () => {
    const local = readLocalRaw();
    if (!local) return;
    pushToFirestore(uid, local.projects, local.lastModified);
  };
  window.addEventListener('online', handler);
  return () => window.removeEventListener('online', handler);
}
