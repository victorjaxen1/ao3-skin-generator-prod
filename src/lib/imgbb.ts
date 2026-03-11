/**
 * ImgBB Upload Client
 * Free anonymous image hosting — no paid tier, no user configuration required.
 * Developer registers once at imgbb.com and sets NEXT_PUBLIC_IMGBB_API_KEY.
 *
 * API docs: https://api.imgbb.com/
 */

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public code: 'NETWORK_ERROR' | 'API_ERROR' | 'TIMEOUT' | 'UNKNOWN',
    public userMessage: string
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 5000;

/**
 * Convert a Blob to a base64-encoded string (without the data URL prefix).
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip "data:image/png;base64," prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read blob as base64'));
    reader.readAsDataURL(blob);
  });
}

async function uploadWithRetry(blob: Blob, retryCount = 0): Promise<string> {
  const apiKey = process.env.NEXT_PUBLIC_IMGBB_API_KEY;

  if (!apiKey) {
    throw new ImageUploadError(
      'NEXT_PUBLIC_IMGBB_API_KEY is not set',
      'API_ERROR',
      'Image upload is not configured. Please contact the site owner.'
    );
  }

  try {
    const base64 = await blobToBase64(blob);

    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    let response: Response;
    try {
      response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ImageUploadError(
        `ImgBB API error ${response.status}: ${text}`,
        'API_ERROR',
        'Image upload failed. Please try again.'
      );
    }

    const data = await response.json();

    if (!data.success || !data.data?.display_url) {
      throw new ImageUploadError(
        `ImgBB returned unsuccessful response: ${JSON.stringify(data)}`,
        'API_ERROR',
        'Image upload failed. Please try again.'
      );
    }

    return data.data.display_url as string;
  } catch (err) {
    if (err instanceof ImageUploadError) {
      // Retry on API errors (rate limiting etc.), not config errors
      if (err.code === 'API_ERROR' && retryCount < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return uploadWithRetry(blob, retryCount + 1);
      }
      throw err;
    }

    if (err instanceof Error && err.name === 'AbortError') {
      if (retryCount < MAX_RETRIES) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return uploadWithRetry(blob, retryCount + 1);
      }
      throw new ImageUploadError(
        'Upload timed out',
        'TIMEOUT',
        'Upload timed out. Check your internet connection and try again.'
      );
    }

    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return uploadWithRetry(blob, retryCount + 1);
    }

    throw new ImageUploadError(
      err instanceof Error ? err.message : 'Unknown upload error',
      'NETWORK_ERROR',
      'Network error. Check your internet connection and try again.'
    );
  }
}

/**
 * Upload a PNG/image Blob to ImgBB and return the permanent display URL.
 *
 * @param blob - The image blob to upload (typically from canvas.toBlob())
 * @returns A permanent ImgBB display URL (e.g. https://i.ibb.co/xxx/img.png)
 * @throws ImageUploadError on failure after retries
 */
export async function uploadToImgBB(blob: Blob): Promise<string> {
  if (typeof window === 'undefined') {
    throw new ImageUploadError(
      'uploadToImgBB called on server side',
      'UNKNOWN',
      'Image upload cannot run on the server.'
    );
  }
  return uploadWithRetry(blob);
}
