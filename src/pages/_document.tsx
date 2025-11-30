import { Html, Head, Main, NextScript } from 'next/document';

/**
 * Validate and sanitize Google Analytics Measurement ID.
 * Only allows valid GA4 format (G-XXXXXXXXXX) to prevent script injection.
 */
function validateGAId(id: string | undefined): string {
  if (!id) return '';
  // GA4 format: G- followed by exactly 10 alphanumeric characters
  const match = id.match(/^G-[A-Z0-9]{10}$/i);
  return match ? match[0].toUpperCase() : '';
}

export default function Document() {
  // Google Analytics Measurement ID - validated to prevent XSS
  const GA_MEASUREMENT_ID = validateGAId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  
  return (
    <Html lang="en">
      <Head>
        {/* Google Fonts - WordFokus Brand */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Roboto:wght@300;400;500&display=swap" 
          rel="stylesheet" 
        />
        
        {/* Google Analytics - Only load if valid GA ID is configured */}
        {GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    page_path: window.location.pathname,
                    anonymize_ip: true,
                    cookie_flags: 'SameSite=Strict;Secure'
                  });
                `,
              }}
            />
          </>
        )}
        
        {/* 
          CSP is set via HTTP headers in next.config.js for proper enforcement.
          Meta tag CSP is a fallback but headers take precedence.
        */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
