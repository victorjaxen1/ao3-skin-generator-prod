import type { ProductId } from '../components/MoreTools';

export const PRODUCT_PROMO_STORAGE_KEY = 'ao3skingen_product_promo_v1';
export const CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED = false;

export interface ProductPromoStateV1 {
  version: 1;
  sceneHandoffCount: number;
  activeDays: string[];
  lastContextualShownAt: Partial<Record<ProductId, string>>;
  suppressedUntil: Partial<Record<ProductId, string>>;
  clickedAt: Partial<Record<ProductId, string>>;
}

const PRODUCTS: readonly ProductId[] = ['wordfokus', 'worldkonstruct'];
const MAX_STORED_LENGTH = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

let memoryState: ProductPromoStateV1 = emptyProductPromoState();
let storageUnavailable = false;
let corruptStateSeenThisSession = false;
let handoffRecordedThisSession = false;
let contextualShownThisSession = false;
const clickedThisSession = new Set<ProductId>();

export function emptyProductPromoState(): ProductPromoStateV1 {
  return {
    version: 1,
    sceneHandoffCount: 0,
    activeDays: [],
    lastContextualShownAt: {},
    suppressedUntil: {},
    clickedAt: {},
  };
}

function cloneState(state: ProductPromoStateV1): ProductPromoStateV1 {
  return {
    version: 1,
    sceneHandoffCount: state.sceneHandoffCount,
    activeDays: [...state.activeDays],
    lastContextualShownAt: { ...state.lastContextualShownAt },
    suppressedUntil: { ...state.suppressedUntil },
    clickedAt: { ...state.clickedAt },
  };
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function sanitizeTimestampRecord(value: unknown): Partial<Record<ProductId, string>> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (Object.keys(source).some(key => !PRODUCTS.includes(key as ProductId))) return null;
  const result: Partial<Record<ProductId, string>> = {};
  for (const product of PRODUCTS) {
    if (source[product] === undefined) continue;
    if (!isIsoTimestamp(source[product])) return null;
    result[product] = source[product] as string;
  }
  return result;
}

function sanitizeState(value: unknown): ProductPromoStateV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (source.version !== 1) return null;
  if (!Number.isInteger(source.sceneHandoffCount)
    || Number(source.sceneHandoffCount) < 0
    || Number(source.sceneHandoffCount) > 1000) return null;
  if (!Array.isArray(source.activeDays) || source.activeDays.length > 10) return null;
  if (!source.activeDays.every(isDay) || new Set(source.activeDays).size !== source.activeDays.length) return null;

  const lastContextualShownAt = sanitizeTimestampRecord(source.lastContextualShownAt);
  const suppressedUntil = sanitizeTimestampRecord(source.suppressedUntil);
  const clickedAt = sanitizeTimestampRecord(source.clickedAt);
  if (!lastContextualShownAt || !suppressedUntil || !clickedAt) return null;

  return {
    version: 1,
    sceneHandoffCount: Number(source.sceneHandoffCount),
    activeDays: [...source.activeDays].sort().slice(-10),
    lastContextualShownAt,
    suppressedUntil,
    clickedAt,
  };
}

function persist(state: ProductPromoStateV1): void {
  memoryState = cloneState(state);
  if (storageUnavailable || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRODUCT_PROMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    storageUnavailable = true;
  }
}

export function readProductPromoState(): ProductPromoStateV1 {
  if (storageUnavailable || typeof window === 'undefined') return cloneState(memoryState);
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PRODUCT_PROMO_STORAGE_KEY);
  } catch {
    storageUnavailable = true;
    return cloneState(memoryState);
  }
  if (!raw) {
    memoryState = emptyProductPromoState();
    return cloneState(memoryState);
  }

  let state: ProductPromoStateV1 | null = null;
  if (raw.length <= MAX_STORED_LENGTH) {
    try { state = sanitizeState(JSON.parse(raw)); } catch { /* invalid JSON resets below */ }
  }
  if (state) {
    memoryState = state;
    return cloneState(state);
  }
  const empty = emptyProductPromoState();
  corruptStateSeenThisSession = true;
  persist(empty);
  return cloneState(empty);
}

function localDay(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recordSceneHandoff(now = new Date()): ProductPromoStateV1 {
  const state = readProductPromoState();
  if (handoffRecordedThisSession) return state;
  handoffRecordedThisSession = true;
  state.sceneHandoffCount = Math.min(1000, state.sceneHandoffCount + 1);
  const day = localDay(now);
  state.activeDays = [...new Set([...state.activeDays, day])].sort().slice(-10);
  persist(state);
  return cloneState(state);
}

function isSuppressed(state: ProductPromoStateV1, product: ProductId, now: Date): boolean {
  const until = state.suppressedUntil[product];
  return Boolean(until && new Date(until).getTime() > now.getTime());
}

function wasShownRecently(state: ProductPromoStateV1, product: ProductId, now: Date): boolean {
  const shownAt = state.lastContextualShownAt[product];
  if (!shownAt) return false;
  const elapsed = now.getTime() - new Date(shownAt).getTime();
  return elapsed < 14 * DAY_MS;
}

function productEligible(state: ProductPromoStateV1, product: ProductId, now: Date): boolean {
  return !isSuppressed(state, product, now)
    && !wasShownRecently(state, product, now)
    && !clickedThisSession.has(product);
}

/** Release 2 selection logic, kept independently testable while its build switch is off. */
export function eligibleContextualProductWhenEnabled(now = new Date()): ProductId | null {
  if (contextualShownThisSession) return null;
  const state = readProductPromoState();
  if (corruptStateSeenThisSession) return null;
  const isReturning = state.activeDays.length >= 2 && state.sceneHandoffCount >= 2;
  if (!isReturning) return productEligible(state, 'wordfokus', now) ? 'wordfokus' : null;

  if (!isSuppressed(state, 'worldkonstruct', now)) {
    return productEligible(state, 'worldkonstruct', now) ? 'worldkonstruct' : null;
  }
  return productEligible(state, 'wordfokus', now) ? 'wordfokus' : null;
}

export function eligibleContextualProduct(now = new Date()): ProductId | null {
  if (!CONTEXTUAL_PRODUCT_PROMOTIONS_ENABLED) return null;
  return eligibleContextualProductWhenEnabled(now);
}

export function markContextualShown(product: ProductId, now = new Date()): void {
  const state = readProductPromoState();
  state.lastContextualShownAt[product] = now.toISOString();
  contextualShownThisSession = true;
  persist(state);
}

function futureTimestamp(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString();
}

export function suppressProduct(product: ProductId, now = new Date()): void {
  const state = readProductPromoState();
  state.suppressedUntil[product] = futureTimestamp(now, 180);
  persist(state);
}

export function recordProductClick(product: ProductId, now = new Date()): void {
  const state = readProductPromoState();
  state.clickedAt[product] = now.toISOString();
  state.suppressedUntil[product] = futureTimestamp(now, 30);
  clickedThisSession.add(product);
  persist(state);
}

/** Test seam: reset module-local session guards and the storage fallback. */
export function resetProductPromotionSession(): void {
  memoryState = emptyProductPromoState();
  storageUnavailable = false;
  corruptStateSeenThisSession = false;
  handoffRecordedThisSession = false;
  contextualShownThisSession = false;
  clickedThisSession.clear();
}
