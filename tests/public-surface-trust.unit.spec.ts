import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

const publicSurfaces = [
  {
    name: 'SwipePages landing source',
    file: 'docs/landing-swipepages-2026-08.html',
    placements: ['swipepages_footer', 'swipepages_footer', 'swipepages_product_shelf', 'swipepages_product_shelf'],
  },
  {
    name: 'WordPress hub source',
    file: 'docs/landing-wordfokus-ao3skingen-WORDPRESS.html',
    placements: ['wordpress_hub_product_shelf', 'wordpress_hub_product_shelf'],
  },
  {
    name: 'examples gallery',
    file: 'public/examples-gallery.html',
    placements: ['examples_gallery_product_shelf', 'examples_gallery_product_shelf'],
  },
] as const;

const publishedArticleSources = [
  'docs/articles/ao3-twitter-work-skin.wordpress.template.html',
  'docs/article-02-ao3-twitter-work-skin-WORDPRESS.html',
  'docs/articles/ao3-allowed-css-properties.wordpress.template.html',
  'docs/article-01-ao3-allowed-css-properties-WORDPRESS.html',
  'docs/articles/ao3-allowed-css-properties.md',
  'docs/AO3-CONTENT-PLAN.md',
] as const;

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function productLinks(html: string) {
  return [...html.matchAll(/<a\s+[^>]*href="(https:\/\/app\.wordfokus\.com[^"]*)"[^>]*>/g)].map(match => ({
    tag: match[0],
    url: new URL(match[1].replace(/&amp;/g, '&')),
  }));
}

for (const surface of publicSurfaces) {
  test(`${surface.name} has an honest, attributable product-family shelf`, () => {
    const html = read(surface.file);
    expect(html).toContain('WordFokus');
    expect(html).toContain('WorldKonstruct');
    expect(html).not.toMatch(/Used by|1,?200\+? AO3 Writers/i);

    const links = productLinks(html);
    expect(links.map(({ url }) => url.searchParams.get('utm_content')).sort()).toEqual([...surface.placements].sort());

    for (const { tag, url } of links) {
      expect(url.searchParams.get('utm_source')).toBe('ao3skingen');
      expect(url.searchParams.get('utm_medium')).toBe('referral');
      expect(url.searchParams.get('utm_campaign')).toBe('writer_toolkit');
      expect([...url.searchParams.keys()]).toEqual(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']);
      expect(tag).toContain('target="_blank"');
      expect(tag).toContain('rel="noopener noreferrer"');
    }
  });
}

test('a full AO3 SkinGen section separates product promotion from Ko-fi', () => {
  const swipePages = read('docs/landing-swipepages-2026-08.html');
  expect(swipePages.indexOf('id="more-tools"')).toBeLessThan(swipePages.indexOf('Core-product CTA intentionally separates'));
  expect(swipePages.indexOf('Core-product CTA intentionally separates')).toBeLessThan(swipePages.indexOf('id="support"'));

  const wordpress = read('docs/landing-wordfokus-ao3skingen-WORDPRESS.html');
  expect(wordpress.indexOf('id="more-tools"')).toBeLessThan(wordpress.indexOf('id="guides"'));
  expect(wordpress.indexOf('id="guides"')).toBeLessThan(wordpress.indexOf('id="support"'));

  const gallery = read('public/examples-gallery.html');
  expect(gallery.indexOf('Also by the same developer')).toBeLessThan(gallery.indexOf('</main>'));
  expect(gallery.indexOf('</main>')).toBeLessThan(gallery.indexOf('https://ko-fi.com/ao3skingen'));
});

test('publishable articles use the canonical app host', () => {
  for (const relativePath of publishedArticleSources) {
    expect(read(relativePath), relativePath).not.toContain('https://ao3skingen.netlify.app');
  }
});
