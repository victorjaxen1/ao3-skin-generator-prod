/**
 * Pro Features Module
 * Manages premium feature access and licensing
 * 
 * Pro Features Include:
 * - Watermark-free exports
 * - High-resolution exports (2x, 4x scale)
 * - Priority support (future)
 * - Cloud sync (future)
 */

const PRO_LICENSE_KEY = 'ao3_pro_license';
const PRO_ACTIVATED_KEY = 'ao3_pro_activated';

export interface ProStatus {
  isPro: boolean;
  licenseKey?: string;
  activatedAt?: string;
  expiresAt?: string; // null = lifetime
}

export interface ProFeatures {
  watermarkFree: boolean;
  highResExport: boolean;
  maxExportScale: number; // 1 = standard, 2 = 2x, 4 = 4x
}

/**
 * Check if user has Pro access
 */
export function getProStatus(): ProStatus {
  try {
    if (typeof window === 'undefined') {
      return { isPro: false };
    }
    
    const activated = localStorage.getItem(PRO_ACTIVATED_KEY);
    const licenseKey = localStorage.getItem(PRO_LICENSE_KEY);
    
    if (activated === 'true' && licenseKey) {
      // In a real implementation, you'd validate the license with your backend
      return {
        isPro: true,
        licenseKey,
        activatedAt: localStorage.getItem('ao3_pro_activated_at') || undefined,
        expiresAt: undefined, // Lifetime license
      };
    }
    
    return { isPro: false };
  } catch {
    return { isPro: false };
  }
}

/**
 * Get available features based on Pro status
 */
export function getProFeatures(): ProFeatures {
  const status = getProStatus();
  
  if (status.isPro) {
    return {
      watermarkFree: true,
      highResExport: true,
      maxExportScale: 4,
    };
  }
  
  return {
    watermarkFree: false,
    highResExport: false,
    maxExportScale: 2, // Free tier gets standard 2x
  };
}

/**
 * Activate Pro with a license key
 * In production, this should validate against your backend
 */
export function activatePro(licenseKey: string): { success: boolean; message: string } {
  try {
    // Simple validation - in production, validate against Gumroad/Stripe API
    if (!licenseKey || licenseKey.length < 8) {
      return { success: false, message: 'Invalid license key format' };
    }
    
    // For MVP: Accept any key that starts with "AO3PRO-"
    // In production: Validate against payment provider
    if (!licenseKey.startsWith('AO3PRO-')) {
      return { success: false, message: 'Invalid license key. Keys start with AO3PRO-' };
    }
    
    localStorage.setItem(PRO_LICENSE_KEY, licenseKey);
    localStorage.setItem(PRO_ACTIVATED_KEY, 'true');
    localStorage.setItem('ao3_pro_activated_at', new Date().toISOString());
    
    return { success: true, message: 'Pro activated successfully! Enjoy watermark-free exports.' };
  } catch (error) {
    return { success: false, message: 'Failed to activate. Please try again.' };
  }
}

/**
 * Deactivate Pro (for testing or account management)
 */
export function deactivatePro(): void {
  try {
    localStorage.removeItem(PRO_LICENSE_KEY);
    localStorage.removeItem(PRO_ACTIVATED_KEY);
    localStorage.removeItem('ao3_pro_activated_at');
  } catch {
    // Silent fail
  }
}

/**
 * Check if a specific feature is available
 */
export function hasFeature(feature: keyof ProFeatures): boolean {
  const features = getProFeatures();
  return !!features[feature];
}

/**
 * Get the purchase URL for Pro upgrade
 */
export function getProPurchaseUrl(): string {
  // Replace with your actual Gumroad/Stripe product URL
  return 'https://gumroad.com/l/ao3skingen-pro';
}

/**
 * Format price for display
 */
export function getProPrice(): { amount: number; currency: string; formatted: string } {
  return {
    amount: 5,
    currency: 'USD',
    formatted: '$5',
  };
}
