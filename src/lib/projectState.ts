import { SkinProject } from './schema';

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const next = (value as Record<string, unknown>)[key];
        if (next !== undefined) result[key] = normalizeJsonValue(next);
        return result;
      }, {});
  }
  return value;
}

/** Stable serialization of every persisted project field used for replacement protection. */
export function projectStateSnapshot(project: SkinProject): string {
  return JSON.stringify(normalizeJsonValue(project));
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.matches('input, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
    || Boolean(target.closest('[contenteditable]:not([contenteditable="false"]), [role="textbox"]'));
}
