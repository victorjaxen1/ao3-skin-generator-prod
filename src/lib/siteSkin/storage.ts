import { SiteSkinTheme, validateTheme } from './theme';
import { DEFAULT_TEMPLATE, cloneTheme } from './templates';

/**
 * Persistence for the site-skin editor.
 *
 * Its own key, deliberately. `ao3SkinProject` belongs to the conversation
 * generator and the two products share no fields; one storage object serving
 * both is exactly the coupling the platform audit just finished removing.
 *
 * The failure discipline is copied from `../storage.ts`: a refused save means
 * the user's work is gone on reload, and a console warning nobody reads is not
 * a way to tell someone that. Callers get a result and surface it.
 */

const KEY = 'ao3SiteSkinTheme';

/** A theme is a few hundred bytes. Anything near this is corrupt or hostile. */
const MAX_STORAGE_SIZE = 20000;

export interface PersistResult {
  ok: boolean;
  /** Present only when ok is false. Safe to show to the user as-is. */
  message?: string;
  reason?: 'too-large' | 'unavailable';
}

/** Whether a theme was actually saved by a previous session. */
export function hasStoredTheme(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadStoredTheme(): SiteSkinTheme {
  const fallback = cloneTheme(DEFAULT_TEMPLATE);
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw || raw.length > MAX_STORAGE_SIZE) return fallback;
    return validateTheme(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function persistTheme(theme: SiteSkinTheme): PersistResult {
  let json: string;
  try {
    json = JSON.stringify(theme);
  } catch {
    return { ok: false, reason: 'unavailable', message: "This theme can't be saved." };
  }

  try {
    localStorage.setItem(KEY, json);
    return { ok: true };
  } catch {
    // Quota exceeded, or storage blocked (private browsing, cookies off).
    return {
      ok: false,
      reason: 'unavailable',
      message:
        "Your browser wouldn't let this be saved, so it won't be here when you come back. Copy your skin before you close the tab.",
    };
  }
}

export function clearStoredTheme(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing useful to do */
  }
}
