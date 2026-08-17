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
import { fetchSitePalette } from '../../lib/siteSkin/sitePaletteClient';
import { SiteNote, themesFromSite } from '../../lib/siteSkin/siteTheme';
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

/** Which door the user came in by. Phase C added the second one. */
type Source = 'image' | 'site';

interface Extraction {
  source: Source;
  themes: Record<Polarity, SiteSkinTheme>;
  /**
   * The address we would put behind the header, which is **not** always the
   * address the user typed: for a website it is that site's social card. Empty
   * when there is no candidate at all.
   */
  bannerCandidate: string;
  /** Null when we never held the banner's pixels — see §5f.3, and `bannerOk`. */
  reading: BannerReading | null;
  /** Whether this address is one AO3 would accept behind a header. */
  bannerOk: boolean;
  /** AO3's objection, in plain language, when it is not. */
  bannerProblem: string;
  /** The "what we did" lines. Website only — a picture has nothing to explain. */
  notes: SiteNote[];
}

const POLARITY_LABELS: Record<Polarity, string> = { light: 'Light', dark: 'Dark' };

/**
 * Paste a picture or a link, get a theme.
 *
 * See `docs/MAGIC-PICKER-IMPLEMENTATION.md` §5 and §6 for the whole design. The
 * decisions visible here:
 *
 * 1. **It promises colours, never a match.** §3 is a product decision, not copy.
 *    We can deliver four colours, a corner radius and a font *category*; a
 *    person who loves a site loves its type, its spacing and its pictures, and
 *    none of those crosses to AO3. Saying "match" sets up a comparison we lose
 *    on every single use.
 * 2. **The result is two cards, not one.** Most sources extract to something
 *    near a light neutral with one accent — which is close to a template we
 *    already ship. Showing both polarities at the moment of choice turns the
 *    most common disappointing result into a decision, and it costs one call to
 *    a pure function (§5e). Phase C adds the sentence C can say and B cannot:
 *    *which way round the site itself was* (§6e).
 * 3. **The cards are `ThemeThumbnail`**, the same component every gallery card
 *    uses, so the picker shares `derive()` with the compiler and cannot
 *    advertise a header the real skin would not produce.
 * 4. **The website door explains itself.** A silent font substitution reads as
 *    us getting it wrong; naming the constraint is what makes it competence
 *    (§6d step 4). Those sentences are built in `siteTheme.ts`, next to the
 *    judgement they describe.
 */
export const PaletteFromImage: React.FC<Props> = ({ placement, onUse }) => {
  const [source, setSource] = useState<Source>('image');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [useAsBanner, setUseAsBanner] = useState(false);

  const reset = (next: Source) => {
    setSource(next);
    setUrl('');
    setError('');
    setExtraction(null);
    setStatus('idle');
  };

  const extractFromImage = async (address: string): Promise<Extraction> => {
    const pixels = await samplePixels(address);
    const verdict = checkAo3ImageUrl(address);
    return {
      source: 'image',
      themes: paletteFromPixels(pixels),
      bannerCandidate: address,
      reading: readBannerBrightness(pixels),
      bannerOk: verdict.ok,
      bannerProblem: verdict.ok ? '' : verdict.fix || verdict.problem || '',
      notes: [],
    };
  };

  const extractFromSite = async (address: string): Promise<Extraction> => {
    const style = await fetchSitePalette(address);

    // §6a: the social card is the *primary* signal, so it is tried first and the
    // stylesheet is the fallback. It fails often and harmlessly — plenty of
    // cards are SVG, or served from a host the proxy refuses — and a failure
    // here must not lose the extraction, because the CSS answer is still good.
    let pixels: Uint8ClampedArray | null = null;
    if (style.ogImage) {
      try {
        pixels = await samplePixels(style.ogImage);
      } catch {
        pixels = null;
      }
    }

    const extracted = themesFromSite(style, pixels, style.url);
    // The editor applies the colours and leaves the user's fonts alone (§5e), so
    // the font sentences would be describing something that is not going to
    // happen. Filtered here rather than in `siteTheme.ts`, which has no idea
    // where it is being rendered.
    const notes =
      placement === 'editor' ? extracted.notes.filter(note => note.kind !== 'font') : extracted.notes;
    const candidate = pixels && style.ogImage ? style.ogImage : '';
    const verdict = candidate ? checkAo3ImageUrl(candidate) : null;

    return {
      source: 'site',
      themes: extracted.themes,
      bannerCandidate: candidate,
      // Only when we actually held those pixels: a measurement of an image we
      // never read would be a guess wearing a measurement's clothes (§5f.3).
      reading: pixels ? readBannerBrightness(pixels) : null,
      bannerOk: Boolean(verdict?.ok),
      bannerProblem: verdict && !verdict.ok ? verdict.fix || verdict.problem || '' : '',
      notes,
    };
  };

  const extract = async () => {
    const typed = url.trim();
    if (!typed) return;

    // A website address is allowed to arrive the way people say them — nobody
    // types the scheme. An image address is not given the same courtesy: it was
    // copied from somewhere, so a missing scheme means something else went wrong.
    const address = source === 'site' && !/^[a-z]+:\/\//i.test(typed) ? `https://${typed}` : typed;

    if (!/^https:\/\/\S+$/i.test(address)) {
      setError(
        source === 'site'
          ? 'That needs to be a web address, like https://example.com.'
          : 'That needs to be a full address starting with https://.'
      );
      setStatus('idle');
      return;
    }

    setStatus('working');
    setError('');
    setExtraction(null);

    try {
      setExtraction(source === 'site' ? await extractFromSite(address) : await extractFromImage(address));
      // Off by default even when the address is legal. The user came here for
      // colours; a banner is a second decision and it should be theirs.
      setUseAsBanner(false);
      setStatus('ready');
    } catch (cause) {
      // The server's messages are written for this audience and are already safe
      // to show — "that site blocks other sites from loading its images" is a
      // better sentence than anything we would compose from a status code.
      setError(cause instanceof Error ? cause.message : 'That could not be read.');
      setStatus('idle');
    }
  };

  const use = (polarity: Polarity) => {
    if (!extraction) return;
    const base = extraction.themes[polarity];
    const theme =
      useAsBanner && extraction.bannerOk && extraction.reading
        ? withBanner(base, extraction.bannerCandidate, extraction.reading)
        : base;
    trackAnalytics({ name: 'palette_applied', source: extraction.source, polarity, placement });
    onUse(theme, polarity);
  };

  const working = status === 'working';
  const isSite = source === 'site';

  return (
    <div className={placement === 'gallery' ? 'rounded-2xl border border-stone-200 bg-white p-5' : ''}>
      {placement === 'gallery' && (
        <>
          <h2 className="text-sm font-semibold text-stone-900">
            None of these? Build one from something you already love.
          </h2>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">
            Paste a link to a picture — fan art, a poster, a screenshot — or to a
            website. We read the colours and build the theme around them.
          </p>
        </>
      )}

      <div className="mt-3 inline-flex rounded-lg bg-stone-100 p-0.5" role="group" aria-label="What to read the colours from">
        {(['image', 'site'] as Source[]).map(option => (
          <button
            key={option}
            type="button"
            disabled={working}
            aria-pressed={source === option}
            onClick={() => reset(option)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              source === option
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {option === 'image' ? 'A picture' : 'A website'}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <label htmlFor="palette-url" className="sr-only">
          {isSite ? 'Website address' : 'Image address'}
        </label>
        <input
          id="palette-url"
          type="url"
          inputMode="url"
          value={url}
          disabled={working}
          placeholder={isSite ? 'https://example.com' : 'https://i.imgur.com/yourimage.png'}
          onChange={e => {
            // The image normaliser repairs copy-paste damage in an address that
            // was copied. A typed website address has not been damaged, and
            // rewriting it under the user's cursor is worse than leaving it.
            setUrl(isSite ? e.target.value : normalizeImageUrl(e.target.value));
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
          {working ? (isSite ? 'Reading that site…' : 'Reading the colours…') : 'Get the colours'}
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
            Both are built from the same source. Everything stays editable
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

          {/* §6d step 4 — what we did and why it is not the same font. Naming
              the limit is the difference between a substitution that reads as
              competence and one that reads as a mistake. */}
          {extraction.notes.length > 0 && (
            <ul className="mt-3 space-y-1">
              {extraction.notes.map(note => (
                <li key={note.text} className="text-[11px] text-stone-500 leading-relaxed">
                  {note.text}
                </li>
              ))}
            </ul>
          )}

          {/* §5d — the single most common rejection in the product, turned into
              a partial win. A Discord CDN address fails AO3's URI grammar and
              always will, and it is still a perfectly good picture to read
              colours from. Saying both things is the whole value. */}
          {extraction.bannerCandidate && extraction.reading && (
            extraction.bannerOk ? (
              <label className="mt-3 flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAsBanner}
                  onChange={e => setUseAsBanner(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-xs text-stone-600 leading-relaxed">
                  Also put {extraction.source === 'site' ? "that site's picture" : 'this picture'} behind
                  the header. AO3 accepts this address, and we&apos;ve measured the
                  image — the title will be{' '}
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
            )
          )}
        </div>
      )}

      {/* The honesty line, and it is the same argument as the font caveat in
          ThemeEditor: a skin is colours. Naming the limit is what stops the
          feature over-promising, and §3 says the promise is where this feature
          succeeds or fails. The second sentence differs by door because the two
          doors do different things: a picture is read in the browser, a website
          is read by our server. */}
      <p className="mt-3 text-[11px] text-stone-400 leading-relaxed">
        A skin can carry colours, not layout — AO3 fixes that, and it can only
        ask for fonts a reader already has.{' '}
        {isSite
          ? 'The address you paste is sent to our server, which reads that page once to find its colours. Neither the address nor the page is stored.'
          : 'Your picture is read in your browser; nothing about it is saved.'}
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
      aria-label="Build colours from a picture or a website"
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-stone-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold">Colours from a picture or a website</h3>
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
