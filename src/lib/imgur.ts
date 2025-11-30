// Cloudinary unsigned upload (no API key needed for uploads!)
// Uses a preset that allows anonymous uploads with AWS Rekognition moderation

// Custom error types for better error handling
const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG === 'true' || process.env.NODE_ENV !== 'production';
const debugLog = (...args: any[]) => { if (DEBUG_LOGS) { try { console.log(...args); } catch {} } };
const debugWarn = (...args: any[]) => { if (DEBUG_LOGS) { try { console.warn(...args); } catch {} } };
export class ImageUploadError extends Error {
  constructor(
    message: string,
    public code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'MODERATION_REJECTED' | 'NETWORK_ERROR' | 'UNKNOWN' | 'FILE_SIZE_LIMIT' | 'RATE_LIMIT',
    public userMessage: string
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

// File validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

// Client-side image optimization to reduce Cloudinary bandwidth usage
async function optimizeImageBeforeUpload(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    img.onload = () => {
      try {
        // Calculate optimal dimensions (max 800px for avatars/profile pics)
        const MAX_DIMENSION = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_DIMENSION;
            width = MAX_DIMENSION;
          } else {
            width = (width / height) * MAX_DIMENSION;
            height = MAX_DIMENSION;
          }
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw resized image
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to WebP if supported (better compression), otherwise JPEG
        const mimeType = 'image/webp';
        const quality = 0.85; // 85% quality for good balance
        
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to optimize image'));
              return;
            }
            
            // Create new File object with optimized image
            const optimizedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
              type: mimeType,
              lastModified: Date.now(),
            });
            
            // Only use optimized version if it's actually smaller
            if (optimizedFile.size < file.size) {
              debugLog(`Image optimized: ${(file.size / 1024).toFixed(1)}KB → ${(optimizedFile.size / 1024).toFixed(1)}KB`);
              resolve(optimizedFile);
            } else {
              debugLog('Original file is smaller, using original');
              resolve(file);
            }
          },
          mimeType,
          quality
        );
      } catch (err) {
        debugWarn('Image optimization failed, using original:', err);
        resolve(file); // Fallback to original file
      }
    };
    
    img.onerror = () => {
      debugWarn('Could not load image for optimization, using original');
      resolve(file); // Fallback to original file
    };
    
    // Load image from file
    img.src = URL.createObjectURL(file);
  });
}

// Simple in-memory cache for uploaded images (avoid re-uploading same image)
const uploadCache = new Map<string, string>();

// Rate limiting for unsigned uploads (Cloudinary limits ~10-20 uploads/min per IP)
let lastUploadTime = 0;
const MIN_UPLOAD_INTERVAL_MS = 2000; // 2 seconds between uploads = max 30/minute (safe buffer)

// Load cache from localStorage on initialization
if (typeof window !== 'undefined') {
  try {
    const storedCache = localStorage.getItem('imageUploadCache');
    if (storedCache) {
      const parsed = JSON.parse(storedCache);
      Object.entries(parsed).forEach(([key, value]) => {
        uploadCache.set(key, value as string);
      });
      debugLog(`Loaded ${uploadCache.size} cached image URLs from storage`);
    }
  } catch (err) {
    debugWarn('Could not load image cache from localStorage:', err);
  }
}

// Save cache to localStorage
function saveCache() {
  if (typeof window !== 'undefined') {
    try {
      const cacheObj = Object.fromEntries(uploadCache);
      localStorage.setItem('imageUploadCache', JSON.stringify(cacheObj));
    } catch (err) {
      debugWarn('Could not save image cache to localStorage:', err);
    }
  }
}

/**
 * Generate a content-based cache key using SHA-256 hash.
 * This prevents cache collisions between different files with same metadata.
 */
async function getCacheKey(file: File): Promise<string> {
  try {
    // Read file content and generate SHA-256 hash
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (err) {
    // Fallback to metadata-based key if hashing fails (shouldn't happen in modern browsers)
    debugWarn('Content hashing failed, using metadata fallback:', err);
    return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
  }
}

// Retry configuration for rate-limited uploads
const MAX_RETRIES = 2; // Will try up to 3 times total (initial + 2 retries)
const RETRY_BASE_DELAY = 5000; // Start with 5 second delay (increased for stricter rate limits)

async function uploadImageWithRetry(file: File, retryCount = 0): Promise<string> {
  // Check cache first to avoid duplicate uploads
  const cacheKey = await getCacheKey(file);
  const cachedUrl = uploadCache.get(cacheKey);
  if (cachedUrl) {
    debugLog('Using cached image URL');
    // Validate cached URL to guard against stale/deleted assets (Cloudinary may return 404)
    const alive = await urlExists(cachedUrl);
    if (!alive) {
      debugWarn('Cached image URL is stale (not reachable). Purging cache entry and re-uploading.');
      uploadCache.delete(cacheKey);
      saveCache();
    } else {
      return cachedUrl;
    }
  }
  
  // Enforce rate limiting for unsigned uploads (Cloudinary protection)
  const now = Date.now();
  const timeSinceLastUpload = now - lastUploadTime;
  if (timeSinceLastUpload < MIN_UPLOAD_INTERVAL_MS) {
    const waitTime = MIN_UPLOAD_INTERVAL_MS - timeSinceLastUpload;
    debugLog(`Rate limiting: waiting ${waitTime}ms before upload`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  // Optimize image before upload (resize + compress)
  const optimizedFile = await optimizeImageBeforeUpload(file);
  
  // Validate file size (after optimization)
  if (optimizedFile.size > MAX_FILE_SIZE) {
    throw new ImageUploadError(
      `File size ${optimizedFile.size} exceeds maximum of ${MAX_FILE_SIZE}`,
      'FILE_TOO_LARGE',
      'Image is too large. Please use an image smaller than 10MB.'
    );
  }
  
  // Validate file format
  if (!ALLOWED_FORMATS.includes(optimizedFile.type)) {
    throw new ImageUploadError(
      `File type ${optimizedFile.type} is not allowed`,
      'INVALID_FORMAT',
      'Invalid image format. Please use JPG, PNG, GIF, or WebP.'
    );
  }
  
  // Cloudinary configuration
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'docs_upload_example_us_preset';
  
  const form = new FormData();
  form.append('file', optimizedFile);
  form.append('upload_preset', uploadPreset);
  
  // Add Cloudinary transformation parameters for additional optimization
  form.append('quality', 'auto:good'); // Automatic quality optimization
  form.append('fetch_format', 'auto'); // Automatic format selection (WebP for supported browsers)
  
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form
    });
    
    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch {
        errorData = { error: { message: await res.text() } };
      }
      
      const errorMessage = errorData?.error?.message || 'Unknown error';
      
      // Handle specific Cloudinary errors
      if (res.status === 400) {
        // Check for moderation rejection
        if (errorMessage.toLowerCase().includes('moderation')) {
          throw new ImageUploadError(
            `Moderation check failed: ${errorMessage}`,
            'MODERATION_REJECTED',
            'This image was flagged by our content moderation system. Please use appropriate images only.'
          );
        }
        
        // Check for file size limit
        if (errorMessage.toLowerCase().includes('file size')) {
          throw new ImageUploadError(
            errorMessage,
            'FILE_SIZE_LIMIT',
            'Image file is too large. Please use an image smaller than 10MB.'
          );
        }
        
        throw new ImageUploadError(
          errorMessage,
          'INVALID_FORMAT',
          'Invalid image. Please check the file format and try again.'
        );
      }
      
      if (res.status === 413) {
        throw new ImageUploadError(
          'Payload too large',
          'FILE_TOO_LARGE',
          'Image is too large. Please use a smaller file.'
        );
      }
      
      if (res.status === 420) {
        // Check for Retry-After header
        const retryAfter = res.headers.get('Retry-After');
        const retryDelay = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_BASE_DELAY * Math.pow(2, retryCount);
        
        // Retry if we haven't exceeded max retries
        if (retryCount < MAX_RETRIES) {
          debugLog(`Rate limited (420). Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return uploadImageWithRetry(file, retryCount + 1);
        }
        
        // Max retries exceeded - throw error with professional message
        throw new ImageUploadError(
          'Rate limit exceeded',
          'RATE_LIMIT',
          'Upload service is busy. Please wait a moment and try again.'
        );
      }
      
      if (res.status >= 500) {
        throw new ImageUploadError(
          `Server error: ${errorMessage}`,
          'NETWORK_ERROR',
          'Upload service is temporarily unavailable. Please try again in a moment.'
        );
      }
      
      throw new ImageUploadError(
        `Upload failed: ${errorMessage}`,
        'UNKNOWN',
        'Image upload failed. Please try again.'
      );
    }
    
    const data = await res.json();
    
    // Check for moderation rejection in successful response
    // Cloudinary with AWS Rekognition moderation adds a 'moderation' field
    if (data.moderation && Array.isArray(data.moderation)) {
      const rejectedModeration = data.moderation.find((mod: any) => mod.status === 'rejected');
      if (rejectedModeration) {
        throw new ImageUploadError(
          `Image rejected by moderation: ${rejectedModeration.kind}`,
          'MODERATION_REJECTED',
          'This image was flagged by our content moderation system. Please use appropriate images only.'
        );
      }
    }
    
    // Verify we got a valid URL
    if (!data.secure_url) {
      throw new ImageUploadError(
        'No URL returned from upload',
        'UNKNOWN',
        'Upload completed but no image URL received. Please try again.'
      );
    }
    
    // Cache the uploaded URL to prevent duplicate uploads
    uploadCache.set(cacheKey, data.secure_url);
    
    // Update last upload timestamp for rate limiting
    lastUploadTime = Date.now();
    
    // Limit cache size to prevent memory issues (keep last 50 uploads)
    if (uploadCache.size > 50) {
      const firstKey = uploadCache.keys().next().value;
      uploadCache.delete(firstKey);
    }
    
    // Persist cache to localStorage
    saveCache();
    
    return data.secure_url;
  } catch (err) {
    // Re-throw ImageUploadError as-is
    if (err instanceof ImageUploadError) {
      throw err;
    }
    
    // Handle network errors with retry
    if (err instanceof TypeError && err.message.includes('fetch')) {
      // Retry on network errors if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        const retryDelay = RETRY_BASE_DELAY * Math.pow(2, retryCount);
        debugLog(`Network error. Retrying in ${retryDelay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return uploadImageWithRetry(file, retryCount + 1);
      }
      
      throw new ImageUploadError(
        'Network request failed',
        'NETWORK_ERROR',
        'Cannot connect to upload service. Please check your internet connection.'
      );
    }
    
    // Handle unknown errors
    throw new ImageUploadError(
      err instanceof Error ? err.message : 'Unknown error',
      'UNKNOWN',
      'An unexpected error occurred. Please try again.'
    );
  }
}

// Public API - delegates to internal retry function
export async function uploadImage(file: File): Promise<string> {
  return uploadImageWithRetry(file, 0);
}

// Lightweight reachability check for cached asset URLs
// Use Image ping so CSP img-src governs the request (avoids connect-src blocks)
async function urlExists(url: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    // On server, skip validation and assume true
    return true;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timeoutMs = 4000;
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(false);
      }
    }, timeoutMs);

    function cleanup() {
      img.onload = null;
      img.onerror = null;
      window.clearTimeout(timer);
    }

    img.onload = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(true);
      }
    };
    img.onerror = () => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve(false);
      }
    };

    try {
      // Add cache-buster to avoid cached 404s in some browsers/CDNs
      const sep = url.includes('?') ? '&' : '?';
      img.referrerPolicy = 'no-referrer';
      img.src = `${url}${sep}ping=1`;
    } catch {
      cleanup();
      resolve(false);
    }
  });
}
