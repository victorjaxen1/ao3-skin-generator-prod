/**
 * Smart Donation Prompt Strategy
 * 
 * Shows Ko-fi/WordFokus prompts at optimal times to maximize conversions
 * without annoying users. Based on UX best practices for donation requests.
 */

const STORAGE_KEY = 'ao3_donation_tracking';

interface DonationTracking {
  totalExports: number;           // Total times user exported code/image
  lastPromptDate: string | null;  // Last time we showed donation modal
  hasDismissedForever: boolean;   // User clicked "Don't show again"
  lastDonationClick: string | null; // Last time user clicked Ko-fi link
  installDate: string;            // When user first used the app
}

/**
 * Load tracking data from localStorage
 */
function loadTracking(): DonationTracking {
  if (typeof window === 'undefined') {
    return getDefaultTracking();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultTracking();
    
    const parsed = JSON.parse(stored);
    return {
      totalExports: typeof parsed.totalExports === 'number' ? parsed.totalExports : 0,
      lastPromptDate: typeof parsed.lastPromptDate === 'string' ? parsed.lastPromptDate : null,
      hasDismissedForever: Boolean(parsed.hasDismissedForever),
      lastDonationClick: typeof parsed.lastDonationClick === 'string' ? parsed.lastDonationClick : null,
      installDate: typeof parsed.installDate === 'string' ? parsed.installDate : new Date().toISOString(),
    };
  } catch {
    return getDefaultTracking();
  }
}

/**
 * Save tracking data to localStorage
 */
function saveTracking(data: DonationTracking): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Could not save donation tracking:', err);
  }
}

/**
 * Get default tracking object
 */
function getDefaultTracking(): DonationTracking {
  return {
    totalExports: 0,
    lastPromptDate: null,
    hasDismissedForever: false,
    lastDonationClick: null,
    installDate: new Date().toISOString(),
  };
}

/**
 * Calculate days since a date string
 */
function daysSince(dateString: string | null): number {
  if (!dateString) return Infinity;
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * Determine if we should show donation modal
 * 
 * Strategy:
 * - Never show if user dismissed forever
 * - Never show if they donated in last 90 days (assume they donated)
 * - Show after 3rd export (user is getting value)
 * - Show after every 10 exports thereafter
 * - Wait at least 7 days between prompts (avoid spam)
 * - Special: Show once at 1st export if 30+ days since install (returning user)
 */
export function shouldShowDonationModal(): boolean {
  const tracking = loadTracking();

  // Never show if user permanently dismissed
  if (tracking.hasDismissedForever) {
    return false;
  }

  // Never show if user clicked donation link recently (90 days)
  if (tracking.lastDonationClick && daysSince(tracking.lastDonationClick) < 90) {
    return false;
  }

  // Wait at least 7 days between prompts
  if (tracking.lastPromptDate && daysSince(tracking.lastPromptDate) < 7) {
    return false;
  }

  // Returning user prompt: 1st export after 30 days of install
  const daysSinceInstall = daysSince(tracking.installDate);
  if (tracking.totalExports === 0 && daysSinceInstall >= 30) {
    return true;
  }

  // First milestone: 3rd export (user is engaged)
  if (tracking.totalExports === 2) {
    return true;
  }

  // Ongoing: Every 10 exports (lighter touch)
  if (tracking.totalExports > 2 && tracking.totalExports % 10 === 0) {
    return true;
  }

  return false;
}

/**
 * Record that user performed an export action
 * Returns true if donation modal should be shown
 */
export function recordExport(): boolean {
  const tracking = loadTracking();
  tracking.totalExports += 1;
  saveTracking(tracking);
  
  return shouldShowDonationModal();
}

/**
 * Record that donation modal was shown
 */
export function recordPromptShown(): void {
  const tracking = loadTracking();
  tracking.lastPromptDate = new Date().toISOString();
  saveTracking(tracking);
}

/**
 * Record that user clicked Ko-fi link
 */
export function recordDonationClick(): void {
  const tracking = loadTracking();
  tracking.lastDonationClick = new Date().toISOString();
  saveTracking(tracking);
}

/**
 * Record that user dismissed prompt forever
 */
export function recordDismissForever(): void {
  const tracking = loadTracking();
  tracking.hasDismissedForever = true;
  saveTracking(tracking);
}

/**
 * Get stats for debugging
 */
export function getDonationStats(): DonationTracking {
  return loadTracking();
}

/**
 * Reset all tracking (for testing)
 */
export function resetDonationTracking(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
