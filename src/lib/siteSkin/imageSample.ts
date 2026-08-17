/**
 * A picture at an address → the pixels `palette.ts` reads.
 *
 * The only file in the site-skin product that knows what a canvas is. Everything
 * downstream takes plain RGBA bytes, which is what lets the whole extraction be
 * tested without a browser.
 *
 * ## Why this goes through `/api/image-proxy`, for two reasons and not one
 *
 * The obvious one is SSRF, and that work is already done and already generic —
 * see `lib/server/imageSecurity.ts`.
 *
 * The reason that is easy to miss: **a cross-origin image taints a canvas.**
 * Loading the picture straight into an `<img>` and calling `getImageData` throws
 * a `SecurityError` unless the host sends `Access-Control-Allow-Origin`, and
 * image hosts largely do not. Routing through the proxy returns the bytes as a
 * `data:` URI, which is same-origin, which is what makes the pixels readable at
 * all.
 *
 * **Anyone who "simplifies" this by dropping the proxy will find it works on
 * their test image and fails on most real ones.** imgur sends CORS headers;
 * Discord's CDN, Tumblr and most personal hosts do not.
 */

import { proxyImageToDataUri } from '../imageProxy';

/**
 * The longest edge of the sample.
 *
 * Small on purpose, and the downscale is not only a speed trick: the browser's
 * own smoothing averages away the JPEG ringing that would otherwise bin as its
 * own colour. 64px is ~4,000 pixels, which is far more than enough to rank
 * sixteen clusters.
 */
export const SAMPLE_EDGE = 64;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be decoded.'));
    image.src = src;
  });
}

/** Fetch through the proxy, downscale, and hand back RGBA bytes. */
export async function samplePixels(url: string): Promise<Uint8ClampedArray> {
  const image = await loadImage(await proxyImageToDataUri(url));

  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longest) throw new Error('That image could not be decoded.');
  const scale = Math.min(1, SAMPLE_EDGE / longest);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('This browser could not read the image.');

  // Leave smoothing ON. The averaging is the point — see SAMPLE_EDGE above.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return context.getImageData(0, 0, width, height).data;
}
