import React from 'react';
import { trackAnalytics } from '../lib/analytics';

/**
 * The other tools by the same developer.
 *
 * Section 11.6 Tier 2: permanent, quiet, and free to ignore. Deliberately **not**
 * a card, a modal, or anything triggered by finishing an export — Tier 2 exists
 * because the previous plan's completion-timed commercial card was aimed at an
 * author who had already finished writing.
 *
 * Three constraints this component exists to hold in one place:
 *
 * 1. **It never appears in AO3-bound output.** It is a React component rendered
 *    on entry screens only. Nothing here reaches `generator.ts`, `workSkin.ts`,
 *    or any string an author pastes into the archive — Section 2 forbids it, and
 *    `more-tools.unit.spec.ts` asserts it.
 * 2. **It never shares a surface with the donation ask**, per Section 4.5.
 * 3. **It stays off the editor.** Only the platform picker and the site-skin
 *    gallery, both of which are full-page entry screens with no composer to
 *    occlude.
 *
 * `rel="noreferrer"` is not boilerplate: Section 11.4's privacy rule for the
 * eventual owned redirect says the destination must never receive a complete
 * referrer URL, and a plain outbound link would send one today.
 */

export type MoreToolsPlacement = 'platform_picker' | 'site_skin_gallery';

interface Product {
  id: 'wordfokus' | 'worldkonstruct';
  name: string;
  href: string;
  /**
   * Specific rather than generic, because the generic version of each of these
   * describes a product the reader cannot picture.
   *
   * WordFokus is not "distraction-free writing" — that phrase covers a hundred
   * apps and names no mechanism. It refuses to let you edit while you draft,
   * which is an unusual and immediately understandable thing to do, so say that.
   *
   * WorldKonstruct is not "organise your worldbuilding" — that describes a job
   * most fanfiction authors do not have, because canon already did it. See
   * Section 11.6. Manuscript scanning and series bibles are the two specifics
   * that land on someone who has just finished a fic.
   */
  blurb: string;
}

const PRODUCTS: readonly Product[] = [
  {
    id: 'wordfokus',
    name: 'WordFokus',
    href: 'https://app.wordfokus.com',
    blurb: 'Drafting in Google Docs that will not let you edit as you write. It locks what you have already typed, so you stop re-polishing the first sentence and the chapter actually gets finished.',
  },
  {
    id: 'worldkonstruct',
    name: 'WorldKonstruct',
    href: 'https://app.wordfokus.com/worldkonstruct',
    blurb: 'A story bible beside your manuscript. Point it at a draft you have already written and it finds the characters, places and events — useful once a fic becomes a series.',
  },
];

export const MoreTools: React.FC<{ placement: MoreToolsPlacement }> = ({ placement }) => (
  <section aria-labelledby="more-tools-heading" className="mt-10 pt-6 border-t border-stone-200/70">
    <h2 id="more-tools-heading" className="text-xs font-semibold text-stone-400 text-center">
      Also by the same developer
    </h2>
    <p className="mt-1 text-[11px] text-stone-400 text-center">
      Separate Google Docs add-ons. Nothing here is needed to use this tool, which is free.
    </p>
    <ul className="mt-4 grid gap-3 sm:grid-cols-2 max-w-2xl mx-auto list-none p-0">
      {PRODUCTS.map(product => (
        <li key={product.id}>
          <a
            href={product.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAnalytics({ name: 'product_cta_clicked', product: product.id, placement })}
            className="block h-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50/40 transition-colors"
          >
            <span className="block text-sm font-semibold text-stone-700">{product.name}</span>
            <span className="mt-0.5 block text-xs text-stone-500 leading-relaxed">{product.blurb}</span>
          </a>
        </li>
      ))}
    </ul>
  </section>
);

export default MoreTools;
