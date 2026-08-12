/** Same-origin client for the server-side ImgBB upload boundary. */

export type ImageUploadKind = 'selected-file' | 'rendered-scene';

export class ImageUploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string
  ) {
    super(message);
    this.name = 'ImageUploadError';
  }
}

export async function uploadToImgBB(blob: Blob, kind: ImageUploadKind): Promise<string> {
  if (typeof window === 'undefined') {
    throw new ImageUploadError('Client upload called on the server', 'CLIENT_ERROR', 'Image upload cannot start here.');
  }

  let response: Response;
  try {
    response = await fetch('/api/image-upload', {
      method: 'POST',
      headers: {
        'Content-Type': blob.type || 'application/octet-stream',
        'X-Upload-Kind': kind,
      },
      body: blob,
    });
  } catch {
    throw new ImageUploadError('Same-origin upload request failed', 'NETWORK_ERROR', 'Network error. Check your connection and try again.');
  }

  const body = await response.json().catch(() => null) as {
    ok?: boolean;
    url?: unknown;
    error?: { code?: unknown; message?: unknown };
  } | null;
  if (!response.ok || body?.ok !== true || typeof body.url !== 'string') {
    const code = typeof body?.error?.code === 'string' ? body.error.code : 'UPLOAD_FAILED';
    const message = typeof body?.error?.message === 'string'
      ? body.error.message
      : 'Image upload failed. Please try again.';
    throw new ImageUploadError(`Upload route returned ${response.status} (${code})`, code, message);
  }
  return body.url;
}
