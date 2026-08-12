import { SkinProject } from './schema';

const KEY = 'ao3skingen_last_project_backup';

export function markProjectBackedUp(project: SkinProject): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify({ projectId: project.id, fingerprint: projectFingerprint(project), at: new Date().toISOString() })); } catch { /* best effort */ }
}

function projectFingerprint(project: SkinProject): string {
  const text = JSON.stringify(project);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function hasProjectBackup(project: SkinProject): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    return raw?.projectId === project.id
      && raw?.fingerprint === projectFingerprint(project)
      && typeof raw.at === 'string';
  } catch {
    return false;
  }
}
