import Head from 'next/head';
import { PRODUCT } from '../lib/brand';

interface ProductHeadProps {
  title: string;
  description: string;
  path?: string;
}

export function ProductHead({ title, description, path = '/' }: ProductHeadProps) {
  const canonical = new URL(path, `${PRODUCT.appUrl}/`).toString();

  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content="noindex,follow" />
      <meta name="application-name" content={PRODUCT.name} />
      <meta name="theme-color" content={PRODUCT.themeColor} />
      <link rel="canonical" href={canonical} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={PRODUCT.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
}
