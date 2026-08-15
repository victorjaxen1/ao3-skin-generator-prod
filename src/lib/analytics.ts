export type OutputType = 'png' | 'hosted_image' | 'work_skin' | 'site_skin';

export type ExportErrorCode =
  | 'IMAGE_UPLOAD_TIMEOUT'
  | 'IMAGE_UPLOAD_PROVIDER_ERROR'
  | 'IMAGE_UPLOAD_RATE_LIMITED'
  | 'IMAGE_TOO_LARGE'
  | 'UNSUPPORTED_IMAGE_TYPE'
  | 'REMOTE_IMAGE_BLOCKED'
  | 'REMOTE_IMAGE_NOT_FOUND'
  | 'REMOTE_IMAGE_TOO_LARGE'
  | 'EXPORT_RENDER_FAILED'
  | 'DOWNLOAD_TRIGGER_FAILED'
  | 'CLIPBOARD_DENIED'
  | 'CSS_VALIDATION_BLOCKED'
  | 'PROJECT_IMPORT_INVALID'
  | 'PROJECT_SCHEMA_UNSUPPORTED'
  | 'PROJECT_IMPORT_TOO_LARGE'
  | 'LOCAL_STORAGE_UNAVAILABLE';

type CountBucket = '0' | '1' | '2-5' | '6-10' | '11+';
type NextStep = 'make_another' | 'build_site_skin' | 'read_guide' | 'back_up_project';

export type AnalyticsEvent =
  | { name: 'tool_viewed'; tool: 'scene_builder' | 'site_skin' }
  | { name: 'template_selected'; templateId: string }
  | { name: 'project_activated'; templateId: string }
  | { name: 'export_started'; outputType: OutputType; templateId: string }
  | { name: 'export_ready'; outputType: OutputType; templateId: string }
  | { name: 'output_copied'; outputType: Exclude<OutputType, 'png'>; part: 'embed' | 'css' | 'html' }
  | { name: 'handoff_completed'; outputType: Exclude<OutputType, 'png'>; templateId: string }
  | { name: 'export_failed'; outputType: OutputType; errorCode: ExportErrorCode }
  | { name: 'fallback_preview_opened'; templateId: string }
  | { name: 'project_backup_exported'; schemaVersion: number }
  | { name: 'project_backup_imported'; schemaVersion: number }
  | { name: 'cast_exported'; characterCountBucket: CountBucket; includesAvatarUrls: boolean }
  | { name: 'cast_imported'; characterCountBucket: CountBucket }
  | { name: 'next_step_shown'; nextStep: NextStep; placement: string }
  | { name: 'product_cta_clicked'; product: 'worldkonstruct' | 'wordfokus'; placement: string }
  | { name: 'donation_clicked'; placement: string };

export type AnalyticsConsent = 'granted' | 'denied';

export const ANALYTICS_CONSENT_KEY = 'ao3skingen_analytics_consent';
export const OPEN_PRIVACY_CHOICES_EVENT = 'ao3skingen:open-privacy-choices';

export function openPrivacyChoices(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OPEN_PRIVACY_CHOICES_EVENT));
}

/**
 * Every id that may reach `template_selected`, and nothing else.
 *
 * `analyticsPayload` rejects the *whole event* on an unknown value, which is
 * correct at a content boundary and is also why a missing id erases the event
 * silently rather than loudly. Five examples shipped without their ids here and
 * recorded nothing for two days.
 *
 * **Adding a starter example means adding its id to this set in the same
 * change.** `analytics.unit.spec.ts` asserts that every example in
 * `examples.ts` and every site-skin template appears below, so the omission now
 * fails a test instead of going quiet in production.
 */
const TEMPLATE_IDS = new Set([
  'ios', 'android', 'twitter', 'google',
  'twitter-character-thread', 'twitter-verified-account', 'twitter-media-image',
  'twitter-quote-post', 'twitter-four-image-post', 'twitter-video-post', 'twitter-long-thread',
  'ios-two-person-chat', 'ios-contact-avatar', 'ios-typing-indicators', 'ios-rich-group-scene',
  'whatsapp-chat', 'whatsapp-profile-picture', 'whatsapp-timestamps-receipts', 'whatsapp-group-chat',
  'google-search-history', 'google-research-montage', 'google-news-articles',
  'moonlit', 'paper', 'lavender', 'crimson', 'forest', 'ocean', 'rose', 'contrast',
  'terminal', 'golden', 'gothic', 'clean', 'academia', 'shoujo', 'neon', 'western',
]);

/** Exported for the drift test only; never widen this at a call site. */
export const ANALYTICS_TEMPLATE_IDS: ReadonlySet<string> = TEMPLATE_IDS;
const OUTPUT_TYPES = new Set<OutputType>(['png', 'hosted_image', 'work_skin', 'site_skin']);
const ERROR_CODES = new Set<ExportErrorCode>([
  'IMAGE_UPLOAD_TIMEOUT', 'IMAGE_UPLOAD_PROVIDER_ERROR', 'IMAGE_UPLOAD_RATE_LIMITED',
  'IMAGE_TOO_LARGE', 'UNSUPPORTED_IMAGE_TYPE', 'REMOTE_IMAGE_BLOCKED',
  'REMOTE_IMAGE_NOT_FOUND', 'REMOTE_IMAGE_TOO_LARGE', 'EXPORT_RENDER_FAILED',
  'DOWNLOAD_TRIGGER_FAILED', 'CLIPBOARD_DENIED', 'CSS_VALIDATION_BLOCKED',
  'PROJECT_IMPORT_INVALID', 'PROJECT_SCHEMA_UNSUPPORTED', 'PROJECT_IMPORT_TOO_LARGE',
  'LOCAL_STORAGE_UNAVAILABLE',
]);
/**
 * Where a product or donation link may legitimately sit.
 *
 * `platform_picker` and `site_skin_gallery` are the Section 11.6 Tier 2
 * surfaces: permanent, non-interrupting entry screens, never the editor. Note
 * that `completion` remains enumerated but should no longer be used for a
 * product link — Section 11.6 withdrew completion-timed commercial cards.
 */
const PLACEMENTS = new Set([
  'completion', 'export_dialog', 'help', 'settings', 'site_skin_export',
  'platform_picker', 'site_skin_gallery',
]);

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: Gtag;
  __AO3SKINGEN_ANALYTICS_READY__?: boolean;
};

export function validMeasurementId(value: string | undefined): string {
  const match = value?.match(/^G-[A-Z0-9]{10}$/i);
  return match ? match[0].toUpperCase() : '';
}

function measurementId(): string {
  return validMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
}

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

export function getAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(ANALYTICS_CONSENT_KEY, value); } catch { /* consent stays session-only */ }
  if (value === 'denied') disableAnalytics();
  else {
    const id = measurementId();
    if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  }
}

function safeReferrer(): string {
  try { return document.referrer ? new URL(document.referrer).origin : ''; } catch { return ''; }
}

export function loadAnalytics(): boolean {
  if (typeof window === 'undefined' || isTestEnvironment()) return false;
  const id = measurementId();
  if (!id || getAnalyticsConsent() !== 'granted') return false;
  const analyticsWindow = window as AnalyticsWindow;
  (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false;
  if (analyticsWindow.__AO3SKINGEN_ANALYTICS_READY__) return true;

  try {
    analyticsWindow.dataLayer = analyticsWindow.dataLayer || [];
    analyticsWindow.gtag = function (...args: unknown[]) {
      analyticsWindow.dataLayer!.push(args);
    };
    analyticsWindow.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    analyticsWindow.gtag('js', new Date());
    analyticsWindow.gtag('config', id, {
      send_page_view: false,
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_referrer: safeReferrer(),
      cookie_flags: 'SameSite=Strict;Secure',
    });
    analyticsWindow.__AO3SKINGEN_ANALYTICS_READY__ = true;

    if (!document.getElementById('ao3skingen-google-analytics')) {
      const script = document.createElement('script');
      script.id = 'ao3skingen-google-analytics';
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    }
    return true;
  } catch {
    return false;
  }
}

export function disableAnalytics(): void {
  if (typeof window === 'undefined') return;
  const id = measurementId();
  if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true;
  try {
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0]?.trim();
      if (!name || (name !== '_ga' && !name.startsWith('_ga_'))) continue;
      for (const domain of ['', window.location.hostname, '.wordfokus.com']) {
        document.cookie = `${name}=; Max-Age=0; path=/;${domain ? ` domain=${domain};` : ''} SameSite=Strict; Secure`;
      }
    }
  } catch { /* cookie cleanup is best-effort */ }
}

function validTemplate(value: unknown): value is string {
  return typeof value === 'string' && TEMPLATE_IDS.has(value);
}

/** Builds a fixed-key payload or rejects the entire event. */
export function analyticsPayload(event: AnalyticsEvent): Record<string, string | number | boolean> | null {
  const value = event as AnalyticsEvent & Record<string, unknown>;
  switch (event.name) {
    case 'tool_viewed':
      return value.tool === 'scene_builder' || value.tool === 'site_skin' ? { tool: value.tool } : null;
    case 'template_selected':
    case 'project_activated':
      return validTemplate(value.templateId) ? { template_id: value.templateId } : null;
    case 'export_started':
    case 'export_ready':
      return OUTPUT_TYPES.has(value.outputType as OutputType) && validTemplate(value.templateId)
        ? { output_type: value.outputType as string, template_id: value.templateId }
        : null;
    case 'handoff_completed':
      return value.outputType !== 'png' && OUTPUT_TYPES.has(value.outputType as OutputType) && validTemplate(value.templateId)
        ? { output_type: value.outputType as string, template_id: value.templateId }
        : null;
    case 'output_copied':
      return value.outputType !== 'png' && OUTPUT_TYPES.has(value.outputType as OutputType)
        && (value.part === 'embed' || value.part === 'css' || value.part === 'html')
        ? { output_type: value.outputType as string, part: value.part }
        : null;
    case 'export_failed':
      return OUTPUT_TYPES.has(value.outputType as OutputType) && ERROR_CODES.has(value.errorCode as ExportErrorCode)
        ? { output_type: value.outputType as string, error_code: value.errorCode as string }
        : null;
    case 'fallback_preview_opened':
      return validTemplate(value.templateId) ? { template_id: value.templateId } : null;
    case 'project_backup_exported':
    case 'project_backup_imported':
      return Number.isInteger(value.schemaVersion) && Number(value.schemaVersion) > 0
        ? { schema_version: Number(value.schemaVersion) }
        : null;
    case 'cast_exported':
      return ['0', '1', '2-5', '6-10', '11+'].includes(value.characterCountBucket as string)
        && typeof value.includesAvatarUrls === 'boolean'
        ? { character_count_bucket: value.characterCountBucket as string, includes_avatar_urls: value.includesAvatarUrls }
        : null;
    case 'cast_imported':
      return ['0', '1', '2-5', '6-10', '11+'].includes(value.characterCountBucket as string)
        ? { character_count_bucket: value.characterCountBucket as string }
        : null;
    case 'next_step_shown':
      return ['make_another', 'build_site_skin', 'read_guide', 'back_up_project'].includes(value.nextStep as string)
        && PLACEMENTS.has(value.placement as string)
        ? { next_step: value.nextStep as string, placement: value.placement as string }
        : null;
    case 'product_cta_clicked':
      return (value.product === 'worldkonstruct' || value.product === 'wordfokus') && PLACEMENTS.has(value.placement as string)
        ? { product: value.product, placement: value.placement as string }
        : null;
    case 'donation_clicked':
      return PLACEMENTS.has(value.placement as string) ? { placement: value.placement as string } : null;
    default:
      return null;
  }
}

export function trackAnalytics(event: AnalyticsEvent): boolean {
  if (typeof window === 'undefined' || isTestEnvironment() || getAnalyticsConsent() !== 'granted') return false;
  const analyticsWindow = window as AnalyticsWindow;
  if (!analyticsWindow.__AO3SKINGEN_ANALYTICS_READY__ || typeof analyticsWindow.gtag !== 'function') return false;
  const payload = analyticsPayload(event);
  if (!payload) return false;
  try {
    analyticsWindow.gtag('event', event.name, payload);
    return true;
  } catch {
    return false;
  }
}

export function trackPageView(path: string): boolean {
  if (typeof window === 'undefined' || !path.startsWith('/')) return false;
  const pathname = path.split(/[?#]/, 1)[0] || '/';
  const analyticsWindow = window as AnalyticsWindow;
  if (getAnalyticsConsent() !== 'granted' || !analyticsWindow.__AO3SKINGEN_ANALYTICS_READY__ || typeof analyticsWindow.gtag !== 'function') return false;
  try {
    analyticsWindow.gtag('event', 'page_view', {
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
    });
    return true;
  } catch {
    return false;
  }
}

export function mapUploadErrorCode(code: string): ExportErrorCode {
  if (code === 'PROVIDER_TIMEOUT') return 'IMAGE_UPLOAD_TIMEOUT';
  if (code === 'RATE_LIMITED') return 'IMAGE_UPLOAD_RATE_LIMITED';
  if (code === 'TOO_LARGE') return 'IMAGE_TOO_LARGE';
  if (code === 'INVALID_TYPE' || code === 'TYPE_MISMATCH') return 'UNSUPPORTED_IMAGE_TYPE';
  return 'IMAGE_UPLOAD_PROVIDER_ERROR';
}
