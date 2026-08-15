import { Message, SkinProject } from './schema';
import { normalizeTwitterHandle, resolveIdentityTarget } from './identity';
import { SiteSkinTheme } from './siteSkin/theme';

/**
 * Has the author done real work in this project yet?
 *
 * §5.2 of the growth plan gives four per-platform definitions of activation and
 * one rule that outranks all of them: **seeded example content does not count
 * until the user edits it.** Both halves live here, as pure functions beside the
 * platform models, so all four platforms answer the question the same way. The
 * alternative — four `if` branches inside `index.tsx` — is four definitions that
 * drift.
 *
 * The §5.2 wording ("materially edits two messages") predates the platform
 * rebuilds, when a message was a line of text. A message that gains a reply, an
 * image collage, a link card, voice, video, or a reaction is plainly authored
 * work too, so the signature below covers every structured field rather than
 * `content` alone.
 *
 * Nothing in this module is sent to analytics. The caller sends only
 * `project.template`, which is one of the four platform ids.
 */

/**
 * Stable JSON: object keys sorted, `undefined` dropped.
 *
 * `{ ...message, content }` preserves the original key order and appends new
 * keys, so two structurally identical messages can serialize differently. Without
 * this, moving a field would read as an edit.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) result[key] = canonical(source[key]);
    }
    return result;
  }
  return value;
}

/**
 * Fields on a message that the author does not write.
 *
 * `id` is excluded because the baseline is keyed by it. `status`/`statusMode`
 * are excluded because they are not an authoring decision: `appendChatMessage`
 * advances an automatic status to 'read' on every earlier outgoing message when
 * a reply arrives. Counting those would score one new message as several, and
 * the chat threshold is two.
 */
const AUTOMATIC_MESSAGE_FIELDS = new Set(['id', 'status', 'statusMode']);

/** A content fingerprint of everything on a message an author can author. */
export function messageSignature(message: Message): string {
  const authored: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(message)) {
    if (!AUTOMATIC_MESSAGE_FIELDS.has(key)) authored[key] = value;
  }
  return JSON.stringify(canonical(authored));
}

export interface ActivationBaseline {
  /** Seeded message signatures, keyed by the stable message id. */
  messages: Record<string, string>;
  /** The seeded Google query, so replacing it reads as authorship. */
  googleQuery: string;
}

/**
 * Record what a project contained the moment it was handed to the author.
 *
 * Capture this from the *migrated* project that reaches React state, not the raw
 * example — `migrateProjectIdentities` stamps `characterId` onto every message,
 * and a baseline taken before that would score the migration as authorship.
 */
export function activationBaseline(project: SkinProject): ActivationBaseline {
  const messages: Record<string, string> = {};
  for (const message of project.messages) messages[message.id] = messageSignature(message);
  return { messages, googleQuery: (project.settings.googleQuery || '').trim() };
}

/** Messages the author created or edited, ignoring anything left as seeded. */
export function authoredMessageCount(project: SkinProject, baseline: ActivationBaseline): number {
  return project.messages.filter(message => baseline.messages[message.id] !== messageSignature(message)).length;
}

/**
 * A Twitter scene with a real account behind it.
 *
 * `migrateProjectIdentities` always supplies a primary account, so a blank
 * project is never missing one: it is named 'User' with no handle, which is the
 * placeholder §5.2 means. A seeded example arrives with a real name already, and
 * that still counts — the authored-post test is what separates a seed the author
 * kept from a seed they never touched.
 */
function hasNonPlaceholderTwitterIdentity(project: SkinProject): boolean {
  const primary = resolveIdentityTarget(project, { kind: 'twitter-primary' });
  const name = primary.name.trim();
  return !!normalizeTwitterHandle(primary.twitterHandle) || (!!name && name !== 'User');
}

/** Has meaningful author work first appeared in this scene project? */
export function isProjectActivated(project: SkinProject, baseline: ActivationBaseline): boolean {
  const authored = authoredMessageCount(project, baseline);
  switch (project.template) {
    case 'ios':
    case 'android':
      return authored >= 2;
    case 'twitter':
      return authored >= 1 && hasNonPlaceholderTwitterIdentity(project);
    case 'google': {
      const query = (project.settings.googleQuery || '').trim();
      if (!query || project.messages.length === 0) return false;
      return query !== baseline.googleQuery || authored >= 1;
    }
    default:
      return false;
  }
}

/**
 * The site skin's equivalent, which §5.2 states as "a template value is changed
 * and previewed". The editor and the preview are the same screen — `SkinPreview`
 * renders beside `ThemeEditor` for the whole session — so a changed value has
 * always been previewed by the time it exists.
 */
export function siteSkinBaseline(theme: SiteSkinTheme): string {
  return JSON.stringify(canonical(theme));
}

export function isSiteSkinActivated(theme: SiteSkinTheme, baseline: string): boolean {
  return siteSkinBaseline(theme) !== baseline;
}

const ACTIVATION_KEY = 'ao3skingen_activated';
const MAX_REMEMBERED = 50;

/**
 * In-memory fallback for a refused or full localStorage. Private-browsing
 * visitors still get one activation per page session rather than none, which is
 * the closest honest approximation of "once per browser-local project".
 */
const activatedThisSession = new Set<string>();

/**
 * Claim the single activation for a key, returning true exactly once.
 *
 * The keys are local project UUIDs and site-skin template ids. Neither is ever
 * sent to analytics — §5.2 is explicit that the UUID exists only to deduplicate
 * local activation.
 */
export function markActivatedOnce(key: string): boolean {
  if (typeof window === 'undefined' || !key) return false;
  if (activatedThisSession.has(key)) return false;
  try {
    const raw = window.localStorage.getItem(ACTIVATION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const seen = Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
    if (seen.includes(key)) {
      activatedThisSession.add(key);
      return false;
    }
    window.localStorage.setItem(ACTIVATION_KEY, JSON.stringify([...seen, key].slice(-MAX_REMEMBERED)));
  } catch {
    // A refused write must never stop the author working. One repeated event on
    // a later visit is a far smaller cost than a thrown render.
  }
  activatedThisSession.add(key);
  return true;
}

/** Test seam: forget this session's claims. */
export function resetActivationSession(): void {
  activatedThisSession.clear();
}
