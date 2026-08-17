import React, { useState } from 'react';
import { SiteSkinTheme } from '../../lib/siteSkin/theme';
import {
  BannerReading,
  Polarity,
  paletteFromPixels,
  readBannerBrightness,
  withBanner,
} from '../../lib/siteSkin/palette';
import { samplePixels } from '../../lib/siteSkin/imageSample';
import { checkAo3ImageUrl } from '../../lib/siteSkin/ao3Css';
import { normalizeImageUrl } from '../../lib/urlNormalize';
import { ThemeThumbnail } from './ThemeThumbnail';
import { trackAnalytics } from '../../lib/analytics';

interface Props {
  /** Changes the copy and the analytics, nothing else. */
  placement: 'gallery' | 'editor';
  /**
   * The chosen theme, complete. The caller decides how much of it to take:
   * the gallery adopts the whole thing, the editor takes the colours and the
   * banner fields and leaves the user's fonts and shape alone.
   */
  onUse: (theme: SiteSkinTheme, polarity: Polarity) => void;
}

type Status = 'idle' | 'working' | 'ready';

interface Extraction {
  url: string;
  themes: Record<Polarity, SiteSkinTheme>;
  reading: BannerReading;
  /** Whether this address is one AO3 would accept behind a header. */
  bannerOk: boolean;
  /** AO3's objection, in plain language, when it is not. */
  bannerProblem: string;
}

const POLARITY_LABELS: Record<Polarity, string> = { light: 'Light', dark: 'Dark' };

/**
 * Paste a picture, get a theme.
 *
 * See `docs/MAGIC-PICKER-IMPLEMENTATION.md` §5 for the whole design. The three
 * decisions visible here:
 *
 * 1. **It promises colours, never a match.** §3 is a product decision, not copy.
 *    We can deliver four colours; a person who loves a picture mostly loves its
 *    subject, its type and its composition, none of which crosses to AO3. Saying
 *    "match" sets up a comparison we lose on every single use.
 * 2. **The result is two cards, not one.** Most images extract to something near
 *    a light neutral with one accent — which is close to a template we already
 *    ship. Showing both polarities at the moment of choice turns the most common
 *    disappointing result into a decision, and it costs one call to a pure
 *    function (§5e).
 * 3. **The cards are `ThemeThumbnail`**, the same component every gallery card
 *    uses, so the picker shares `derive()` with the compiler and cannot
 *    advertise a header the real skin would not produce.
 */
export const PaletteFromImage: React.FC<Props> = ({ placement, onUse }) => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [useAsBanner, setUseAsBanner] = useState(false);

  const extract = async () => {
    const address = url.trim();
    if (!address) return;

    // A client-side pre-check for the one mistake that is worth catching without
    // a round trip: the proxy is HTTPS-only, and "copy link" on plenty of sites
    // yields something that is not an address at all.
    if (!/^https:\/\/\S+$/i.test(address)) {
      setError('That needs to be a full address starting with https://.');
      setStatus('idle');
      return;
    }

    setStatus('working');
    setError('');
    setExtraction(null);

    try {
      const pixels = await samplePixels(address);
      const verdict = checkAo3ImageUrl(address);
      setExtraction({
        url: address,
        themes: paletteFromPixels(pixels),
        reading: readBannerBrightness(pixels),
        bannerOk: verdict.ok,
        bannerProblem: verdict.ok ? '' : verdict.fix || verdict.problem || '',
      });
      // Off by default even when the address is legal. The user came here for
      // colours; a banner is a second decision and it should be theirs.
      setUseAsBanner(false);
      setStatus('ready');
    } catch (cause) {
      // The proxy's messages are written for this audience and are already safe
      // to show — "that site blocks other sites from loading its images" is a
      // better sentence than anything we would compose from a status code.
      setError(cause instanceof Error ? cause.message : 'That image could not be read.');
      setStatus('idle');
    }
  };

  const use = (polarity: Polarity) => {
    if (!extraction) return;
    const base = extraction.themes[polarity];
    const theme =
      useAsBanner && extraction.bannerOk
        ? withBanner(base, extraction.url, extraction.reading)
        : base;
    trackAnalytics({ name: 'palette_applied', source: 'image', polarity, placement });
    onUse(theme, polarity);
  };

  const working = status === 'working';

  return (
    <div className={placement === 'gallery' ? 'rounded-2xl border border-stone-200 bg-white p-5' : ''}>
      {placement === 'gallery' && (
        <>
          <h2 className="text-sm font-semibold text-stone-900">
            None of these? Build one from a picture.
          </h2>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Paste a link to any image — fan art, a poster, a screenshot. We read
            its colours and build the theme around them.
          </p>
        </>
      )}

      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <label htmlFor="palette-url" className="sr-only">
          Image address
        </label>
        <input
          id="palette-url"
          type="url"
          inputMode="url"
          value={url}
          disabled={working}
          placeholder="https://i.imgur.com/yourimage.png"
          onChange={e => {
            setUrl(normalizeImageUrl(e.target.value));
            setError('');
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void extract();
            }
          }}
          className="flex-1 min-w-0 text-xs text-stone-700 bg-stone-100 border border-transparent rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void extract()}
          disabled={working || !url.trim()}
          className="flex-shrink-0 px-4 py-2.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:bg-stone-200 disabled:text-stone-400 transition-colors"
        >
          {working ? 'Reading the colours…' : 'Get the colours'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-amber-800 leading-relaxed">
          {error}
        </p>
      )}

      {status === 'ready' && extraction && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-stone-900">Your colours, two ways.</p>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
            Both are built from the same picture. Everything stays editable
            afterwards.
          </p>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['light', 'dark'] as Polarity[]).map(polarity => {
              const theme = extraction.themes[polarity];
              return (
                <button
                  key={polarity}
                  type="button"
                  onClick={() => use(polarity)}
                  // Named for what pressing it does, not for the word on it.
                  // The visible label is one word because the two cards are
                  // side by side and the picture carries the rest — but a
                  // button announced as "Dark" is indistinguishable from the
                  // gallery's "Dark" mood filter to anyone not looking at it.
                  aria-label={`Use the ${polarity} version`}
                  className="text-left bg-white border border-stone-200 rounded-xl overflow-hidden hover:border-violet-400 hover:shadow-lg transition-all focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <ThemeThumbnail theme={theme} />
                  <div className="p-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-stone-900">
                      {POLARITY_LABELS[polarity]}
                    </span>
                    <span className="flex gap-1" aria-hidden="true">
                      {(['background', 'surface', 'accent', 'text'] as const).map(key => (
                        <i
                          key={key}
                          className="block w-3.5 h-3.5 rounded-full border border-stone-200"
                          style={{ backgroundColor: theme.colors[key] }}
                        />
                      ))}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* §5d — the single most common rejection in the product, turned into
              a partial win. A Discord CDN address fails AO3's URI grammar and
              always will, and it is still a perfectly good picture to read
              colours from. Saying both things is the whole value. */}
          {extraction.bannerOk ? (
            <label className="mt-3 flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useAsBanner}
                onChange={e => setUseAsBanner(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-xs text-stone-600 leading-relaxed">
                Also put this picture behind the header. AO3 accepts this
                address, and we&apos;ve measured the image — the title will be{' '}
                {extraction.reading.textColor === 'light' ? 'light' : 'dark'}
                {extraction.reading.textShadow ? ', with a glow to keep it readable' : ''}.
              </span>
            </label>
          ) : (
            <div role="status" className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-amber-900">
                That address can&apos;t be used as a banner on AO3 — but the colours
                came through fine.
              </p>
              {extraction.bannerProblem && (
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  {extraction.bannerProblem}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* The honesty line, and it is the same argument as the font caveat in
          ThemeEditor: a skin is colours. Naming the limit is what stops the
          feature over-promising, and §3 says the promise is where this feature
          succeeds or fails. */}
      <p className="mt-3 text-[11px] text-stone-400 leading-relaxed">
        A skin can carry colours, not layout or fonts — AO3 fixes those. Your
        picture is read in your browser; nothing about it is saved.
      </p>
    </div>
  );
};

/**
 * The same picker in a modal, for the editor.
 *
 * There is no confirmation step and that is deliberate. Applying here replaces
 * four hex strings and pushes onto the history stack, so `Ctrl+Z` reverts it —
 * unlike the theme-backup import in `ExportSkinDialog`, which downloads a safety
 * copy first because it replaces the fonts, the shape and the banner too.
 */
export const PaletteFromImageDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onUse: (theme: SiteSkinTheme, polarity: Polarity) => void;
}> = ({ isOpen, onClose, onUse }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Build colours from a picture"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold">Colours from a picture</h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Replaces your four colours. Your fonts and shapes stay as they are.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white hover:text-stone-300 text-2xl font-bold leading-none ml-4"
          >
            ×
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          <PaletteFromImage
            placement="editor"
            onUse={(theme, polarity) => {
              onUse(theme, polarity);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default PaletteFromImage;
