import React, { useEffect, useId, useRef } from 'react';
import { trackAnalytics } from '../lib/analytics';
import { markContextualShown, recordProductClick, suppressProduct } from '../lib/productPromotion';

/** Commercial destinations stay here so they cannot leak into AO3 output. */
export type ProductId = 'wordfokus' | 'worldkonstruct';

export type MoreToolsPlacement =
  | 'platform_picker_compact'
  | 'platform_picker_shelf'
  | 'site_skin_gallery_shelf'
  | 'workspace_settings'
  | 'hosted_image_success'
  | 'work_skin_success';

export type MoreToolsVariant = 'compact' | 'shelf' | 'settings' | 'contextual';

interface MoreToolsProps {
  placement: MoreToolsPlacement;
  variant: MoreToolsVariant;
  product?: ProductId;
  onDismiss?: () => void;
}

interface Product {
  id: ProductId;
  name: string;
  blurb: string;
  compactLabel: string;
  cta: string;
  destination: string;
}

const PRODUCTS: readonly Product[] = [
  {
    id: 'wordfokus',
    name: 'WordFokus',
    blurb: 'Draft in Google Docs without going back to polish every sentence. WordFokus keeps earlier text out of reach so the chapter moves forward.',
    compactLabel: 'Draft without re-editing',
    cta: 'Try WordFokus free',
    destination: 'https://app.wordfokus.com/',
  },
  {
    id: 'worldkonstruct',
    name: 'WorldKonstruct',
    blurb: 'Keeping a long AU or series consistent? WorldKonstruct can scan an existing draft into a story bible beside your manuscript.',
    compactLabel: 'Keep a series bible',
    cta: 'Try WorldKonstruct free',
    destination: 'https://app.wordfokus.com/worldkonstruct/',
  },
] as const;

const DISCLOSURE = 'Separate Google Docs add-ons · free to start · not required for AO3 SkinGen.';

export function productDestination(product: ProductId, placement: MoreToolsPlacement): string {
  const destination = PRODUCTS.find(candidate => candidate.id === product)?.destination;
  if (!destination) return '';
  const query = new URLSearchParams({
    utm_source: 'ao3skingen',
    utm_medium: 'referral',
    utm_campaign: 'writer_toolkit',
    utm_content: placement,
  });
  return `${destination}?${query.toString()}`;
}

/** Qualifies a view after the link stays at least 50% visible for one second. */
export function useQualifiedProductView(
  product: ProductId,
  placement: MoreToolsPlacement,
  variant: MoreToolsVariant,
): React.RefObject<HTMLAnchorElement> {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let intersectionRatio = 0;
    let qualified = false;

    const cancelTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };

    const considerQualification = () => {
      cancelTimer();
      if (qualified || document.visibilityState !== 'visible' || intersectionRatio < 0.5) return;
      timer = setTimeout(() => {
        timer = null;
        if (qualified || document.visibilityState !== 'visible' || intersectionRatio < 0.5) return;
        qualified = true;
        if (variant === 'contextual') markContextualShown(product);
        trackAnalytics({ name: 'product_promo_viewed', product, placement, variant });
        observer.disconnect();
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }, 1000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') considerQualification();
      else cancelTimer();
    };

    const observer = new IntersectionObserver(([entry]) => {
      intersectionRatio = entry?.isIntersecting ? entry.intersectionRatio : 0;
      considerQualification();
    }, { threshold: [0, 0.5, 1] });

    observer.observe(element);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelTimer();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [placement, product, variant]);

  return ref;
}

const ProductLink: React.FC<{
  product: Product;
  placement: MoreToolsPlacement;
  variant: MoreToolsVariant;
  className: string;
  children: React.ReactNode;
}> = ({ product, placement, variant, className, children }) => {
  const ref = useQualifiedProductView(product.id, placement, variant);
  return (
    <a
      ref={ref}
      href={productDestination(product.id, placement)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        recordProductClick(product.id);
        trackAnalytics({ name: 'product_cta_clicked', product: product.id, placement, variant });
      }}
      className={className}
    >
      {children}
    </a>
  );
};

const Disclosure: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <p className={`${compact ? 'mt-2' : 'mt-3'} text-[11px] leading-relaxed text-stone-400`}>
    {DISCLOSURE}
  </p>
);

export const MoreTools: React.FC<MoreToolsProps> = ({ placement, variant, product, onDismiss }) => {
  const headingId = `more-tools-${useId().replace(/:/g, '')}`;
  const selectedProducts = product ? PRODUCTS.filter(candidate => candidate.id === product) : PRODUCTS;

  if (variant === 'compact') {
    return (
      <section aria-labelledby={headingId} className="mt-5 w-full max-w-lg rounded-xl border border-stone-200 bg-white px-4 py-3 text-center">
        <h2 id={headingId} className="text-sm font-semibold text-stone-800">Writing the fic too?</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
          Free-to-start Google Docs tools from the maker of AO3 SkinGen.
        </p>
        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 list-none p-0">
          {selectedProducts.map(candidate => (
            <li key={candidate.id}>
              <ProductLink
                product={candidate}
                placement={placement}
                variant={variant}
                className="inline-flex rounded-md text-xs font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
              >
                {candidate.compactLabel}
              </ProductLink>
            </li>
          ))}
        </ul>
        <Disclosure compact />
      </section>
    );
  }

  if (variant === 'contextual') {
    const candidate = selectedProducts[0];
    if (!candidate) return null;
    const isWordFokus = candidate.id === 'wordfokus';
    return (
      <section aria-labelledby={headingId} className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <h2 id={headingId} className="text-sm font-semibold text-stone-900">
          {isWordFokus
            ? 'Your scene is ready. Writing the next chapter in Google Docs?'
            : 'Is this fic becoming a series?'}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-stone-600">
          {isWordFokus
            ? 'WordFokus keeps you drafting instead of polishing the same paragraph again.'
            : 'WorldKonstruct can scan an existing draft into a story bible, so AU details and continuity stay easy to find.'}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ProductLink
            product={candidate}
            placement={placement}
            variant={variant}
            className="rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            {candidate.cta} →
          </ProductLink>
          {onDismiss && (
            <button
              type="button"
              onClick={() => {
                suppressProduct(candidate.id);
                onDismiss();
              }}
              aria-label={`Not for me: ${candidate.name}`}
              className="rounded-md text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              Not for me
            </button>
          )}
        </div>
        <Disclosure compact />
      </section>
    );
  }

  const settingsVariant = variant === 'settings';
  return (
    <section
      aria-labelledby={headingId}
      className={settingsVariant ? 'pt-3' : 'mt-10 border-t border-stone-200/70 pt-6'}
    >
      <h2 id={headingId} className={`${settingsVariant ? 'text-left' : 'text-center'} text-xs font-semibold text-stone-500`}>
        {settingsVariant ? 'Tools for the story before, during, and after the draft.' : 'Also by the same developer'}
      </h2>
      <ul className={`${settingsVariant ? 'mt-3 grid-cols-1' : 'mt-4 sm:grid-cols-2 max-w-2xl mx-auto'} grid gap-3 list-none p-0`}>
        {selectedProducts.map(candidate => (
          <li key={candidate.id}>
            <ProductLink
              product={candidate}
              placement={placement}
              variant={variant}
              className="block h-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              <span className="block text-sm font-semibold text-stone-700">{candidate.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">{candidate.blurb}</span>
              <span className="mt-2 block text-xs font-semibold text-violet-700">{candidate.cta} →</span>
            </ProductLink>
          </li>
        ))}
      </ul>
      <Disclosure />
    </section>
  );
};

export default MoreTools;
