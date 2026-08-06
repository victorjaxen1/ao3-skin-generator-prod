/**
 * AO3's CSS allowlist, copied verbatim from otwarchive.
 *
 * Source: config/config.yml on otwcode/otwarchive master, fetched 6 August 2026.
 *   SUPPORTED_CSS_PROPERTIES           -> AO3_PROPERTIES (181 entries)
 *   SUPPORTED_CSS_SHORTHAND_PROPERTIES -> AO3_SHORTHANDS (20 entries)
 *
 * This is DATA, not judgement. Do not add entries because a property "should"
 * work — AO3 rejects the whole skin with an error when it meets a property it
 * does not know, so a guess here becomes a save failure for the user.
 *
 * Re-check against upstream before each release; AO3 does change these lists.
 */

export const AO3_PROPERTIES: readonly string[] = [
  '-replace', '-use-link-source', 'accelerator', 'accent-color',
  'align-content', 'align-items', 'align-self', 'alignment-adjust',
  'alignment-baseline', 'appearance', 'azimuth', 'baseline-shift',
  'behavior', 'binding', 'bookmark-label', 'bookmark-level',
  'bookmark-target', 'bottom', 'box-align', 'box-direction',
  'box-flex', 'box-flex-group', 'box-lines', 'box-orient',
  'box-pack', 'box-shadow', 'box-sizing', 'caption-side',
  'clear', 'clip', 'color', 'color-profile',
  'color-scheme', 'content', 'counter-increment', 'counter-reset',
  'crop', 'cue', 'cue-after', 'cue-before',
  'cursor', 'direction', 'display', 'dominant-baseline',
  'drop-initial-after-adjust', 'drop-initial-after-align', 'drop-initial-before-adjust', 'drop-initial-before-align',
  'drop-initial-size', 'drop-initial-value', 'elevation', 'empty-cells',
  'fill', 'filter', 'fit', 'fit-position',
  'float', 'float-offset', 'font', 'font-effect',
  'font-emphasize', 'font-emphasize-position', 'font-emphasize-style', 'font-family',
  'font-size', 'font-size-adjust', 'font-smooth', 'font-stretch',
  'font-style', 'font-variant', 'font-weight', 'grid-columns',
  'grid-rows', 'hanging-punctuation', 'height', 'hyphenate-after',
  'hyphenate-before', 'hyphenate-character', 'hyphenate-lines', 'hyphenate-resource',
  'hyphens', 'icon', 'image-orientation', 'image-resolution',
  'ime-mode', 'include-source', 'inline-box-align', 'justify-content',
  'layout-flow', 'left', 'letter-spacing', 'line-break',
  'line-height', 'line-stacking', 'line-stacking-ruby', 'line-stacking-shift',
  'line-stacking-strategy', 'mark', 'mark-after', 'mark-before',
  'marks', 'marquee-direction', 'marquee-play-count', 'marquee-speed',
  'marquee-style', 'max-height', 'max-width', 'min-height',
  'min-width', 'move-to', 'nav-down', 'nav-index',
  'nav-left', 'nav-right', 'nav-up', 'opacity',
  'order', 'orphans', 'page', 'page-policy',
  'phonemes', 'pitch', 'pitch-range', 'play-during',
  'position', 'presentation-level', 'punctuation-trim', 'quotes',
  'rendering-intent', 'resize', 'rest', 'rest-after',
  'rest-before', 'richness', 'right', 'rotation',
  'rotation-point', 'ruby-align', 'ruby-overhang', 'ruby-position',
  'ruby-span', 'size', 'speak', 'speak-header',
  'speak-numeral', 'speak-punctuation', 'speech-rate', 'stress',
  'string-set', 'stroke', 'stroke-width', 'tab-side',
  'table-layout', 'target', 'target-name', 'target-new',
  'target-position', 'top', 'unicode-bibi', 'unicode-bidi',
  'user-select', 'vertical-align', 'visibility', 'voice-balance',
  'voice-duration', 'voice-family', 'voice-pitch', 'voice-pitch-range',
  'voice-rate', 'voice-stress', 'voice-volume', 'volume',
  'white-space', 'white-space-collapse', 'widows', 'width',
  'word-break', 'word-spacing', 'word-wrap', 'writing-mode',
  'z-index',
];

export const AO3_SHORTHANDS: readonly string[] = [
  'background', 'border', 'column', 'cue',
  'flex', 'font', 'layer-background', 'layout-grid',
  'list-style', 'margin', 'marker', 'outline',
  'overflow', 'padding', 'page-break', 'pause',
  'scrollbar', 'text', 'transform', 'transition',
];

/** Vendor prefixes AO3 accepts in front of a supported property. */
export const AO3_VENDOR_PREFIXES: readonly string[] = ['moz', 'ms', 'o', 'webkit'];

/**
 * Properties that may carry a url(). Everything else has its value stripped,
 * which AO3 reports as an error rather than silently dropping.
 */
export const AO3_URL_PROPERTIES: readonly string[] = [
  'background', 'background-image', 'border',
  'border-image', 'list-style', 'list-style-image',
];

/**
 * File extensions AO3 will load through url(). ArchiveConfig
 * SUPPORTED_EXTERNAL_URLS. Note what is absent: webp, svg, avif. Twitter,
 * Discord and most modern CDNs serve webp by default, so this is the second
 * most common reason a pasted banner is refused.
 */
export const AO3_IMAGE_EXTENSIONS: readonly string[] = ['jpg', 'jpeg', 'png', 'gif'];

/**
 * The TLDs AO3 will load an image from, copied verbatim from TOP_LEVEL_DOMAINS
 * in lib/css_cleaner.rb (an ICANN snapshot that has not been refreshed in
 * years).
 *
 * This is DATA, not judgement, and the omissions are the point. There is no
 * `app`, `dev`, `xyz`, `art`, `gallery`, `pics`, `space`, `link`, `page` or
 * `cloud` — and no `moe`, which is why files.catbox.moe, a fandom staple,
 * cannot be used. `io` and `cc` and `co` are present, so github.io, postimg.cc
 * and ibb.co all work.
 */
export const AO3_TLDS: readonly string[] = [
  'ac', 'ad', 'ae', 'aero', 'af', 'ag', 'ai', 'al', 'am', 'an', 'ao', 'aq', 'ar', 'arpa',
  'as', 'asia', 'at', 'au', 'aw', 'ax', 'az', 'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh',
  'bi', 'biz', 'bj', 'bm', 'bn', 'bo', 'br', 'bs', 'bt', 'bv', 'bw', 'by', 'bz', 'ca',
  'cat', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'com', 'coop',
  'cr', 'cu', 'cv', 'cx', 'cy', 'cz', 'de', 'dj', 'dk', 'dm', 'do', 'dz', 'ec', 'edu',
  'ee', 'eg', 'er', 'es', 'et', 'eu', 'fi', 'fj', 'fk', 'fm', 'fo', 'fr', 'ga', 'gb',
  'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gov', 'gp', 'gq', 'gr', 'gs',
  'gt', 'gu', 'gw', 'gy', 'hk', 'hm', 'hn', 'hr', 'ht', 'hu', 'id', 'ie', 'il', 'im',
  'in', 'info', 'int', 'io', 'iq', 'ir', 'is', 'it', 'je', 'jm', 'jo', 'jobs', 'jp',
  'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz', 'la', 'lb', 'lc',
  'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly', 'ma', 'mc', 'md', 'me', 'mg', 'mh',
  'mil', 'mk', 'ml', 'mm', 'mn', 'mo', 'mobi', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu',
  'museum', 'mv', 'mw', 'mx', 'my', 'mz', 'na', 'name', 'nc', 'ne', 'net', 'nf', 'ng',
  'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz', 'om', 'org', 'pa', 'pe', 'pf', 'pg', 'ph',
  'pk', 'pl', 'pm', 'pn', 'pr', 'pro', 'ps', 'pt', 'pw', 'py', 'qa', 're', 'ro', 'rs',
  'ru', 'rw', 'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sj', 'sk', 'sl', 'sm',
  'sn', 'so', 'sr', 'st', 'su', 'sv', 'sy', 'sz', 'tc', 'td', 'tel', 'tf', 'tg', 'th',
  'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tp', 'tr', 'travel', 'tt', 'tv', 'tw', 'tz',
  'ua', 'ug', 'uk', 'us', 'uy', 'uz', 'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu', 'wf',
  'ws', 'xn', 'xxx', 'ye', 'yt', 'za', 'zm', 'zw',
];

/**
 * Media values AO3 allows — chosen in AO3's own skin form, NOT written as
 * @media blocks in the CSS. See Skin::MEDIA.
 */
export const AO3_MEDIA: readonly string[] = [
  'all', 'screen', 'handheld', 'speech', 'print', 'braille',
  'embossed', 'projection', 'tty', 'tv',
  'only screen and (max-width: 42em)',
  'only screen and (max-width: 62em)',
  '(prefers-color-scheme: dark)',
  '(prefers-color-scheme: light)',
];
