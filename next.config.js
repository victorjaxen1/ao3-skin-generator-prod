/** @type {import('next').NextConfig} */
// Force deployment: Nov 30, 2025 - Security hardening
const nextConfig = {
  reactStrictMode: true,
  // swcMinify removed - default true in Next.js 15+
  compiler: {
    // Strip console.* in production bundles, but keep console.error and console.warn
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  async headers() {
    // Production CSP is stricter - dev needs 'unsafe-eval' for hot reload
    const isDev = process.env.NODE_ENV !== 'production';
    
    // Base CSP directives
    const cspDirectives = [
      "default-src 'self'",
      // Scripts: self + GA. Dev needs unsafe-eval for Next.js HMR
      // Note: 'unsafe-inline' required for GA gtag inline script and Next.js
      `script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com`,
      // Styles: self + inline (Tailwind) + Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts: self + Google Fonts
      "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com data:",
      // Images: self + data URIs + blob (canvas export) + Cloudinary + Publit.io
      "img-src 'self' data: blob: https://res.cloudinary.com https://media.publit.io https://*.cloudinary.com",
      // Connections: self + Cloudinary API + Google Analytics
      "connect-src 'self' https://api.cloudinary.com https://www.google-analytics.com https://analytics.google.com https://*.google-analytics.com https://*.analytics.google.com",
      // Prevent framing (clickjacking protection)
      "frame-ancestors 'none'",
      // Block object/embed (Flash, etc.)
      "object-src 'none'",
      // Form submissions only to self
      "form-action 'self'",
      // Base URI restriction
      "base-uri 'self'",
      // Upgrade insecure requests in production
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // XSS protection (legacy browsers)
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Referrer policy - don't leak full URL to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Permissions policy - disable unnecessary browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // Content Security Policy
          { key: 'Content-Security-Policy', value: cspDirectives },
        ],
      },
    ];
  },
};
module.exports = nextConfig;
