import { Attachment, ImageLayoutChoice, Message, SkinProject, TwitterQuotePost } from './schema';
import { sanitizeAttribute, sanitizeText, sanitizeUrl, formatMessageText } from './sanitize';
import { PLATFORM_ASSETS, FALLBACK_TEXT } from './platformAssets';
import { resolveMessageIdentity } from './identity';
import { emojiMessageSize } from './emoji';
import {
  calculateTwitterPollPercentages,
  normalizeTwitterScene,
  normalizeYouTubeUrl,
  resolveTwitterTheme,
} from './twitter';
import {
  isSameWhatsAppRun,
  WHATSAPP_PARTICIPANT_TONES,
  whatsappMessageLabel,
  whatsappToneForMessage,
} from './whatsapp';
import {
  IOS_PARTICIPANT_TONES,
  isSameIOSRun,
  iosMessageLabel,
  iosToneForMessage,
} from './ios';
import { ImageLayoutPlan, ImageSplit, resolveImageLayout } from './imageLayout';

export type HtmlRenderMode = 'static' | 'ao3-work';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Rich-text formatting inside a message bubble — bold, code, quotes, lists.
 *
 * `bubbleFontPx` exists because this block is shared by iOS and Android whose
 * bubbles are different sizes (15px and 14px). An `em` is relative to the
 * element's own font size, so there is no single number that is correct for
 * both — the caller has to say which bubble this is going into. Getting that
 * wrong does not fail any lint; it just makes one platform's code blocks the
 * wrong size.
 *
 * `code` is the fiddly one: it sets `font-size:0.9em`, so its *own* padding and
 * radius resolve against 0.9 x the bubble, not the bubble. `pre` and the block
 * elements resolve against the bubble itself.
 */
/**
 * COLOUR LIVES IN A TABLE, NOT IN THE RULE BODIES. This is the first of four
 * such tables — one per stylesheet, plus this shared block — and the convention
 * is the same in all of them:
 *
 *   - both variants sit side by side, so light and dark are readable against
 *     each other rather than being twenty separate ternaries;
 *   - the builder resolves the theme exactly once, into `colour`;
 *   - **no rule body mentions `isDark`.** That is the invariant. `grep isDark`
 *     inside a template literal should return nothing.
 *
 * The reason is not tidiness. Night mode in the canonical community skin is
 * *five rules*, because its base stylesheet defines structure only and colour
 * is layered on top. Ours bakes one theme throughout, which is why a quarter to
 * a third of our rules are settings-dependent. With both palettes reachable as
 * data, a dark override block can be *derived* by diffing the two — which is
 * what makes the master skin's light/dark variants a handful of rules per
 * platform instead of a doubled stylesheet. See WORK-SKIN §10b, KNOWLEDGE §18.
 *
 * The compiled CSS must not move a byte when you edit these tables. If it does,
 * you changed a colour by accident.
 */
const TEXT_FORMATTING_COLOURS = {
  light: {
    codeBlockBg: 'rgba(0,0,0,0.05)',
    codeBorder: 'rgba(0,0,0,0.1)',
    blockquoteBorder: 'rgba(0,0,0,0.3)',
    blockquoteBg: 'rgba(0,0,0,0.03)',
  },
  dark: {
    codeBlockBg: 'rgba(255,255,255,0.1)',
    codeBorder: 'rgba(255,255,255,0.15)',
    blockquoteBorder: 'rgba(255,255,255,0.4)',
    blockquoteBg: 'rgba(255,255,255,0.05)',
  },
} as const;

function getTextFormattingCSS(isDark: boolean = false, bubbleFontPx: number = 15): string {
  const colour = TEXT_FORMATTING_COLOURS[isDark ? 'dark' : 'light'];

  const b = (px: number) => emFromPx(px, bubbleFontPx);        // against the bubble
  const c = (px: number) => emFromPx(px, bubbleFontPx * 0.9);  // against `code`, at 0.9em

  return `
#workskin dd.bubble strong,#workskin dd.bubble b{font-weight:700;}
#workskin dd.bubble em,#workskin dd.bubble i{font-style:italic;}
#workskin dd.bubble s,#workskin dd.bubble strike,#workskin dd.bubble del{text-decoration:line-through;}
#workskin dd.bubble code{font-family:'SF Mono','Menlo','Monaco','Consolas',monospace;font-size:0.9em;background:${colour.codeBlockBg};padding:${c(2)} ${c(5)};border-radius:${c(4)};border:1px solid ${colour.codeBorder};}
#workskin dd.bubble pre{margin:${b(8)} 0;padding:0;}
#workskin dd.bubble pre code{display:block;padding:${c(8)} ${c(10)};white-space:pre-wrap;word-break:break-word;border-radius:${c(6)};}
#workskin dd.bubble blockquote{margin:${b(6)} 0;padding:${b(4)} 0 ${b(4)} ${b(10)};border-left:3px solid ${colour.blockquoteBorder};background:${colour.blockquoteBg};font-style:italic;}
#workskin dd.bubble ul,#workskin dd.bubble ol{margin:${b(6)} 0;padding-left:${b(20)};}
#workskin dd.bubble li{margin:${b(2)} 0;}
#workskin dd.bubble ul{list-style-type:disc;}
#workskin dd.bubble ol{list-style-type:decimal;}`;
}

/**
 * Text that is invisible while the work skin is on, and reads as ordinary prose
 * the moment it is off.
 *
 * This is the community-standard pattern — the iOS text-message tutorial calls
 * it `.hide` and every established social-media work skin uses some version of
 * it — and it exists because a work skin is absent far more often than authors
 * expect. AO3's own FAQ says it twice: "downloaded works don't retain their
 * work skin", and readers can disable custom work skins in their preferences.
 * Every EPUB, PDF and MOBI download is a skin-off rendering.
 *
 * We diverge from the community on the hiding technique. They use
 * `display: none`, which also hides the text from screen readers; we position
 * it off-screen, so the connective prose is available to assistive technology
 * even while the skin is on. Same visual result, strictly more accessible.
 *
 * Do NOT reimplement this with `content:` on a pseudo-element, which is the
 * other pattern the tutorials teach. html2canvas cannot rasterise `::before` /
 * `::after`, and this stylesheet also drives the PNG export — anything moved
 * into a pseudo-element disappears from the image.
 */
function srOnly(text: string): string {
  return `<span class="visually-hidden">${text}</span>`;
}

/**
 * The rule that makes srOnly() work, and the only mechanism the whole skin-off
 * story rests on. One definition, interpolated into all four stylesheets —
 * it used to be three copies of a line, and the copies were the wrong recipe.
 *
 * This is the WCAG-standard clip pattern, and it is not a theoretical choice:
 * it was read out of CSS AO3 is currently serving, so the archive demonstrably
 * keeps every declaration in it. `clip` is on AO3's supported-property list and
 * `rect()` reaches VALUE_REGEX through its shape-function branch.
 *
 * We used to write `position:absolute;left:-9999px`. That works, but the
 * off-screen technique can create horizontal overflow, is handled
 * inconsistently by assistive technology, and on a right-to-left page pushes
 * the hidden text back into view. Clipping has none of those problems.
 *
 * `width:1px` is ours: the published skin omits it, and without a width the
 * box is free to be as wide as its text.
 */
const VISUALLY_HIDDEN_CSS =
  '#workskin .visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}';

/**
 * Make an injected paragraph harmless.
 *
 * AO3 stuffs `<p>` and `<br>` into work HTML at line breaks — and *how much* it
 * injects depends partly on how the user pastes into the editor, which is not
 * something our output can control. Without this, an injected `<p>` inherits
 * `.userstuff p`'s margins and pushes the layout apart.
 *
 * Five independently written community skins reset paragraphs (`.tw p`,
 * `.spotify-cont-outer p`, `.snap-cont p`, `.polaroid p`, `.tunglebody p`), and
 * the canonical Twitter skin's author names it as their main defence precisely
 * because it does not depend on the markup being perfect. It is the first thing
 * an experienced AO3 skin author writes.
 *
 * NOTE ON SPECIFICITY. This is `#workskin .chat p` (0,1,1,1), which outranks a
 * plain `#workskin .some-class` (0,1,1,0). Google's own two paragraphs are
 * therefore written as `#workskin p.search-stats` — same specificity, later in
 * the sheet, so they win. Any future rule targeting a real `<p>` of ours needs
 * the same treatment.
 */
const PARAGRAPH_RESET_CSS = '#workskin .chat p{margin:0;padding:0;}';

/**
 * A pixel length as em, for the values that reach the stylesheet from settings
 * rather than being written in it.
 *
 * `maxWidthPx` is configured in pixels and interpolated straight into the CSS,
 * so it is the one length a find-and-replace over the stylesheet cannot reach.
 * Dividing by the 16px browser default keeps it identical in the preview and
 * the PNG while letting it scale with the reader on AO3, where `.userstuff`
 * computes to roughly 15px.
 *
 * Three decimal places, never more. AO3's number grammar is
 * `-?\.?\d{1,3}\.?\d{0,3}`, so `0.9375em` is read as `0.937` followed by `5em`
 * and the declaration is thrown away. `parseFloat` also drops trailing zeros,
 * which keeps `37.500em` out of the output.
 */
function emFromPx(px: number, base = 16): string {
  return `${parseFloat((px / base).toFixed(3))}em`;
}

/**
 * WhatsApp's delivery ticks, with the intrinsic size each one needs.
 *
 * The CSS sizes these by height with `width:auto`, which is fine until the skin
 * is off and nothing is sizing them at all. The four sources are 140x144,
 * 91x83, 116x95 and 117x105 — four different aspect ratios — so a single width
 * attribute would squash three of them. At the 14px height the CSS asks for,
 * they come out 14, 15, 17 and 16 wide.
 */
const WHATSAPP_TICKS = {
  sending: { src: PLATFORM_ASSETS.whatsapp.checkmarkSending, width: 14 },
  sent: { src: PLATFORM_ASSETS.whatsapp.checkmarkSent, width: 15 },
  delivered: { src: PLATFORM_ASSETS.whatsapp.checkmarkDelivered, width: 17 },
  read: { src: PLATFORM_ASSETS.whatsapp.checkmarkRead, width: 16 },
} as const;

function iosDeliveryLabel(status: Message['status']): string | undefined {
  if (status === 'read') return 'Read';
  if (status === 'delivered') return 'Delivered';
  if (status === 'sent') return 'Sent';
  if (status === 'sending') return 'Sending…';
  return undefined;
}

function attachmentSizeAttributes(attachment: Attachment, fallbackWidth: number, fallbackHeight: number): string {
  const hasDimensions = Number.isInteger(attachment.intrinsicWidth)
    && Number.isInteger(attachment.intrinsicHeight)
    && (attachment.intrinsicWidth || 0) > 0
    && (attachment.intrinsicHeight || 0) > 0
    && (attachment.intrinsicWidth || 0) <= 100_000
    && (attachment.intrinsicHeight || 0) <= 100_000;
  const width = hasDimensions ? attachment.intrinsicWidth! : fallbackWidth;
  const height = hasDimensions ? attachment.intrinsicHeight! : fallbackHeight;
  return `width="${width}" height="${height}"`;
}

interface ImageComposition {
  images: Attachment[];
  plan: ImageLayoutPlan;
  html: string;
}

/** Build finite, class-only collage markup that AO3 can retain verbatim. */
function imageCompositionHTML(
  attachments: Attachment[] | undefined,
  requested: ImageLayoutChoice | undefined,
  renderImage: (attachment: Attachment, index: number) => string,
): ImageComposition | null {
  const images = (attachments || [])
    .filter(attachment => attachment.type === 'image' && attachment.url.trim())
    .slice(0, 4);
  if (!images.length) return null;

  const plan = resolveImageLayout(images, requested);
  const image = (index: number) => renderImage(images[index], index);
  const splitClass = (split: ImageSplit) => `image-split-${split.bucket}`;
  const row = (first: number, second: number, split: ImageSplit, last = true) =>
    `<span class="image-layout-row ${splitClass(split)}${last ? ' image-layout-last-row' : ''}"><span class="image-layout-cell image-layout-first">${image(first)}</span><span class="image-layout-cell image-layout-second">${image(second)}</span></span>`;

  let html: string;
  if (plan.layout === 'single') {
    html = image(0);
  } else if (plan.layout === 'stack') {
    html = images.map((_, index) => `<span class="image-layout-stack-item${index === images.length - 1 ? ' image-layout-last-item' : ''}">${image(index)}</span>`).join('');
  } else if (plan.layout === 'pair') {
    html = row(0, 1, plan.splits[0]);
  } else if (plan.layout === 'hero-top') {
    html = `<span class="image-layout-feature">${image(0)}</span>${row(1, 2, plan.splits[0])}`;
  } else if (plan.layout === 'hero-side') {
    html = `<span class="image-layout-columns ${splitClass(plan.splits[0])}"><span class="image-layout-column image-layout-first">${image(0)}</span><span class="image-layout-column image-layout-second"><span class="image-layout-side-item">${image(1)}</span><span class="image-layout-side-item image-layout-last-item">${image(2)}</span></span></span>`;
  } else {
    html = `${row(0, 1, plan.splits[0], false)}${row(2, 3, plan.splits[1])}`;
  }
  return { images, plan, html };
}

function imageCompositionCSS(scope: string): string {
  const selector = `#workskin ${scope}`;
  return `${selector} .image-layout-row,${selector} .image-layout-columns{display:block;width:100%;font-size:0;overflow:hidden;}
${selector} .image-layout-row{margin-bottom:1%;}
${selector} .image-layout-last-row{margin-bottom:0;}
${selector} .image-layout-cell,${selector} .image-layout-column{display:inline-block;vertical-align:top;overflow:hidden;}
${selector} .image-layout-first{margin-right:1%;}
${selector} .image-split-33-67 .image-layout-first{width:32.5%;}${selector} .image-split-33-67 .image-layout-second{width:66.5%;}
${selector} .image-split-40-60 .image-layout-first{width:39.5%;}${selector} .image-split-40-60 .image-layout-second{width:59.5%;}
${selector} .image-split-50-50 .image-layout-first{width:49.5%;}${selector} .image-split-50-50 .image-layout-second{width:49.5%;}
${selector} .image-split-60-40 .image-layout-first{width:59.5%;}${selector} .image-split-60-40 .image-layout-second{width:39.5%;}
${selector} .image-split-67-33 .image-layout-first{width:66.5%;}${selector} .image-split-67-33 .image-layout-second{width:32.5%;}
${selector} .image-layout-feature,${selector} .image-layout-stack-item,${selector} .image-layout-side-item{display:block;width:100%;overflow:hidden;}
${selector} .image-layout-feature,${selector} .image-layout-stack-item{margin-bottom:1%;}
${selector} .image-layout-side-item{margin-bottom:2%;}
${selector} .image-layout-last-item{margin-bottom:0;}`;
}

function twitterMediaHTML(
  attachments: Attachment[] | undefined,
  crop: Message['twitterMediaCrop'] = 'auto',
  quote = false,
  requestedLayout?: ImageLayoutChoice,
): string {
  const composition = imageCompositionHTML(attachments, requestedLayout, attachment =>
    `<img src="${sanitizeUrl(attachment.url)}" alt="${attachmentAlt(attachment)}" class="twitter-media-image" ${attachmentSizeAttributes(attachment, 600, 338)} />`
  );
  if (!composition) return '';
  const prefix = quote ? 'quote-media' : 'tweet-media';
  const cropClass = `media-crop-${crop || 'auto'}`;
  return `<div class="${prefix} twitter-media-grid media-count-${composition.images.length} media-layout-${composition.plan.layout} ${cropClass}">${composition.html}</div>`;
}

function resolveQuoteIdentity(project: SkinProject, quote: TwitterQuotePost) {
  const character = quote.characterId
    ? project.cast?.characters.find(candidate => candidate.id === quote.characterId)
    : undefined;
  return {
    name: character?.name || quote.name || 'User',
    handle: (character?.twitterHandle || quote.handle || '').replace(/^@+/, ''),
    avatarUrl: character?.avatarUrl || quote.avatarUrl,
    verified: character ? !!character.verified : !!quote.verified,
  };
}

function twitterQuoteHTML(project: SkinProject, quote: TwitterQuotePost | undefined): string {
  if (!quote) return '';
  const identity = resolveQuoteIdentity(project, quote);
  const avatar = identity.avatarUrl
    ? `<img src="${sanitizeUrl(identity.avatarUrl)}" alt="${sanitizeAttribute(identity.name)} avatar" class="quote-avatar" width="32" height="32" />`
    : '';
  const verified = identity.verified
    ? `<span class="verified-container quote-verified-container"><span class="quote-verified-badge" title="Verified">✔</span></span>`
    : '';
  const handle = identity.handle ? `@${sanitizeText(identity.handle)}` : '';
  const media = twitterMediaHTML(quote.attachments, 'auto', true, quote.imageLayout);
  const timestamp = quote.timestamp ? `<span class="quote-time"> · ${sanitizeText(quote.timestamp)}</span>` : '';
  return `<div class="quote">${srOnly('Quoted post by ')}<div class="quote-head">${avatar}<span class="quote-name">${sanitizeText(identity.name)}</span>${verified}<span class="quote-handle">${handle}</span>${timestamp}</div><div class="quote-body">${highlightTwitterText(sanitizeText(quote.text))}${media}</div></div>`;
}

function twitterVideoHTML(msg: Message, mode: HtmlRenderMode): string {
  const video = msg.twitterVideo;
  if (!video) return '';
  const normalized = video.source === 'youtube' ? normalizeYouTubeUrl(video.url) : undefined;
  const sourceUrl = normalized?.canonicalUrl || video.url;
  const safeSource = sanitizeUrl(sourceUrl);
  const title = sanitizeText(video.title || 'Video');
  const safePoster = /^https:\/\//i.test(video.posterUrl || '') ? sanitizeUrl(video.posterUrl) : '';
  const poster = safePoster
    ? `<img src="${safePoster}" alt="Poster for ${sanitizeAttribute(video.title || 'video')}" class="video-poster" width="600" height="338" />`
    : normalized
      ? `<img src="${sanitizeUrl(`https://i.ytimg.com/vi/${normalized.videoId}/hqdefault.jpg`)}" alt="YouTube thumbnail for ${sanitizeAttribute(video.title || 'video')}" class="video-poster" width="480" height="360" />`
    : `<span class="video-poster-placeholder" aria-hidden="true">Video</span>`;
  const duration = video.duration ? `<span class="video-duration">${sanitizeText(video.duration)}</span>` : '';
  const description = video.description ? `<div class="video-description">${sanitizeText(video.description)}</div>` : '';
  const captions = video.captionTrackUrl
    ? `<div class="video-captions">Captions: <a href="${sanitizeUrl(video.captionTrackUrl)}">${sanitizeText(video.captionLabel || video.captionLanguage || 'caption track')}</a></div>`
    : '';
  if (mode === 'ao3-work') {
    if (video.source === 'youtube' && normalized) {
      return `<div class="twitter-video-card twitter-video-player">${srOnly('Video: ')}<iframe src="${sanitizeUrl(normalized.embedUrl)}" title="${sanitizeAttribute(video.title || 'YouTube video')}" width="560" height="315" frameborder="0" allowfullscreen=""></iframe><b class="video-title">${title}</b>${description}${captions}<div class="video-fallback">Source: <a href="${safeSource}">${sanitizeText(sourceUrl)}</a></div></div>`;
    }
    if (video.source === 'direct' && sanitizeUrl(video.url) && /^video\/(mp4|webm|ogg)$/i.test(video.mimeType || '')) {
      const posterAttribute = safePoster ? ` poster="${safePoster}"` : '';
      const track = video.captionTrackUrl
        ? `<track src="${sanitizeUrl(video.captionTrackUrl)}" kind="captions" srclang="${sanitizeAttribute(video.captionLanguage)}" label="${sanitizeAttribute(video.captionLabel)}" default="default">`
        : '';
      return `<div class="twitter-video-card twitter-video-player">${srOnly('Video: ')}<video class="twitter-native-video" title="${sanitizeAttribute(video.title || 'Video')}" width="560" controls="controls" crossorigin="anonymous" preload="metadata" playsinline="playsinline"${posterAttribute}><source src="${safeSource}" type="${sanitizeAttribute(video.mimeType)}">${track}Your browser cannot play this video. <a href="${safeSource}">Open the video source.</a></video><b class="video-title">${title}</b>${description}${captions}<div class="video-fallback">Source: <a href="${safeSource}">${sanitizeText(sourceUrl)}</a></div></div>`;
    }
  }
  return `<div class="twitter-video-card">${srOnly('Video: ')}<a href="${safeSource}" class="video-source"><span class="video-poster-wrap">${poster}<span class="video-play" aria-hidden="true">▶</span>${duration}</span><b class="video-title">${title}</b></a>${description}${captions}<div class="video-fallback">Source: <a href="${safeSource}">${sanitizeText(sourceUrl)}</a></div></div>`;
}

function twitterPollHTML(msg: Message): string {
  const poll = msg.twitterPoll;
  if (!poll) return '';
  const percentages = calculateTwitterPollPercentages(poll);
  const max = Math.max(...percentages);
  const options = poll.options.slice(0, 4).map((option, index) => {
    const percent = percentages[index] || 0;
    const widthClass = `poll-pct-${Math.max(0, Math.min(100, Math.round(percent / 5) * 5))}`;
    const selected = option.id === poll.selectedOptionId;
    const winner = poll.state === 'closed' && percent === max && max > 0;
    const state = [selected ? 'Selected' : '', winner ? 'Winner' : ''].filter(Boolean).join(', ');
    return `<div class="poll-option ${selected ? 'selected' : ''} ${winner ? 'winner' : ''}"><span class="poll-bar ${widthClass}"></span><span class="poll-option-text">${sanitizeText(option.text)}</span><b class="poll-percent">${percent}%</b>${state ? `<span class="poll-state"> ${state}</span>` : ''}</div>`;
  }).join('');
  const totalVotes = poll.totalVotes ?? poll.options.reduce((sum, option) => sum + (option.votes || 0), 0);
  const footerParts = [
    totalVotes ? `${formatNumber(totalVotes)} votes` : '',
    poll.state === 'open' ? poll.timeRemaining || 'Poll open' : poll.finalLabel || 'Final results',
  ].filter(Boolean);
  return `<div class="twitter-poll" aria-label="${poll.state === 'open' ? 'Open' : 'Closed'} poll">${options}<div class="poll-footer">${sanitizeText(footerParts.join(' · '))}</div></div>`;
}

function twitterActivityHTML(project: SkinProject, msg: Message): string {
  const activity = msg.twitterActivity;
  if (!activity) return '';
  const names = activity.actorCharacterIds
    .map(id => project.cast?.characters.find(character => character.id === id)?.name)
    .filter((name): name is string => !!name);
  const first = names[0] || 'Someone';
  const others = Math.max(0, names.length - 1 + (activity.additionalCount || 0));
  const actorText = others ? `${first} and ${others} ${others === 1 ? 'other' : 'others'}` : first;
  return `<div class="tweet-activity"><span aria-hidden="true">${activity.type === 'liked' ? '♡' : '⇄'}</span> ${sanitizeText(actorText)} ${activity.type === 'liked' ? 'liked' : 'reposted'}</div>`;
}

function applyBoldMarkup(raw: string): string {
  return raw.replace(/\*([^*]+)\*/g, '<b>$1</b>');
}

/**
 * Plausible "About N results (T seconds)" for a query.
 *
 * Derived from the query so it stays put while you edit everything else, and
 * so two different searches don't claim the identical result count.
 */
export function generateSearchStats(query: string): { count: string; time: string } {
  let hash = 2166136261;
  const seed = query.trim().toLowerCase() || 'search';
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // The hash is 32-bit, so this spans roughly 1.2M–2.1B results — the range
  // Google reports for anything from a niche phrase to a common one.
  const positive = Math.abs(hash);
  const count = 1_200_000 + positive;
  const seconds = (20 + (positive % 75)) / 100; // 0.20–0.94s
  return {
    count: `About ${count.toLocaleString('en-US')} results`,
    time: `${seconds.toFixed(2)} seconds`,
  };
}

function highlightHashtags(text: string): string {
  return text.replace(/(#\w+)/g, '<span class="hashtag">$1</span>');
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.floor(num / 1000000)}M` : `${formatted}M`;
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.floor(num / 1000)}K` : `${formatted}K`;
  }
  return num.toString();
}

function highlightMentions(text: string): string {
  return text.replace(/(@\w+)/g, '<span class="mention">$1</span>');
}

function highlightTwitterText(text: string): string {
  // Apply both hashtag and mention highlighting
  let result = highlightHashtags(text);
  result = highlightMentions(result);
  return result;
}

/**
 * The three-dot indicator, as a row.
 *
 * One copy, used by both the chat-level `chatShowTyping` setting and the
 * per-message `isTyping` flag, so the two cannot drift. The dots are CSS
 * shapes, which means they are *nothing at all* with the skin off — hence the
 * hidden "… is typing…" line, which for this element is the whole skin-off
 * story (§9a). Do not inline a second copy of this markup.
 */
function typingRowHTML(name?: string): string {
  const named = !!(name && name.trim());
  const label = named ? `<span class="typing-label">${sanitizeText(name!)}</span>` : '';
  return `<div class="row typing"><div class="typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>${label}${srOnly(`${named ? ' is' : 'Someone is'} typing…`)}</div>`;
}

function attachmentAlt(attachment: { alt?: string; decorative?: boolean }): string {
  return attachment.decorative ? '' : sanitizeAttribute(attachment.alt || '');
}

function whatsappReplyHTML(message: Message, project: SkinProject, allMessages: Message[]): string {
  if (!message.whatsappReply) return '';
  const target = allMessages.find(candidate => candidate.id === message.whatsappReply!.messageId);
  if (!target || target.whatsappEvent) {
    return `<blockquote class="wa-reply wa-reply-missing"><b>Original message unavailable</b></blockquote>`;
  }
  const identity = resolveMessageIdentity(project, target);
  const excerpt = target.content.trim().replace(/\s+/g, ' ').slice(0, 180) || whatsappMessageLabel(target);
  const tone = whatsappToneForMessage(project, target);
  return `<blockquote class="wa-reply wa-reply-${tone}"><b>Replying to ${sanitizeText(identity.name)}</b><span>${sanitizeText(excerpt)}</span></blockquote>`;
}

function whatsappImagesHTML(message: Message): string {
  const composition = imageCompositionHTML(message.attachments, message.imageLayout, (attachment, index) =>
    `<img src="${sanitizeUrl(attachment.url)}" alt="${attachmentAlt(attachment)}" class="wa-image wa-image-${index + 1}" ${attachmentSizeAttributes(attachment, 600, 400)} />`
  );
  if (!composition) return '';
  return `<span class="wa-images wa-images-${composition.images.length} image-layout-${composition.plan.layout}">${composition.html}</span>`;
}

function whatsappLinkPreviewHTML(message: Message): string {
  const preview = message.whatsappLinkPreview;
  if (!preview) return '';
  const image = preview.image?.url
    ? `<img src="${sanitizeUrl(preview.image.url)}" alt="${attachmentAlt(preview.image)}" class="wa-link-image" width="600" height="315" />`
    : '';
  return `<a class="wa-link-preview" href="${sanitizeAttribute(preview.url)}">${image}<b>${sanitizeText(preview.title)}</b>${preview.description ? `<span class="wa-link-description">${sanitizeText(preview.description)}</span>` : ''}${preview.siteName ? `<span class="wa-link-site">${sanitizeText(preview.siteName)}</span>` : ''}<span class="wa-link-url">${sanitizeText(preview.url)}</span></a>`;
}

function waveformBars(messageId: string): string {
  let seed = [...messageId].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 17);
  return Array.from({ length: 24 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return `<span class="wa-wave-bar wa-wave-${(seed % 6) + 1}"></span>`;
  }).join('');
}

function whatsappMediaHTML(message: Message, renderMode: HtmlRenderMode): string {
  const media = message.whatsappMedia;
  if (!media) return '';
  const normalized = media.kind === 'video' && media.source === 'youtube'
    ? normalizeYouTubeUrl(media.url)
    : undefined;
  const sourceUrl = normalized?.canonicalUrl || media.url;
  const safeSource = sanitizeUrl(sourceUrl);
  const playableSource = /^https:\/\//i.test(media.url) && !!safeSource;
  const sourceFallback = safeSource
    ? `<a class="wa-media-source" href="${safeSource}">${media.kind === 'audio' ? 'Audio' : 'Video'} source</a>`
    : '';
  if (media.kind === 'audio') {
    const transcript = media.transcript ? `<span class="wa-transcript">Transcript: ${sanitizeText(media.transcript)}</span>` : '';
    if (renderMode === 'ao3-work' && playableSource) {
      return `<span class="wa-media wa-audio wa-media-player"><audio class="wa-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata"><source src="${safeSource}" type="${sanitizeAttribute(media.mimeType)}">Voice message: <a href="${safeSource}">open the audio file</a>.</audio><span class="wa-duration">${sanitizeText(media.duration || 'Voice message')}</span>${transcript}${sourceFallback}</span>`;
    }
    return `<span class="wa-media wa-audio"><span class="wa-play">▶</span><span class="wa-waveform">${waveformBars(message.id)}</span><span class="wa-duration">${sanitizeText(media.duration || 'Voice message')}</span>${transcript}${sourceFallback}</span>`;
  }
  const safePoster = /^https:\/\//i.test(media.posterUrl || '') ? sanitizeUrl(media.posterUrl) : '';
  const poster = safePoster
    ? `<img src="${safePoster}" alt="Video poster" class="wa-video-poster" width="600" height="338" />`
    : normalized
      ? `<img src="${sanitizeUrl(`https://i.ytimg.com/vi/${normalized.videoId}/hqdefault.jpg`)}" alt="YouTube video thumbnail" class="wa-video-poster" width="480" height="360" />`
      : `<span class="wa-video-placeholder">Video</span>`;
  const track = media.source === 'direct' && media.captionTrackUrl
    ? `<track src="${sanitizeUrl(media.captionTrackUrl)}" kind="captions" srclang="${sanitizeAttribute(media.captionLanguage || '')}" label="${sanitizeAttribute(media.captionLabel || '')}" default="default">`
    : '';
  const description = media.description ? `<span class="wa-media-description">${sanitizeText(media.description)}</span>` : '';
  const captions = media.source === 'direct' && media.captionTrackUrl ? `<span class="wa-captions">Captions: <a href="${sanitizeUrl(media.captionTrackUrl)}">${sanitizeText(media.captionLabel || media.captionLanguage || 'caption track')}</a></span>` : '';
  if (renderMode === 'ao3-work' && media.source === 'youtube' && normalized) {
    return `<span class="wa-media wa-video wa-media-player wa-youtube-player"><iframe src="${sanitizeUrl(normalized.embedUrl)}" title="WhatsApp YouTube video" width="560" height="315" frameborder="0" allowfullscreen=""></iframe><span class="wa-duration">${sanitizeText(media.duration || 'YouTube video')}</span>${description}${sourceFallback}</span>`;
  }
  if (renderMode === 'ao3-work' && media.source === 'direct' && playableSource) {
    return `<span class="wa-media wa-video wa-media-player"><video class="wa-native-video" title="WhatsApp video" controls="controls" crossorigin="anonymous" preload="metadata" playsinline="playsinline"${safePoster ? ` poster="${safePoster}"` : ''} width="600" height="338"><source src="${safeSource}" type="${sanitizeAttribute(media.mimeType)}">${track}Video: <a href="${safeSource}">open the video file</a>.</video><span class="wa-duration">${sanitizeText(media.duration || 'Video')}</span>${description}${captions}${sourceFallback}</span>`;
  }
  return `<span class="wa-media wa-video${normalized ? ' wa-video-youtube' : ''}">${poster}<span class="wa-video-play">▶</span><span class="wa-duration">${sanitizeText(media.duration || (normalized ? 'YouTube video' : 'Video'))}</span>${description}${captions}${sourceFallback}</span>`;
}

function whatsappReactionsHTML(message: Message): string {
  const reactions = message.whatsappReactions || [];
  if (!reactions.length) return '';
  const text = reactions.map(reaction => `${reaction.emoji}${(reaction.count || 1) > 1 ? ` ×${reaction.count}` : ''}`).join(' ');
  return `<span class="wa-reactions">${srOnly('Reactions: ')}${sanitizeText(text)}</span>`;
}

function whatsappEventHTML(message: Message): string {
  const event = message.whatsappEvent;
  if (!event) return '';
  return `<div class="wa-event wa-event-${event.kind}" data-message-id="${sanitizeAttribute(message.id)}"><dl><dd>${sanitizeText(event.text)}</dd></dl></div>`;
}

function whatsappMessageHTML(message: Message, project: SkinProject, options: { index: number; allMessages: Message[]; sourceMessages?: Message[]; renderMode: HtmlRenderMode }): string {
  if (message.whatsappEvent) return whatsappEventHTML(message);
  if (message.isTyping) return typingRowHTML(message.sender);
  const previous = options.index > 0 ? options.allMessages[options.index - 1] : undefined;
  const next = options.index < options.allMessages.length - 1 ? options.allMessages[options.index + 1] : undefined;
  const startsRun = !isSameWhatsAppRun(project, previous, message);
  const endsRun = !isSameWhatsAppRun(project, message, next);
  const groupClass = startsRun && endsRun ? 'single' : startsRun ? 'first' : endsRun ? 'last' : 'middle';
  const identity = resolveMessageIdentity(project, message);
  // The avatar beside the name, mirroring the iOS group sender exactly.
  //
  // WhatsApp group messages never drew one. The reported symptom read as an
  // AO3 problem — inline styles being stripped — but the inline-styled avatar
  // code in the old shared `msgHTML` was unreachable for this platform:
  // `msgHTML` returns to `whatsappMessageHTML` before it ever gets there. The
  // markup simply had no avatar in it, on the archive or anywhere else.
  //
  // Like iOS, it resolves from the canonical scene character, so renaming or
  // re-picturing someone in the People panel updates messages already written.
  //
  // The tone is a finite enum compiled to a class, never a free hex in a
  // `style` attribute: AO3 strips inline styles outright, so a hex would reach
  // the preview and the PNG and be dropped on the archive. `wa-tone-*` already
  // exists and already carries the participant's colour.
  const groupTone = whatsappToneForMessage(project, message);
  const groupAvatar = project.settings.androidGroupMode && !message.outgoing
    ? identity.avatarUrl
      ? `<img src="${sanitizeUrl(identity.avatarUrl)}" alt="" class="group-avatar" width="20" height="20" /> `
      : `<span class="group-avatar-initials">${sanitizeText(identity.name.substring(0, 2).toUpperCase())}</span> `
    : '';
  const groupSender = project.settings.androidGroupMode && !message.outgoing
    // Keep a real separator in the source. With the skin enabled this element
    // is block-level, while skin-off/downloaded HTML needs the space so the
    // participant name cannot weld itself to the first word of the message.
    //
    // The avatar sits INSIDE the name element, which is where WhatsApp differs
    // from iMessage. `.group-sender` is display:block here, so the sender gets
    // a line of its own above the message — that is WhatsApp's layout and it
    // predates this change. A sibling avatar, the way the iOS renderer does it,
    // would be pushed onto a line by itself by that block. Nesting keeps the
    // avatar and the name on the one line and leaves the message where it was.
    ? `<b class="group-sender wa-tone-${groupTone}">${groupAvatar}${sanitizeText(identity.name)}</b> `
    : '';
  const hiddenSpeaker = groupSender ? '' : `<dt class="visually-hidden">${sanitizeText(identity.name)}: </dt>`;
  const reply = whatsappReplyHTML(message, project, options.sourceMessages || options.allMessages);
  const images = whatsappImagesHTML(message);
  const link = whatsappLinkPreviewHTML(message);
  const media = whatsappMediaHTML(message, options.renderMode);
  const emojiSize = emojiMessageSize(message.content, !!(images || link || media));
  const text = message.content.trim()
    ? emojiSize
      ? `<span class="emoji-content ${emojiSize}">${formatMessageText(message.content)}</span>`
      : `<span class="message-text">${formatMessageText(message.content)}</span>`
    : '';
  const time = message.timestamp ? `${srOnly(' ')}<span class="time">${sanitizeText(message.timestamp)}</span>` : '';
  const tick = message.outgoing && project.settings.androidCheckmarks && message.status
    ? `<span class="wa-ticks wa-ticks-${message.status}">${message.status === 'sending' ? '◷' : message.status === 'sent' ? '✓' : '✓✓'}</span>`
    : '';
  const reactions = whatsappReactionsHTML(message);
  const classes = [
    'bubble', message.outgoing ? 'out' : 'in', endsRun ? 'has-tail' : 'no-tail',
    images ? 'image-bubble' : '', images && (message.attachments || []).filter(attachment => attachment.url.trim()).length > 1 ? 'multi-image-bubble' : '',
    reply ? 'has-reply' : '', link ? 'has-link' : '',
    media ? 'has-media' : '', reactions ? 'has-reaction' : '', emojiSize ? `emoji-only ${emojiSize}` : '',
  ].filter(Boolean).join(' ');
  return `<div class="row ${message.outgoing ? 'out' : 'in'} ${groupClass}" data-message-id="${sanitizeAttribute(message.id)}"><dl class="msg">${hiddenSpeaker}<dd class="${classes}">${groupSender}${reply}${text}${images}${link}${media}${time}${tick}${reactions}</dd></dl></div>`;
}


/* ==========================================================================
   The iOS renderer.
   --------------------------------------------------------------------------
   Extracted from the shared `msgHTML` path, where iMessage markup sat beside
   three other platforms and every new content block risked breaking the image,
   timestamp, tail, and Tapback behaviour already working there (§2.2, P0).

   Every new class is `ios-*` even though all of this already lives inside
   `.chat.ios`. That is deliberate: the master skin puts four platforms in one
   cascade, and a prefixed class makes a collision something you can grep for
   rather than something you notice as a wrong-looking render.
   ========================================================================== */

/** Resolve a reply against the *whole scene*, not just the chunk being drawn. */
function iosReplyHTML(message: Message, project: SkinProject, sourceMessages: Message[]): string {
  if (!message.iosReply) return '';
  const target = sourceMessages.find(candidate => candidate.id === message.iosReply!.messageId);
  // A dangling pointer says so out loud rather than rendering an empty quote.
  // Preflight blocks the export on the same condition, so this is what an
  // author sees while they still have the chance to fix it.
  if (!target || target.iosEvent) {
    return `<blockquote class="ios-reply ios-reply-missing"><b>Original message unavailable</b></blockquote>`;
  }
  const identity = resolveMessageIdentity(project, target);
  // Derived at render time, never copied into storage: editing the target or
  // renaming its speaker updates every reply that points at it.
  const excerpt = target.content.trim().replace(/\s+/g, ' ').slice(0, 180) || iosMessageLabel(target);
  const tone = iosToneForMessage(project, target);
  const thumbSource = target.attachments?.[0]?.url
    || (target.iosMedia?.kind === 'video' ? target.iosMedia.posterUrl : undefined);
  const thumb = thumbSource && sanitizeUrl(thumbSource)
    ? `<img src="${sanitizeUrl(thumbSource)}" alt="" class="ios-reply-thumb" width="40" height="40" />`
    : '';
  // The literal spaces are the skin-off story (§4a). These children are
  // block-level with the skin on, so the whitespace costs nothing there and is
  // ignored between flex items — but in a download it is the only thing between
  // "Replying to Alex" and the quoted text, which otherwise read as one word.
  return `<blockquote class="ios-reply ios-reply-${tone}">${thumb}<b>Replying to ${sanitizeText(identity.name)}</b> <span>${sanitizeText(excerpt)}</span> </blockquote>`;
}

/**
 * One to four images, every one of them a real `<img>` with its own alt text.
 *
 * Apple hides extras behind a stack you tap. A static work cannot be tapped, so
 * a stack would discard story information and leave the skin-off reader with
 * one description out of four (§3.4). The count class picks the collage.
 */
function iosImagesHTML(message: Message): string {
  const composition = imageCompositionHTML(message.attachments, message.imageLayout, (attachment, index) =>
    `<img src="${sanitizeUrl(attachment.url)}" alt="${attachmentAlt(attachment)}" class="ios-image ios-image-${index + 1}" ${attachmentSizeAttributes(attachment, 600, 400)} />`
  );
  if (!composition) return '';
  return `<span class="ios-images ios-images-${composition.images.length} image-layout-${composition.plan.layout}">${composition.html}</span>`;
}

function iosLinkPreviewHTML(message: Message): string {
  const preview = message.iosLinkPreview;
  if (!preview) return '';
  const image = preview.image?.url
    ? `<img src="${sanitizeUrl(preview.image.url)}" alt="${attachmentAlt(preview.image)}" class="ios-link-image" width="600" height="315" />`
    : '';
  // The whole card is the anchor, and the URL survives as visible text so the
  // destination is still readable with the skin off.
  return `<a class="ios-link-preview" href="${sanitizeAttribute(preview.url)}">${image}<b>${sanitizeText(preview.title)}</b> ${preview.description ? `<span class="ios-link-description">${sanitizeText(preview.description)}</span> ` : ''}${preview.siteName ? `<span class="ios-link-site">${sanitizeText(preview.siteName)}</span> ` : ''}<span class="ios-link-url">${sanitizeText(preview.url)}</span> </a>`;
}

/** A deterministic pseudo-waveform. Never probed from the audio file. */
function iosWaveformBars(messageId: string): string {
  let seed = [...messageId].reduce((total, char) => (total * 31 + char.charCodeAt(0)) >>> 0, 23);
  return Array.from({ length: 26 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return `<span class="ios-wave-bar ios-wave-${(seed % 6) + 1}"></span>`;
  }).join('');
}

/**
 * The two-mode media boundary (§0.3).
 *
 * `static` — the live preview, Save PNG, and the ImgBB upload — gets a poster or
 * waveform card and an ordinary link. It must instantiate no player: a preview
 * that autoloads contacts a third-party host the author never agreed to, and
 * html2canvas cannot rasterise native player chrome anyway.
 *
 * `ao3-work` gets the narrowly generated markup AO3 preserves. Neither mode
 * downloads, proxies, transcodes, or rehosts a single byte of media.
 */
function iosMediaHTML(message: Message, renderMode: HtmlRenderMode): string {
  const media = message.iosMedia;
  if (!media) return '';
  const normalized = media.kind === 'video' && media.source === 'youtube'
    ? normalizeYouTubeUrl(media.url)
    : undefined;
  const sourceUrl = normalized?.canonicalUrl || media.url;
  const safeSource = sanitizeUrl(sourceUrl);
  const playableSource = /^https:\/\//i.test(media.url) && !!safeSource;
  const sourceFallback = safeSource
    ? `<a class="ios-media-source" href="${safeSource}">${media.kind === 'audio' ? 'Audio' : 'Video'} source</a>`
    : '';

  if (media.kind === 'audio') {
    const transcript = media.transcript ? `<span class="ios-audio-transcript">Transcript: ${sanitizeText(media.transcript)}</span> ` : '';
    const duration = `<span class="ios-audio-duration">${sanitizeText(media.duration || 'Voice message')}</span> `;
    if (renderMode === 'ao3-work' && playableSource) {
      // The native control is never made transparent or floated over a fake
      // waveform: a reader has to be able to see what they are operating.
      return `<span class="ios-audio-card ios-audio-player"><audio class="ios-native-audio" title="Voice message" controls="controls" crossorigin="anonymous" preload="metadata"><source src="${safeSource}" type="${sanitizeAttribute(media.mimeType)}">Voice message: <a href="${safeSource}">open the audio file</a>.</audio>${duration}${transcript}${sourceFallback}</span>`;
    }
    return `<span class="ios-audio-card"><span class="ios-audio-play">▶</span><span class="ios-waveform">${iosWaveformBars(message.id)}</span>${duration}${transcript}${sourceFallback}</span>`;
  }

  // A malformed optional poster is ignored, never promoted over the derived
  // YouTube thumbnail. Half-typing a poster field must not blank the card.
  const safePoster = /^https:\/\//i.test(media.posterUrl || '') ? sanitizeUrl(media.posterUrl) : '';
  const poster = safePoster
    ? `<img src="${safePoster}" alt="Video poster" class="ios-video-poster" width="600" height="338" />`
    : normalized
      ? `<img src="${sanitizeUrl(`https://i.ytimg.com/vi/${normalized.videoId}/hqdefault.jpg`)}" alt="YouTube video thumbnail" class="ios-video-poster" width="480" height="360" />`
      : `<span class="ios-video-placeholder">Video</span>`;
  const title = media.title?.trim() ? `<span class="ios-video-title">${sanitizeText(media.title)}</span> ` : '';
  const duration = `<span class="ios-video-duration">${sanitizeText(media.duration || (normalized ? 'YouTube video' : 'Video'))}</span> `;
  const description = media.description ? `<span class="ios-media-description">${sanitizeText(media.description)}</span> ` : '';
  const captions = media.source === 'direct' && media.captionTrackUrl
    ? `<span class="ios-captions">Captions: <a href="${sanitizeUrl(media.captionTrackUrl)}">${sanitizeText(media.captionLabel || media.captionLanguage || 'caption track')}</a></span> `
    : '';
  const track = media.source === 'direct' && media.captionTrackUrl
    ? `<track src="${sanitizeUrl(media.captionTrackUrl)}" kind="captions" srclang="${sanitizeAttribute(media.captionLanguage || '')}" label="${sanitizeAttribute(media.captionLabel || '')}" default="default">`
    : '';

  if (renderMode === 'ao3-work' && media.source === 'youtube' && normalized) {
    return `<span class="ios-video-card ios-video-player ios-youtube-player"><iframe src="${sanitizeUrl(normalized.embedUrl)}" title="iMessage YouTube video" width="560" height="315" frameborder="0" allowfullscreen=""></iframe>${title}${duration}${description}${sourceFallback}</span>`;
  }
  if (renderMode === 'ao3-work' && media.source === 'direct' && playableSource) {
    return `<span class="ios-video-card ios-video-player"><video class="ios-native-video" title="iMessage video" controls="controls" crossorigin="anonymous" preload="metadata" playsinline="playsinline"${safePoster ? ` poster="${safePoster}"` : ''} width="600" height="338"><source src="${safeSource}" type="${sanitizeAttribute(media.mimeType)}">${track}Video: <a href="${safeSource}">open the video file</a>.</video>${title}${duration}${description}${captions}${sourceFallback}</span>`;
  }
  return `<span class="ios-video-card${normalized ? ' ios-video-youtube' : ''}">${poster}<span class="ios-video-play">▶</span>${title}${duration}${description}${captions}${sourceFallback}</span>`;
}

/**
 * The Tapback stack, inside the bubble and on the corner away from the tail.
 *
 * Inside `dd.bubble` because the only rule that styles it is a descendant
 * selector — a defect fixed on 8 Aug 2026 when the old single-emoji chip was
 * emitted as a sibling and every tapback rendered as unstyled trailing text.
 */
function iosTapbacksHTML(message: Message): string {
  const tapbacks = message.iosTapbacks || [];
  if (!tapbacks.length) return '';
  const text = tapbacks.map(tapback => `${tapback.emoji}${(tapback.count || 1) > 1 ? ` ${tapback.count}` : ''}`).join(' ');
  return `${srOnly(' ')}<span class="ios-tapbacks">${srOnly('Tapbacks: ')}${sanitizeText(text)}</span>`;
}

/** Events sit outside `dl.msg`, so they can never be mistaken for speech. */
function iosEventHTML(message: Message): string {
  const event = message.iosEvent;
  if (!event) return '';
  return `<div class="ios-event ios-event-${event.kind}" data-message-id="${sanitizeAttribute(message.id)}"><dl><dd>${sanitizeText(event.text)}</dd></dl></div>`;
}

function iosMessageHTML(message: Message, project: SkinProject, options: { index: number; allMessages: Message[]; sourceMessages?: Message[]; renderMode: HtmlRenderMode }): string {
  const timeBreak = message.showTimeBreak && message.timeBreakText
    ? `<div class="time-break">${sanitizeText(message.timeBreakText)}</div>`
    : '';
  if (message.iosEvent) return timeBreak + iosEventHTML(message);
  if (message.isTyping) return timeBreak + typingRowHTML(message.sender);

  const previous = options.index > 0 ? options.allMessages[options.index - 1] : undefined;
  const next = options.index < options.allMessages.length - 1 ? options.allMessages[options.index + 1] : undefined;
  const startsRun = !isSameIOSRun(project, previous, message);
  const endsRun = !isSameIOSRun(project, message, next);
  const groupClass = startsRun && endsRun ? 'single' : startsRun ? 'first' : endsRun ? 'last' : 'middle';

  const identity = resolveMessageIdentity(project, message);
  const reply = iosReplyHTML(message, project, options.sourceMessages || options.allMessages);
  const images = iosImagesHTML(message);
  const link = iosLinkPreviewHTML(message);
  const media = iosMediaHTML(message, options.renderMode);
  const hasPrimary = !!(images || link || media);

  // Group identity as a tone CLASS, never an inline style. AO3 strips `style`
  // from every element, so the old inline colour reached the preview and the
  // PNG and was deleted on the archive — the published work disagreed with what
  // the author approved.
  //
  // The avatar/monogram beside the name stays. It resolves from the canonical
  // scene character, so renaming or re-picturing someone in the People panel
  // updates messages already written — that retroactivity is the point of
  // `resolveMessageIdentity` and there is a test for it.
  //
  // The trailing space after </b> is a real separator in the source. With the
  // skin on this element is block-level and the space costs nothing; with the
  // skin off it is what stops the name welding itself to the first word.
  const groupTone = iosToneForMessage(project, message);
  const groupAvatar = project.settings.iosGroupMode && !message.outgoing
    ? identity.avatarUrl
      ? `<img src="${sanitizeUrl(identity.avatarUrl)}" alt="" class="group-avatar" width="20" height="20" />`
      : `<span class="group-avatar-initials ios-tone-${groupTone}">${sanitizeText(identity.name.substring(0, 2).toUpperCase())}</span> `
    : '';
  const groupSender = project.settings.iosGroupMode && !message.outgoing
    ? `${groupAvatar}<b class="ios-group-sender ios-tone-${groupTone}">${sanitizeText(identity.name)}</b> `
    : '';
  // With a visible name above the message, the hidden label would name the same
  // speaker twice in a download. Measured on a real posted work; see the long
  // note in msgHTML.
  const hiddenSpeaker = groupSender ? '' : `<dt class="visually-hidden">${sanitizeText(identity.name)}: </dt>`;

  const emojiSize = emojiMessageSize(message.content, hasPrimary);
  const text = message.content.trim()
    ? emojiSize
      ? `<span class="emoji-content ${emojiSize}">${formatMessageText(message.content)}</span>`
      : `<span class="message-text">${formatMessageText(message.content)}</span>`
    : '';
  // One timestamp per run, on the last bubble — which is what Messages does and
  // what the shipped renderer did. WhatsApp stamps every bubble; copying that
  // here would put a time under each line of a three-line burst.
  // The hidden space stops "hey10:23" when no CSS puts the time on its own line.
  const time = endsRun && message.timestamp
    ? `${srOnly(' ')}<span class="time${images ? ' image-time' : ''}">${sanitizeText(message.timestamp)}</span>`
    : '';

  // The SVG tail exists only because html2canvas cannot rasterise ::after. AO3
  // removes <svg> with its contents, so buildWorkSkin strips these and switches
  // on the `.css-tails` pair instead — see §7 of WORK-SKIN-IMPLEMENTATION.md.
  const tailSvg = endsRun && !emojiSize
    ? message.outgoing
      ? `<svg class="bubble-tail bubble-tail-out" width="12" height="16" viewBox="0 0 12 16" xmlns="http://www.w3.org/2000/svg"><path d="M0,0 Q0,16 12,16 L0,16 Z" fill="currentColor"/></svg>`
      : `<svg class="bubble-tail bubble-tail-in" width="12" height="16" viewBox="0 0 12 16" xmlns="http://www.w3.org/2000/svg"><path d="M12,0 Q12,16 0,16 L12,16 Z" fill="currentColor"/></svg>`
    : '';

  const tapbacks = iosTapbacksHTML(message);
  // The retired single-emoji field, still drawn for projects saved before the
  // structured model. §0.7 forbids migrating it into `iosTapbacks`; it does not
  // require deleting what an existing project already shows.
  const legacyReaction = !tapbacks && message.reaction ? `<span class="reaction">${sanitizeText(message.reaction)}</span>` : '';

  const classes = [
    'bubble', message.outgoing ? 'out' : 'in', endsRun && !emojiSize ? 'has-tail' : 'no-tail',
    images ? 'image-bubble' : '', images && (message.attachments || []).filter(attachment => attachment.url.trim()).length > 1 ? 'multi-image-bubble' : '',
    reply ? 'has-reply' : '', link ? 'has-link' : '',
    media ? 'has-media' : '', tapbacks ? 'has-tapbacks' : '', legacyReaction ? 'has-reaction' : '',
    emojiSize ? `emoji-only ${emojiSize}` : '',
  ].filter(Boolean).join(' ');

  const deliveryLabel = iosDeliveryLabel(message.status);
  const statusIndicator = message.outgoing && project.settings.iosShowReadReceipt && deliveryLabel && endsRun
    ? `<dd class="status-indicator">${deliveryLabel}</dd>`
    : '';

  return `${timeBreak}<div class="row ${message.outgoing ? 'out' : 'in'} ${groupClass}" data-message-id="${sanitizeAttribute(message.id)}"><dl class="msg">${hiddenSpeaker}<dd class="${classes}">${groupSender}${reply}${text}${images}${link}${media}${time}${tailSvg}${tapbacks}${legacyReaction}</dd>${statusIndicator}</dl></div>`;
}

function msgHTML(msg: Message, template: string, project: SkinProject, options?: { index?: number; allMessages?: Message[]; sourceMessages?: Message[]; isReply?: boolean; renderMode?: HtmlRenderMode }): string {
  // Time break (iOS/Android)
  const timeBreak = msg.showTimeBreak && msg.timeBreakText
    ? `<div class="time-break">${sanitizeText(msg.timeBreakText)}</div>`
    : '';

  if (template === 'android') {
    const allMessages = options?.allMessages || project.messages;
    const index = options?.index ?? Math.max(0, allMessages.findIndex(candidate => candidate.id === msg.id));
    return timeBreak + whatsappMessageHTML(msg, project, {
      index,
      allMessages,
      sourceMessages: options?.sourceMessages,
      renderMode: options?.renderMode || 'static',
    });
  }

  // iOS owns its markup too, as of the platform improvement work. Everything
  // below this point is Twitter, Google, and the shared scaffolding they use;
  // the long iOS branch that used to live at the bottom is gone.
  if (template === 'ios') {
    const allMessages = options?.allMessages || project.messages;
    const index = options?.index ?? Math.max(0, allMessages.findIndex(candidate => candidate.id === msg.id));
    return iosMessageHTML(msg, project, {
      index,
      allMessages,
      sourceMessages: options?.sourceMessages,
      renderMode: options?.renderMode || 'static',
    });
  }

  // A message flagged as typing IS the indicator, not a message that happens to
  // say "...".
  //
  // `isTyping` has been in the schema from the start and the editor has always
  // honoured it, but buildHTML never did — so the shipped "iOS Typing
  // Indicators" example exported a bubble containing three literal dots, in the
  // PNG and on AO3 alike, and lost the hidden "Riley is typing…" line with it.
  // Found by exporting the example and looking at it.
  //
  // Reusing the chat-level markup exactly is the point: the geometry pinned in
  // §12c, the paragraph-injection rules and the dot styling then all apply
  // without a second set of anything.
  if (msg.isTyping && (template === 'ios' || template === 'android')) {
    return timeBreak + typingRowHTML(msg.sender);
  }

  const index = options?.index;
  const allMessages = options?.allMessages;
  const isReply = options?.isReply || false;
  
  // Use formatMessageText for rich formatting (bold, italic, strikethrough, code, lists, quotes)
  const sanitized = formatMessageText(msg.content);
  const chatEmojiSize = template === 'ios' || template === 'android'
    ? emojiMessageSize(msg.content, !!msg.attachments?.length)
    : undefined;
  const chatMessageContent = chatEmojiSize
    ? `<span class="emoji-content ${chatEmojiSize}">${sanitized}</span>`
    : sanitized;
  const resolvedIdentity = resolveMessageIdentity(project, msg);
  const avatar = resolvedIdentity.avatarUrl ? `<img src="${sanitizeUrl(resolvedIdentity.avatarUrl)}" alt="${sanitizeAttribute(resolvedIdentity.name)} avatar" class="avatar" />` : '';
  
  // The group sender row that used to live here is gone, and with it the only
  // markup in this file that carried inline `style` attributes.
  //
  // It was unreachable. Both chat platforms return above — `android` to
  // `whatsappMessageHTML` and `ios` to `iosMessageHTML` — so nothing that
  // could ever set `isGroupMode` reached this far, and only `twitter` and
  // `google` get here now. The block built a `.group-sender-row` flex wrapper
  // with `!important` inline styles and a free participant hex, none of which
  // AO3 keeps; it read like a live defect and was simply dead.
  //
  // Each platform now owns its own group sender, both of them tone-class based
  // with no inline styles: iOS at the `ios-tone-` avatar above, WhatsApp at the
  // `wa-tone-` one in `whatsappMessageHTML`.
  //
  // `who` no longer needs its `template === 'android'` guard for the same
  // reason: android cannot reach this line.
  const who = `<dt class="sender">${sanitizeText(resolvedIdentity.name)}</dt>`;

  /**
   * The hidden speaker label, and when to leave it out.
   *
   * `<dt class="visually-hidden">Alex: </dt>` exists because a bubble carries
   * its speaker in colour and alignment alone, so with no CSS the conversation
   * is unattributed lines (§9a). In a **group** chat that reasoning does not
   * apply: the row already renders the speaker's name as visible text, right
   * above what they said.
   *
   * Emitting both was measured on a real posted work with Hide Creator's Style
   * on, and it read:
   *
   * ```text
   * Alex:                                  <- this label
   * AL                                     <- the avatar monogram
   * Alex                                   <- the visible group name
   * Anyone free for coffee tomorrow? 11:30 AM
   * ```
   *
   * Three names for one speaker. The monogram is a picture standing in for a
   * missing avatar and has to stay real text — AO3 allows no `aria-hidden` and
   * `content:` would vanish from the PNG (§9c) — so the label is the one to
   * drop. With the skin *on* nothing changes: this element was always clipped.
   */
  /*
   * Who "you" are, resolved at render time rather than stamped at send time.
   *
   * Renaming yourself in the People panel therefore updates messages you have
   * already written — the same reasoning, and the same fix, as the Twitter
   * identity block further down, which had exactly this bug.
   *
   * Fenced to iOS and Android on purpose. This is the **shared** section of
   * msgHTML, which runs for all four platforms; only the iOS and Android
   * branches consume `hiddenSpeaker` today, so an unfenced version happens to
   * be harmless — but that is an accident of which branch returns first, and
   * the next template added above them would silently inherit a name that means
   * nothing to it. The platform test belongs here, not in the reader's head.
   *
   * The **incoming** side stays stamped. `tests/skin-off.spec.ts` asserts
   * 'Sam: hey 10:23' from a message whose sender is 'Sam' with no contact name
   * in settings; resolving incoming from settings would break that. Renaming
   * *them* retroactively is handled by rewriting the messages instead — see
   * handleRenameContact in index.tsx.
   */
  const isChatTemplate = template === 'ios' || template === 'android';
  const speaker = isChatTemplate
    ? resolvedIdentity.name
    : msg.outgoing ? (msg.sender || 'You') : (msg.sender || 'Them');

  // Always emitted here. The branch that suppressed it existed for the group
  // sender row above, which never ran on this path; the two chat renderers
  // that do have a visible speaker name make the same decision themselves.
  const hiddenSpeaker = `<dt class="visually-hidden">${sanitizeText(speaker)}: </dt>`;
  
  // iOS/Android grouping logic
  let isFirstInGroup = true;
  let isLastInGroup = true;
  if ((template === 'ios' || template === 'android') && allMessages && index !== undefined) {
    const prevMsg = index > 0 ? allMessages[index - 1] : null;
    const nextMsg = index < allMessages.length - 1 ? allMessages[index + 1] : null;
    
    // Check if this message continues from previous (same sender, no time break)
    if (prevMsg && prevMsg.outgoing === msg.outgoing && !msg.showTimeBreak) {
      isFirstInGroup = false;
    }
    
    // Check if this message continues to next (same sender, next has no time break)
    if (nextMsg && nextMsg.outgoing === msg.outgoing && !nextMsg.showTimeBreak) {
      isLastInGroup = false;
    }
  }
  
  // Build checkmark HTML for WhatsApp (will be added inside bubble)
  let checkmarkHTML = '';
  if (template === 'android' && msg.outgoing && project.settings.androidCheckmarks) {
    const tick = msg.status ? WHATSAPP_TICKS[msg.status as keyof typeof WHATSAPP_TICKS] : undefined;

    if (tick) {
      checkmarkHTML = `<img src="${tick.src}" alt="${msg.status}" class="check-icon" width="${tick.width}" height="14" />`;
    }
  }

  // Build the message bubble with text content
  const hasAttachment = (template === 'ios' || template === 'android') && msg.attachments && msg.attachments.length > 0;
  const hasReaction = (template === 'ios' || template === 'android') && !!msg.reaction;
  const bubbleClasses = `bubble ${msg.outgoing?'out':'in'}${hasAttachment ? ' image-bubble' : ''}${hasReaction ? ' has-reaction' : ''}${chatEmojiSize ? ` emoji-only ${chatEmojiSize}` : ''}`;
  let bubble = `<dd class="${bubbleClasses}">`;

  // Add message text if present
  if (sanitized && sanitized.trim()) {
    bubble += chatMessageContent;
  }
  
  // Add image attachment inline (iOS/Android)
  if ((template === 'ios' || template === 'android') && msg.attachments && msg.attachments.length > 0) {
    const att = msg.attachments[0];
    if (att.type === 'image') {
      bubble += `<img src="${sanitizeUrl(att.url)}" alt="${attachmentAlt(att)}" class="message-image" />`;
    }
  }
  
  // Add timestamp (iOS/Android). Hidden space so the time does not weld itself
  // to the message text when no CSS puts it on its own line — see srOnly().
  if ((template === 'ios' || template === 'android') && msg.timestamp) {
    bubble += `${srOnly(' ')}<span class="time">${sanitizeText(msg.timestamp || '')}</span>`;
  }
  
  // Add checkmarks outside timestamp for absolute positioning (Android only)
  if (template === 'android' && checkmarkHTML) {
    bubble += checkmarkHTML;
  }
  
  // Add reaction if present (iOS/Android)
  if ((template === 'ios' || template === 'android') && msg.reaction) {
    bubble += `<span class="reaction">${sanitizeText(msg.reaction)}</span>`;
  }
  
  bubble += `</dd>`;
  
  // Add status indicators
  let statusIndicator = '';
  const deliveryLabel = iosDeliveryLabel(msg.status);
  if (template === 'ios' && msg.outgoing && project.settings.iosShowReadReceipt && deliveryLabel && isLastInGroup) {
    statusIndicator = `<dd class="status-indicator">${deliveryLabel}</dd>`;
  }
  
  const atts = (msg.attachments||[]).map(a => `<dd class="attach"><span class="visually-hidden">Image:</span><img src="${sanitizeUrl(a.url)}" alt="${attachmentAlt(a)}" class="attach-img"/></dd>`).join('');
  
  if (template === 'twitter') {
    // Identity is resolved here, at render time.
    //
    // It used to be copied onto each tweet when the tweet was written, so
    // renaming yourself in Settings left every existing tweet showing the old
    // name — the settings field looked global but only affected future tweets.
    // Now a tweet uses the account identity unless it explicitly opts out via
    // useCustomIdentity, which is what the multi-character presets do.
    //
    // Projects saved before this carry a name on each message and nothing in
    // settings, so the stamped value stays the fallback and they render
    // unchanged.
    const displayName = resolvedIdentity.name;
    const displayAvatar = resolvedIdentity.avatarUrl;
    
    // Determine if this is a reply
    const isReply = !!msg.parentId;
    const hasThreadConnector = options?.isReply === true;
    
    // Override avatar if using main identity
    const effectiveAvatar = displayAvatar ? `<img src="${sanitizeUrl(displayAvatar)}" alt="${sanitizeAttribute(displayName)} avatar" class="avatar" width="40" height="40" />` : '';
    const safeDisplayName = sanitizeText(displayName);
    
    // Handle logic: if using custom identity and has custom handle, use it; otherwise generate from name or use main handle
    const handle = resolvedIdentity.twitterHandle
      ? `@${resolvedIdentity.twitterHandle}`
      : `@${displayName.toLowerCase().replace(/\s+/g, '')}`;
    
    // Use per-tweet verified status if custom identity, otherwise use main profile verified
    const isVerified = resolvedIdentity.verified;
    // Drawn, not fetched. See buildTwitterCSS's `.verified-badge` for why a
    // character in a CSS circle beats a PNG here — the short version is that
    // every chrome image is a request to our CDN from inside somebody's
    // published fic, forever, and this one buys nothing an `✔` cannot.
    const verified = isVerified ? `<span class="verified-container"><span class="verified-badge" title="Verified">✔</span></span>` : '';
    // Per-post time is canonical. The project-wide value remains a legacy
    // fallback for old files, but can no longer overwrite every authored post.
    const timestampLine = msg.timestamp || project.settings.twitterTimestamp || '';
    
    const tweetMedia = msg.twitterVideo
      ? twitterVideoHTML(msg, options?.renderMode || 'static')
      : twitterMediaHTML(msg.attachments, msg.twitterMediaCrop || 'auto', false, msg.imageLayout);
    
    // Enhanced metrics with icons - use per-tweet metrics if available, otherwise fall back to global
    // Only use global defaults if the property doesn't exist on the message object
    const replies = Object.prototype.hasOwnProperty.call(msg, 'twitterReplies') ? msg.twitterReplies : project.settings.twitterReplies;
    const retweets = Object.prototype.hasOwnProperty.call(msg, 'twitterRetweets') ? msg.twitterRetweets : project.settings.twitterRetweets;
    const likes = Object.prototype.hasOwnProperty.call(msg, 'twitterLikes') ? msg.twitterLikes : project.settings.twitterLikes;
    const views = msg.twitterViews;
    const bookmarks = msg.twitterBookmarks;
    
    // Use gray icons in dark mode
    const isDarkMode = resolveTwitterTheme(project.settings) !== 'light';
    // No reply, retweet or like icons: all three are characters now, and a
    // character needs no dark-mode variant because it takes the metric colour
    // like any other text. The X logo is the last chrome image on a tweet, and
    // it stays one because it is a trademark we should not be drawing.
    const xLogo = isDarkMode ? PLATFORM_ASSETS.twitter.logoGrey : PLATFORM_ASSETS.twitter.logo;
    
    // Build the metric chips first, and only wrap them if there are any. An
    // empty `.metrics` still carries 12px of padding and a bottom border, so
    // emitting it when every count is blank produces two horizontal rules with
    // nothing between them — which is what an unconfigured tweet looked like,
    // in the image export as well as on AO3.
    // Each count carries a hidden word. With the skin on, the icon says what the
    // number means; with it off, the icons are 20px pictures in a row and the
    // counts would read "156 89 847" — three numbers and no nouns.
    const metricChips = project.settings.twitterShowMetrics ? [
      replies ? `<span class="metric replies" title="Replies"><span class="glyph-icon">↩︎</span> <span class="metric-count">${formatNumber(replies)}</span>${srOnly(' replies')}</span>`:'',
      retweets ? `<span class="metric retweets" title="Retweets"><span class="glyph-icon">⇄</span> <span class="metric-count">${formatNumber(retweets)}</span>${srOnly(' retweets')}</span>`:'',
      likes ? `<span class="metric likes" title="Likes"><span class="glyph-icon">♡</span> <span class="metric-count">${formatNumber(likes)}</span>${srOnly(' likes')}</span>`:'',
      bookmarks ? `<span class="metric bookmarks" title="Bookmarks"><img src="${PLATFORM_ASSETS.twitter.bookmarkIcon}" alt="" class="metric-icon" width="20" height="20" /> <span class="metric-count">${formatNumber(bookmarks)}</span>${srOnly(' bookmarks')}</span>`:'',
      views ? `<span class="metric views" title="Views"><img src="${PLATFORM_ASSETS.twitter.viewsIcon}" alt="" class="metric-icon" width="20" height="20" /> <span class="metric-count">${formatNumber(views)}</span>${srOnly(' views')}</span>`:'',
    ].filter(Boolean).join(' ') : '';
    const hasMetrics = metricChips.length > 0;
    const metrics = hasMetrics ? `<div class="metrics">${metricChips}</div>` : '';
    
    const legacyQuote: TwitterQuotePost | undefined = !msg.twitterQuote
      && project.messages[0]?.id === msg.id
      && project.settings.twitterQuoteEnabled
      ? {
          name: project.settings.twitterQuoteName || '',
          handle: project.settings.twitterQuoteHandle || '',
          avatarUrl: project.settings.twitterQuoteAvatar || undefined,
          verified: project.settings.twitterQuoteVerified,
          text: project.settings.twitterQuoteText || '',
          attachments: project.settings.twitterQuoteImage
            ? [{ type: 'image', url: project.settings.twitterQuoteImage, alt: 'Image in quoted post' }]
            : undefined,
        }
      : undefined;
    const quote = twitterQuoteHTML(project, msg.twitterQuote || legacyQuote);
    const translation = msg.twitterTranslation;
    const visibleBody = translation
      ? (translation.visibleText === 'translated' ? translation.translatedText : translation.originalText)
      : sanitized;
    const bodyWithFormatting = highlightTwitterText(sanitizeText(visibleBody));
    const translationContext = translation
      ? `<div class="translation-context">${translation.visibleText === 'translated'
          ? `Translated${translation.languageLabel ? ` from ${sanitizeText(translation.languageLabel)}` : ''}`
          : `Showing original${translation.languageLabel ? ` (${sanitizeText(translation.languageLabel)})` : ''}`}</div>${srOnly(translation.visibleText === 'translated'
            ? ` Original text: ${translation.originalText}`
            : ` Translation: ${translation.translatedText}`)}`
      : '';
    const poll = twitterPollHTML(msg);
    const accountLabel = msg.twitterAccountLabel
      ? `<span class="account-label">${sanitizeText(msg.twitterAccountLabel)}</span>`
      : '';
    const activity = twitterActivityHTML(project, msg);

    // Turns "Alex Rivers @alexrivers okay so I need to tell you all something"
    // into "Alex Rivers (@alexrivers) tweeted: okay so I need to tell you..."
    // once the skin is off. The brackets are hidden too, so they never double up
    // with the styled layout.
    //
    // The closing bracket has to hug the handle: the follow dot and the Follow
    // label sit after it in the name line, and an earlier version put the close
    // bracket after them, which read "(@alexrivers·Follow) tweeted:".
    // The trailing spaces matter and cost nothing. Whitespace INSIDE these
    // spans is off-screen while the skin is on, so it cannot shift the styled
    // layout or the PNG — but unstyled it is what stops the header collapsing
    // into "(@alexrivers)·Follow". The iOS tutorial makes the same point about
    // its <br><br>: "not needed for the coding per se, but more so when the
    // Creator's Style is turned off, your lines aren't jumbled on top of each
    // other."
    const openParen = srOnly(' (');
    const closeParen = srOnly(') ');
    const chromeGap = srOnly(' ');
    const attribution = srOnly(isReply ? ' replied: ' : ' tweeted: ');
    
    // Reply indicator - show "Replying to @handles" if this is a reply
    let replyingTo = '';
    if (isReply && msg.replyToHandles && msg.replyToHandles.length > 0) {
      const handles = msg.replyToHandles.map(h => `<a href="#" class="reply-handle">@${sanitizeText(h.replace(/^@/, ''))}</a>`);
      if (handles.length === 1) {
        replyingTo = `<div class="replying-to">Replying to ${handles[0]}</div>`;
      } else if (handles.length === 2) {
        replyingTo = `<div class="replying-to">Replying to ${handles[0]} and ${handles[1]}</div>`;
      } else {
        const lastHandle = handles.pop();
        replyingTo = `<div class="replying-to">Replying to ${handles.join(', ')}, and ${lastHandle}</div>`;
      }
    }
    
    // A span, not a <button>. AO3's HTML sanitizer allows a fixed element list
    // and `button` is not on it — the tag would be stripped and "Follow" would
    // survive as unstyled bare text in the middle of the name line. A span
    // carries the same class and renders identically in the image path.
    const followBtn = `<span class="follow-btn">Follow</span>`;
    
    // Check if this should be displayed as expanded view (clicked-into reply)
    if (msg.expandedView) {
      // Expanded view: avatar on left, larger text and the focal post's metrics.
      // The logo goes in the card's top-right corner, which is where the real
      // X detail view puts it — not inline after the display name. `.expanded-
      // name` is its own block above the handle, so an inline logo would sit
      // against the name rather than at the right edge. Positioned from
      // `.tweet.expanded`, which the stylesheet makes the containing block.
      //
      // Last child on purpose: it is decorative (alt=""), and with the skin off
      // AO3 still renders the <img>, so putting it first would drop a stray
      // logo above the avatar before the reader reaches the name.
      return `${activity}<div class="tweet expanded" data-message-id="${sanitizeAttribute(msg.id)}">${effectiveAvatar}<div class="expanded-content"><div class="expanded-name"><b class="name">${safeDisplayName}</b>${verified}</div><div class="expanded-handle">${openParen}<span class="handle">${sanitizeText(handle)}</span>${closeParen}${accountLabel}</div>${replyingTo}${attribution}<div class="expanded-body">${bodyWithFormatting}${translationContext}${tweetMedia}${quote}${poll}</div>${timestampLine ? `<div class="time-line">${sanitizeText(timestampLine)}</div>`:''}${metrics}</div><img src="${xLogo}" alt="" class="twitter-logo" width="20" height="20" /></div>`;
    }
    
    // Add reply class if this is a threaded reply. `no-metrics` suppresses the
    // divider under the timestamp, which otherwise draws a rule pointing at an
    // empty space when the tweet has no counts.
    const tweetClass = [hasThreadConnector ? 'tweet reply' : 'tweet', hasMetrics ? '' : 'no-metrics']
      .filter(Boolean)
      .join(' ');
    
    return `${activity}<div class="${tweetClass}" data-message-id="${sanitizeAttribute(msg.id)}"><div class="tweet-header">${effectiveAvatar}<div class="head"><div class="head-content"><div class="name-line"><b class="name">${safeDisplayName}</b> ${verified} ${openParen}<span class="handle">${sanitizeText(handle)}</span>${closeParen}<span class="follow-dot">·</span>${chromeGap}${followBtn}<img src="${xLogo}" alt="" class="twitter-logo" width="20" height="20" /></div>${accountLabel}</div></div></div>${replyingTo}${attribution}<div class="body">${bodyWithFormatting}${translationContext}${tweetMedia}${quote}${poll}</div>${timestampLine ? `<div class="time-line">${sanitizeText(timestampLine)}</div>`:''}${metrics}</div>`;
  }
  
  if (template === 'google') {
    // Google search: just display as search result (simplified)
    return `<div class="row"><span class="search-term">${sanitized}</span></div>`;
  }
  
  // Android and other templates: show avatar and sender name (with grouping for Android)
  if (template === 'android') {
    const rowClass = msg.outgoing ? 'row out' : 'row in';
    const groupClass = isFirstInGroup && isLastInGroup ? 'single' : isFirstInGroup ? 'first' : isLastInGroup ? 'last' : 'middle';
    
    // Check if this message has an image
    const hasImage = msg.attachments && msg.attachments.length > 0 && msg.attachments[0].type === 'image';
    
    let finalBubble = '';
    if (hasImage) {
      let bubbleContent = '';

      // No group sender name here either: the block that built it was
      // unreachable on this path, and both chat renderers now emit their own.
      bubbleContent += sanitized;
      
      // Add image
      const imgUrl = sanitizeUrl(msg.attachments[0].url);
      bubbleContent += `<img src="${imgUrl}" alt="${attachmentAlt(msg.attachments[0])}" class="message-image" />`;
      
      // Add timestamp
      if (msg.timestamp) {
        bubbleContent += `${srOnly(' ')}<span class="time image-time">${sanitizeText(msg.timestamp)}</span>`;
      }
      
      // Add checkmarks
      bubbleContent += checkmarkHTML;

      // The text branch gets this from the shared builder above, which appends
      // it to `bubble`. This branch throws `bubble` away and rebuilds from an
      // empty string, so it used to drop the reaction on the floor: any
      // WhatsApp message carrying both an image and a reaction rendered the
      // image and silently lost the emoji.
      if (msg.reaction) {
        bubbleContent += `<span class="reaction">${sanitizeText(msg.reaction)}</span>`;
      }

      finalBubble = `<dd class="bubble ${msg.outgoing?'out':'in'} image-bubble${msg.reaction ? ' has-reaction' : ''}">${bubbleContent}</dd>`;
    } else {
      // Use the text bubble already built (already includes senderNameHTML)
      finalBubble = bubble;
    }
    
    // Hidden speaker, as in the iOS branch above.
    return `${timeBreak}<div class="${rowClass} ${groupClass}" data-message-id="${sanitizeAttribute(msg.id)}"><dl class="msg">${hiddenSpeaker}${finalBubble}${statusIndicator}</dl></div>`;
  }
  
  // Other templates: basic row structure
  const rowClass = msg.outgoing ? 'row out' : 'row in';
  return `${timeBreak}<div class="${rowClass}" data-message-id="${sanitizeAttribute(msg.id)}">${avatar}<dl class="msg">${who}${bubble}${statusIndicator}</dl></div>`;
}

export type SkinTheme = 'light' | 'dim' | 'dark';

/**
 * Which settings field carries each platform's theme.
 *
 * Three separate booleans rather than one, which is not an oversight: an author
 * can perfectly well want a light tweet and a dark iMessage in the same work,
 * and the master skin relies on being able to build each platform's block with
 * the settings that actually belong to it.
 *
 * **Google is absent on purpose** — it has no theme at all, so it gets no theme
 * class and no variant block, and the derived override for it comes out empty.
 */
const THEME_SETTING = {
  ios: 'iosDarkMode',
  android: 'androidDarkMode',
  twitter: 'twitterDarkMode',
} as const;

/** The theme this project's platform is set to, or null if it has none. */
export function platformTheme(project: SkinProject): SkinTheme | null {
  if (project.template === 'twitter') return resolveTwitterTheme(project.settings);
  const field = THEME_SETTING[project.template as keyof typeof THEME_SETTING];
  if (!field) return null;
  return project.settings[field] ? 'dark' : 'light';
}

/**
 * The same project with its platform's theme forced.
 *
 * `buildMasterWorkSkin` derives a dark override block by compiling a platform
 * twice and diffing, so it needs to ask for the theme the author did *not*
 * pick. Returns the project untouched for a platform with no theme.
 */
export function withPlatformTheme(project: SkinProject, theme: SkinTheme): SkinProject {
  if (project.template === 'twitter') {
    return {
      ...project,
      settings: {
        ...project.settings,
        twitterTheme: theme,
        twitterDarkMode: theme !== 'light',
      },
    };
  }
  const field = THEME_SETTING[project.template as keyof typeof THEME_SETTING];
  if (!field) return project;
  return { ...project, settings: { ...project.settings, [field]: theme !== 'light' } };
}

/**
 * What makes each platform look like the app it is imitating.
 *
 * **The problem this solves is specific to the master skin.** Bubble colours,
 * opacity, the body font and iOS's message mode are *shared* settings — one set
 * of fields for all four platforms — which is fine while an author is looking at
 * one platform, because whatever they pick is what the preview and the PNG show.
 * A master skin builds all four blocks from that one set, so three of them get a
 * colour chosen for the fourth, **and the author never sees it** — those blocks
 * style markup they will paste chapters later.
 *
 * Observed on a real posted work, 8 Aug 2026: a project carrying the iOS
 * example's `#007AFF` gave the **WhatsApp** block blue outgoing bubbles instead
 * of green, and `iosMode: 'sms'` gave the iMessage block SMS green. Both were
 * faithful to the settings and wrong on the page.
 *
 * These values are the ones `examples.ts` uses for each platform, which is what
 * an author sees when they open that platform for the first time.
 */
export const PLATFORM_LOOK: Record<SkinProject['template'], Partial<SkinProject['settings']>> = {
  twitter: {
    senderColor: '#1DA1F2',
    receiverColor: '#f5f8fa',
    bubbleOpacity: 1,
    useDarkNeutral: false,
  },
  // Google has no bubbles and hardcodes its own font stack; the entry exists so
  // this map is total and a new platform cannot be forgotten.
  google: {},
  ios: {
    senderColor: '#007AFF',
    receiverColor: '#E9E9EB',
    bubbleOpacity: 1,
    iosMode: 'imessage',
    useDarkNeutral: false,
  },
  android: {
    // WhatsApp's outgoing bubble is green. `buildAndroidCSS` is the only builder
    // that takes `fontFamily` from settings, so it is reset here too — an iOS
    // font stack on a WhatsApp card is the same class of leak as the colour.
    senderColor: '#dcf8c6',
    receiverColor: '#ffffff',
    bubbleOpacity: 1,
    fontFamily: 'Arial, Helvetica, sans-serif',
    useDarkNeutral: false,
  },
};

/**
 * A clone set to `template`, wearing that platform's own look.
 *
 * Used by `buildMasterWorkSkin` for every platform **except** the one the author
 * is currently looking at. That exception is the important half: the open
 * platform's block must keep the author's real settings, because the modal shows
 * its CSS beside a preview and a PNG built from them, and two renderings that
 * can disagree is the failure `SITE-SKIN-IMPLEMENTATION.md` §5 is about.
 *
 * Theme flags are deliberately *not* reset — `iosDarkMode`, `androidDarkMode`
 * and `twitterDarkMode` are already per-platform, so they are the author's
 * genuine choice for that platform. Nor is `maxWidthPx`: a narrower card is a
 * size preference rather than a platform's identity, and each builder clamps it
 * to its own maximum anyway.
 */
export function withPlatformLook(project: SkinProject, template: SkinProject['template']): SkinProject {
  return {
    ...project,
    template,
    settings: { ...project.settings, ...PLATFORM_LOOK[template] },
  };
}

/**
 * The container class, carrying the platform and the theme.
 *
 * The platform class is what lets one master skin hold four stylesheets without
 * them colliding — `namespaceCss` in `workSkin.ts` rewrites every selector to
 * sit under `.chat.<platform>`, and this is the hook it aims at. The theme class
 * is the second half of the same idea: work skins ban `var()`, so the community
 * idiom for carrying two palettes in one skin is to **enumerate them as
 * classes**, and three independently published skins do exactly this
 * (KNOWLEDGE §3, §12, §18).
 *
 * **Both are added here rather than at the export boundary**, and that is
 * deliberate: one stylesheet drives the preview, the PNG and the work skin, so
 * markup that only the export sees is markup nothing renders in anger until an
 * author is looking at it. The cost of putting it here is that the class ships
 * to every path immediately; the benefit is that all three paths agree.
 *
 * Both are inert outside a master skin — the single-platform stylesheet has one
 * theme compiled into it, and no selector anywhere matches a bare `.ios` or
 * `.theme-dark`, on our pages or in AO3's own stylesheets. `namespace.spec.ts`
 * pins the rendering either way, class by class.
 *
 * `theme-` is prefixed rather than plain `.dark`, which is what the community
 * skins use. They can afford the short name because they choose every class on
 * the page; ours sits inside a reader's site skin as well as AO3's own CSS, and
 * `.dark` is a plausible thing for someone else to have styled.
 */
function chatClass(project: SkinProject, extra?: string): string {
  const theme = platformTheme(project);
  return `chat ${project.template}${theme ? ` theme-${theme}` : ''}${extra ? ` ${extra}` : ''}`;
}

export interface HtmlRenderContext {
  /** Original scene messages when a raster export is rendering one chunk. */
  sourceMessages?: Message[];
}

function initialsForHeader(name: string): string {
  const clean = name.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  const words = clean.split(/\s+/).filter(Boolean);
  return words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    : (words[0]?.slice(0, 2).toUpperCase() || '?');
}

function buildWhatsAppHTML(project: SkinProject, renderMode: HtmlRenderMode, context: HtmlRenderContext): string {
  const settings = project.settings;
  const frame = settings.androidFrameMode || 'header';
  const isGroup = !!settings.androidGroupMode;
  const name = isGroup
    ? settings.androidGroupName || 'Group Chat'
    : settings.androidContactName || settings.chatContactName || 'Contact';
  const participants = settings.androidGroupParticipants || [];
  let subtitle = '';
  if (isGroup) {
    const mode = settings.androidGroupSubtitleMode || 'members';
    if (mode === 'members') subtitle = participants.map(participant => participant.name).join(', ');
    if (mode === 'count') subtitle = `${participants.length} participant${participants.length === 1 ? '' : 's'}`;
    if (mode === 'custom') subtitle = settings.androidGroupSubtitleText?.trim() || '';
  } else if (settings.androidShowStatus !== false) {
    subtitle = settings.androidStatusText?.trim() || 'online';
  }
  const avatar = settings.androidAvatarUrl
    ? `<img src="${sanitizeUrl(settings.androidAvatarUrl)}" alt="" class="android-header-avatar" width="40" height="40" />`
    : `<div class="android-header-avatar-placeholder">${sanitizeText(initialsForHeader(name))}</div>`;
  const header = frame === 'bubbles' ? '' : `<div class="android-header"><div class="wa-back">‹</div>${avatar}<div class="android-header-name-wrapper"><div class="android-header-name">${sanitizeText(name)}</div>${subtitle ? `<div class="android-header-subtitle">${sanitizeText(subtitle)}</div>` : ''}</div><div class="wa-header-actions">⌕ ⋮</div></div>`;
  const body = project.messages.map((message, index) => {
    return msgHTML(message, 'android', project, {
      index,
      allMessages: project.messages,
      sourceMessages: context.sourceMessages,
      renderMode,
    });
  }).join('');
  const typing = settings.chatShowTyping ? typingRowHTML(settings.chatTypingName) : '';
  const footer = frame === 'phone'
    ? `<div class="android-footer"><div class="wa-footer-plus">＋</div><div class="wa-footer-input">Message</div><div class="wa-footer-mic">●</div></div>`
    : '';
  const extra = [
    `wa-frame-${frame}`,
    frame === 'phone' && settings.androidScrollable ? 'wa-scroll' : '',
    settings.androidWallpaperUrl ? 'wa-wallpaper' : '',
  ].filter(Boolean).join(' ');
  return `<div class="${chatClass(project, extra)}">${header}<div class="chat-messages">${body}${typing}</div>${footer}</div>`;
}


/**
 * The iOS scene: chrome, message list, and frame mode.
 *
 * `iosFrameMode` decides real markup rather than toggling three independent
 * chrome switches that could disagree with each other (§7.9). The header and
 * input bar are generated HTML and CSS, so an ordinary work makes no permanent
 * request to a remote chrome strip; the old header/footer image settings remain
 * as advanced overrides for authors who already relied on them.
 */
function buildIOSHTML(project: SkinProject, renderMode: HtmlRenderMode, context: HtmlRenderContext): string {
  const settings = project.settings;
  const frame = settings.iosFrameMode || 'header';
  const isGroup = !!settings.iosGroupMode;
  const name = isGroup
    ? settings.iosGroupName || 'Group Chat'
    : settings.iosContactName || settings.chatContactName || '';

  const statusBar = frame === 'phone' && settings.iosShowStatusBar
    ? `<div class="ios-status-bar"><span class="signal">📶</span><span class="time">${sanitizeText(settings.iosStatusBarTime || '9:41')}</span><span class="status-icons">🔋</span></div>`
    : '';

  let header = '';
  if (frame !== 'bubbles') {
    const avatar = settings.iosAvatarUrl
      ? `<img src="${sanitizeUrl(settings.iosAvatarUrl)}" alt="" class="ios-header-avatar" width="38" height="38" />`
      : `<div class="ios-header-avatar-placeholder">${sanitizeText(initialsForHeader(name || 'Chat'))}</div>`;
    const participants = settings.iosGroupParticipants || [];
    const subtitle = isGroup && participants.length
      ? `<div class="ios-header-subtitle">${sanitizeText(participants.map(participant => participant.name).join(', '))}</div>`
      : '';
    header = `<div class="ios-header"><div class="ios-back">‹</div>${avatar}<div class="ios-header-name-wrapper"><div class="ios-header-name">${sanitizeText(name || 'Messages')}</div>${subtitle}</div><div class="ios-header-actions">ⓘ</div></div>`;
  }

  const body = project.messages.map((message, index) => iosMessageHTML(message, project, {
    index,
    allMessages: project.messages,
    sourceMessages: context.sourceMessages,
    renderMode,
  })).join('');
  const typing = settings.chatShowTyping ? typingRowHTML(settings.chatTypingName) : '';

  const footer = frame === 'phone'
    ? `<div class="ios-input-bar"><span class="ios-input-plus">＋</span><div class="input-placeholder">${sanitizeText(settings.iosInputPlaceholder || 'iMessage')}</div><span class="ios-input-mic">🎤</span></div>`
    : '';

  const extra = [
    `ios-frame-${frame}`,
    frame === 'phone' && settings.iosScrollable ? 'ios-scroll' : '',
  ].filter(Boolean).join(' ');
  return `<div class="${chatClass(project, extra)}">${statusBar}${header}<div class="chat-messages">${body}${typing}</div>${footer}</div>`;
}

export function buildHTML(project: SkinProject, renderMode: HtmlRenderMode = 'static', context: HtmlRenderContext = {}): string {
  if (project.template === 'android') return buildWhatsAppHTML(project, renderMode, context);
  if (project.template === 'ios') return buildIOSHTML(project, renderMode, context);

  if (project.template === 'google') {
    // Google search layout with dedicated query field
    const s = project.settings;
    const engine = s.googleEngineVariant || 'google';
    const searchTerm = sanitizeText(s.googleQuery || 'search query');
    
    // Build Google logo (image for modern, text for old variants)
    const logoHtml = engine === 'naver'
      ? `<span class="naver-green">NAVER</span>`
      : engine === 'google-old'
        ? `<span class="blue">G</span><span class="red">o</span><span class="yellow">o</span><span class="blue">g</span><span class="green">l</span><span class="red">e</span>`
        // Every img below states its size. With the skin off there is no CSS to
        // constrain them, and these assets are 512x512 and 936x336 sources — a
        // download rendered the search magnifier as a picture the width of the
        // page, six times over. §4a's first rule, which Twitter already
        // followed and Google never did.
        //
        // These are presentational hints, so any author CSS outranks them and
        // the styled render is unchanged — including the logo, whose
        // width:auto still wins over the width attribute here.
        : `<img src="${PLATFORM_ASSETS.google.logo}" alt="Google" class="google-logo-img" width="256" height="92" />`;
    
    const logoClass = engine === 'google' ? 'logo-container' : engine === 'google-old' ? 'logo old' : 'logo naver';
    
    // Build suggestions
    const suggestions = (s.googleSuggestions||[]).filter(line=>line.trim().length>0).map(line => {
      const withBold = applyBoldMarkup(line);
      return `<div class="suggest-item"><img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="suggest-icon" width="20" height="20" />${sanitizeText(withBold)}</div>`;
    }).join('');
    
    // Build search bar with icons.
    //
    // The hidden label is what turns a bare noun into a sentence once the skin
    // is off — a download otherwise opens on the query with nothing saying it
    // is a query. See srOnly().
    const searchBarContent = `<img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="search-icon-left" width="20" height="20" />${srOnly('Searched for: ')}<span class="search-text">${searchTerm}</span>${srOnly('. ')}<div class="search-icons-right"><img src="${PLATFORM_ASSETS.google.clearIcon}" alt="" class="search-icon-clear" width="14" height="14" /><img src="${PLATFORM_ASSETS.google.micIcon}" alt="" class="search-icon-mic" width="18" height="18" /><img src="${PLATFORM_ASSETS.google.lensIcon}" alt="" class="search-icon-lens" width="18" height="18" /></div>`;

    // Build unified search component (bar + dropdown as one)
    const searchComponent = suggestions.length
      ? `<div class="search-container"><div class="search-bar">${searchBarContent}</div>${srOnly('Suggested searches: ')}<div class="suggest-box">${suggestions}</div></div>`
      : `<div class="search-bar-solo">${searchBarContent}</div>`;

    // Tabs (All, Images, Videos, News, etc.).
    //
    // These six words are chrome, and unlike the labels above we cannot make
    // them disappear when the skin is off — hiding them would need
    // `display:none`, which hides them from screen readers with the skin ON
    // too, and moving them into `content:` would delete them from the PNG
    // (html2canvas cannot rasterise pseudo-elements). So they are labelled
    // instead of removed: "All Images Videos News Maps More" reads as junk,
    // "Search tabs: All Images Videos News Maps More." reads as chrome. Same
    // deliberate compromise as Twitter's "· Follow".
    // The literal spaces between the spans keep a download from reading
    // "AllImagesVideosNewsMapsMore". They used to be free, because a flex
    // container drops whitespace-only text nodes between its items; now that
    // the tabs are inline-block they render as an ordinary word space, which is
    // why .tab no longer carries the negative margin it used to.
    //
    // The two hidden labels sit OUTSIDE the .search-tabs div, which matters
    // more than it looks. Inside, the leading one is `.search-tabs`'s first
    // child, and `.search-tabs .tab:first-child{margin-left:12px}` then stops
    // matching the first tab — the whole bar loses its indent. A hidden span is
    // only free if it changes no structural selector; being out of flow is not
    // enough. Caught by the pixel check in the AO3 nesting harness.
    const tabs = `${srOnly('Search tabs: ')}<div class="search-tabs"><span class="tab active"><img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="tab-icon" width="16" height="16" />All</span> <span class="tab">Images</span> <span class="tab">Videos</span> <span class="tab">News</span> <span class="tab">Maps</span> <span class="tab">More</span></div>${srOnly('. ')}`;
    
    // Result statistics. Pure flavour, so they are derived from the query
    // rather than asked for — a user who cares can still override either in
    // Advanced settings.
    const autoStats = generateSearchStats(s.googleQuery || '');
    const resultsCount = s.googleResultsCount || autoStats.count;
    const resultsTime = s.googleResultsTime || autoStats.time;
    const stats = s.googleShowStats !== false
      ? `<p class="search-stats">${sanitizeText(`${resultsCount} (${resultsTime})`)}</p>`
      : '';
    
    // Did you mean correction (only if enabled)
    const dym = s.googleShowDidYouMean && s.googleDidYouMean
      ? `<p class="search-dym"><span class="search-dym1">Did you mean: </span><span class="search-dym2">${sanitizeText(s.googleDidYouMean)}</span></p>`
      : '';
    
    // Build search results from messages array.
    //
    // ONE LINE, NO EXCEPTIONS. This used to be an indented template literal —
    // nine lines with two blank-line breaks — and AO3 injects <br> at every
    // newline and wraps blank-line-separated chunks in <p>. It was rewriting
    // the inside of .search-result on every save, in a shipped platform. A
    // single line is never touched. Pinned by a test that asserts no
    // platform's exported HTML contains a newline at all.
    //
    // The hidden labels are the skin-off story: with no CSS, a result is three
    // stacked divs reading "https://example.com Untitled Result some text",
    // with nothing marking where one result ends and the next begins. The URL
    // comes before the title in the markup because that is the order Google
    // renders them, so the label has to carry the awkward join.
    const results = project.messages.map((msg, i) => {
      const title = sanitizeText(msg.content || 'Untitled Result');
      const url = sanitizeText(msg.googleResultUrl || 'https://example.com');
      const description = msg.googleResultDescription ? sanitizeText(msg.googleResultDescription) : '';
      const desc = description ? `<div class="result-desc">${description}</div>` : '';

      return `<div class="search-result"><div class="result-url">${srOnly(`Result ${i + 1}, from `)}${url}</div><div class="result-title">${srOnly(': ')}${title}</div>${desc}</div>`;
    }).join('');
    
    const body = `<div class="${logoClass}">${logoHtml}</div><div class="search-wrap">${searchComponent}${tabs}${stats}${dym}${results}</div>`;
    return `<div class="${chatClass(project)}">${body}</div>`;
  }
  
  if (project.template === 'twitter') {
    const scene = normalizeTwitterScene(project);
    if (scene.mode === 'thread') {
      const renderNode = (node: (typeof scene.roots)[number], connected = false): string =>
        msgHTML(node.message, 'twitter', project, {
          index: project.messages.findIndex(message => message.id === node.message.id),
          renderMode,
          ...(connected ? { isReply: true } : {}),
        })
        + node.children.map(child => renderNode(child, true)).join('');
      const tweets = scene.roots.map(root => renderNode(root)).join('');
      return `<div class="${chatClass(project, 'tweets')}">${tweets}</div>`;
    }
    // Timeline replies retain semantic "Replying to" context, but connector
    // styling is reserved for Thread mode. Single mode resolves its first post
    // to the expanded layout in the normalized model.
    const tweets = scene.posts.map((message, index) => msgHTML(message, 'twitter', project, { index, renderMode })).join('');
    return `<div class="${chatClass(project, 'tweets')}">${tweets}</div>`;
  }

  const body = project.messages.map(m => msgHTML(m, project.template, project)).join('');
  return `<div class="${chatClass(project)}">${body}</div>`;
}

/**
 * iOS colour, both themes side by side. See TEXT_FORMATTING_COLOURS for why.
 *
 * `recvBg` is a *parameter* rather than two more table entries because
 * `receiverBubbleBg` and `typingBubbleBg` are not theme colours at all: in
 * light mode they are whatever bubble colour reaches this builder, and dark
 * mode overrides both with a fixed near-black. A static table would silently
 * freeze that. (Today `buildCSS` pins iOS's received bubble to #E9E9EB for both
 * iMessage and SMS, so the value is constant in practice — the parameter keeps
 * the builder honest if that ever stops being true.)
 *
 * The four light-mode entries ending in `rgba(60,60,67,·)` are the ones that
 * were wrong until 7 Aug 2026 — see the note on `dd.status-indicator` below.
 */
function iosColours(recvBg: string) {
  return {
    light: {
      chatBg: '#fff',
      messagesBg: '#fff',
      headerLabelBg: '#fff',
      headerLabelColor: '#86868b',
      contactNameColor: '#000',
      statusBarBg: '#f6f6f6',
      statusBarColor: '#000',
      statusBarBorder: '#e0e0e0',
      timeBreakColor: '#86868b',
      receiverBubbleBg: recvBg,
      receiverTextColor: '#000',
      receiverTimeColor: 'rgba(0,0,0,0.55)',
      typingBubbleBg: recvBg,
      inputBarBg: '#f6f6f6',
      inputBarBorder: '#e0e0e0',
      inputFieldBg: '#fff',
      inputFieldBorder: '#c7c7cc',
      inputPlaceholderColor: '#86868b',
      senderNameColor: 'rgba(60,60,67,0.6)',
      statusIndicatorColor: 'rgba(60,60,67,0.6)',
      typingDotBg: 'rgba(60,60,67,0.6)',
      typingLabelColor: 'rgba(60,60,67,0.6)',
      // The tapback chip. It was a hardcoded near-black in both themes, which
      // is the same class of bug as the near-white text fixed here on 7 Aug
      // 2026: a dark chip drawn on a white page.
      reactionChipBg: '#e9e9eb',
      reactionChipColor: '#000',
      reactionChipBorder: '#fff',
      // Structured-content surfaces. A card inside a blue outgoing bubble and a
      // card inside a grey incoming one need the same treatment to read as one
      // component, so these are translucent overlays rather than flat colours.
      cardBg: 'rgba(0,0,0,0.06)',
      cardBorder: 'rgba(0,0,0,0.10)',
      quoteBar: '#8e8e93',
      waveBar: '#6e6e73',
      eventColor: '#86868b',
      placeholderBg: '#1c1c1e',
      placeholderColor: '#aeaeb2',
      chromeBg: '#f6f6f6',
      chromeBorder: '#d1d1d6',
      chromeColor: '#007aff',
    },
    dark: {
      chatBg: '#000000',
      messagesBg: '#000000',
      headerLabelBg: '#1c1c1e',
      headerLabelColor: '#8e8e93',
      contactNameColor: '#fff',
      statusBarBg: '#1c1c1e',
      statusBarColor: '#fff',
      statusBarBorder: '#38383a',
      timeBreakColor: '#8e8e93',
      receiverBubbleBg: '#262628',
      receiverTextColor: '#fff',
      receiverTimeColor: 'rgba(255,255,255,0.55)',
      typingBubbleBg: '#262628',
      inputBarBg: '#1c1c1e',
      inputBarBorder: '#38383a',
      inputFieldBg: '#2c2c2e',
      inputFieldBorder: '#48484a',
      inputPlaceholderColor: '#636366',
      senderNameColor: 'rgba(255,255,255,0.5)',
      statusIndicatorColor: 'rgba(255,255,255,0.45)',
      typingDotBg: 'rgba(255,255,255,0.6)',
      typingLabelColor: 'rgba(255,255,255,0.5)',
      reactionChipBg: '#2c2c2e',
      reactionChipColor: '#fff',
      reactionChipBorder: '#000',
      cardBg: 'rgba(255,255,255,0.12)',
      cardBorder: 'rgba(255,255,255,0.18)',
      quoteBar: '#8e8e93',
      waveBar: '#aeaeb2',
      eventColor: '#8e8e93',
      placeholderBg: '#1c1c1e',
      placeholderColor: '#aeaeb2',
      chromeBg: '#1c1c1e',
      chromeBorder: '#38383a',
      chromeColor: '#0a84ff',
    },
  };
}

function buildIOSCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.iosDarkMode;
  const colour = iosColours(recvBg)[isDark ? 'dark' : 'light'];

  // An author-supplied strip only ever *decorates* the generated chrome now, and
  // only when it is an absolute https URL a CSS url() can safely carry.
  const cssUrl = (value: string | undefined) => value && /^https:\/\/[^'"()<>\s]+$/i.test(value) ? value : '';
  const headerImage = cssUrl(s.iosHeaderImageUrl);
  const footerImage = cssUrl(s.iosFooterImageUrl);
  const headerBg = headerImage ? `background:url('${headerImage}') no-repeat top center;background-size:100% auto;` : `background:${colour.chromeBg};`;
  const footerBg = footerImage ? `background:url('${footerImage}') no-repeat bottom center;background-size:100% auto;` : `background:${colour.inputBarBg};`;
  const viewport = Math.max(20, Math.min(60, Math.round(s.iosViewportHeightEm || 34)));
  // A finite tone palette compiled to classes, because AO3 strips inline style.
  const tones = IOS_PARTICIPANT_TONES.map(tone => {
    const value = isDark ? tone.dark : tone.light;
    return `#workskin .ios-tone-${tone.id}{color:${value};}\n#workskin blockquote.ios-reply-${tone.id}{border-left-color:${value};}`;
  }).join('\n');

    return `/* Generated with AO3 SkinGen */
#workskin .chat{width:100%;max-width:${emFromPx(Math.min(maxWidth, 375))};min-width:20em;margin:0 auto;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:0;background:${colour.chatBg};}
${PARAGRAPH_RESET_CSS}
#workskin .ios-header{position:relative;${headerBg}min-height:3.75em;display:flex;align-items:center;padding:0.5em 0.6em;border-bottom:1px solid ${colour.chromeBorder};color:${colour.contactNameColor};}
#workskin .ios-back,#workskin .ios-header-actions{color:${colour.chromeColor};font-size:1.35em;line-height:1;flex-shrink:0;}
#workskin .ios-back{margin-right:0.35em;}
#workskin .ios-header-actions{margin-left:0.35em;}
/* No overflow:hidden on the wrapper. It bought nothing — the name child already
   ellipsises on its own — and it cost the group name and its participant list
   in every PNG: html2canvas paints text a few px lower than the browser
   measures it, so the second line fell outside the clip and the first lost its
   descenders. Same class of defect as the Twitter name line, found the same
   way, by exporting a picture and looking at it. */
#workskin .ios-header-name-wrapper{min-width:0;flex:1;text-align:center;}
#workskin .ios-header-subtitle{font-size:0.688em;line-height:1.2;opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#workskin .ios-header-avatar,#workskin .ios-header-avatar-placeholder{width:2.375em;height:2.375em;border-radius:50%;overflow:hidden;flex-shrink:0;display:block;margin-right:0.5em;}
#workskin .ios-header-avatar img{width:100%;height:100%;}
#workskin .ios-header-avatar-placeholder{background:${colour.cardBg};color:${colour.contactNameColor};text-align:center;line-height:2.375em;font-size:0.875em;font-weight:700;}
/* No max-width here. It used to read calc(100% - 177px), where 177 is exactly
   left(112) + right(65) — so an absolutely positioned box that already spans
   between those two edges was being constrained to the width it already had.
   calc() is genuinely absent from AO3's value grammar, and this one bought
   nothing, so it goes rather than being approximated. */
#workskin .ios-header-name{font-size:0.938em;font-weight:600;color:${colour.contactNameColor};line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#workskin .ios-status-bar{background:${colour.statusBarBg};padding:0.429em 1.143em 0.286em 1.143em;display:flex;justify-content:space-between;align-items:center;font-size:0.875em;font-weight:600;color:${colour.statusBarColor};border-bottom:1px solid ${colour.statusBarBorder};}
/* Same trick as the Twitter metrics row, and for the same reason: AO3 collapses
   signal / time / battery into one paragraph, which becomes the only flex item.
   Measured before this rule existed — the bar grew 32px to 50px, the time lost
   its flex:1 (312px down to 25px) and the battery icon jumped from the right
   edge to the left and wrapped onto a second line, shoving every message row
   below it down by 18px. We emit no paragraph here, so the preview and the PNG
   never see this rule. */
#workskin .ios-status-bar p{display:contents;}
#workskin .ios-status-bar .time{flex:1;text-align:center;}
#workskin .ios-status-bar .status-icons{display:flex;align-items:center;font-size:0.857em;}
#workskin .ios-status-bar .status-icons > *{margin-left:0.333em;}
#workskin .ios-status-bar .status-icons > *:first-child{margin-left:0;}
#workskin .chat-header{text-align:center;font-size:0.813em;color:${colour.headerLabelColor};padding:0.615em 0.923em 0.462em 0.923em;margin-bottom:0.308em;font-weight:400;background:${colour.headerLabelBg};}
#workskin .chat-header .to-label{font-weight:400;color:${colour.headerLabelColor};margin-right:0.308em;}
#workskin .chat-header .contact-name{font-weight:600;color:${colour.contactNameColor};display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#workskin .chat-messages{padding:0.75em 0.5em;background:${colour.messagesBg};}
#workskin .time-break{text-align:center;font-size:0.688em;color:${colour.timeBreakColor};margin:1.091em 0 0.727em 0;font-weight:500;}
#workskin .row{display:flex;margin:0 0 0 -0.375em;align-items:flex-end;flex-wrap:wrap;width:100%;}
#workskin .row > *{margin-left:0.375em;}
#workskin .row.single{margin:0.75em 0;}
#workskin .row.first{margin:0.75em 0 0.125em 0;}
#workskin .row.middle{margin:0.125em 0;}
#workskin .row.last{margin:0.125em 0 0.75em 0;}
#workskin .row.out{justify-content:flex-end;}
#workskin .row.in{justify-content:flex-start;}
#workskin img.avatar{width:1.75em;height:1.75em;border-radius:50%;overflow:hidden;flex-shrink:0;}
#workskin dl.msg{margin:0;display:flex;flex-direction:column;margin-top:-0.063em;}
#workskin dl.msg > *{margin-top:0.063em;}
#workskin .row.out dl.msg{align-items:flex-end;}
#workskin .row.in dl.msg{align-items:flex-start;}
/* was calc(70% - 36px). At the 375px card that resolves to 60.4%, and this is
   an ellipsised label rather than a load-bearing width, so a flat percentage is
   the honest approximation. See the note on .ios-header-name. */
#workskin dt.sender{font-size:0.688em;color:${colour.senderNameColor};margin:0.545em 0 0.182em 3.273em;font-weight:500;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#workskin dd{margin:0;}
#workskin dd.bubble{position:relative;display:inline-block;min-width:0;max-width:17.333em;padding:0.533em 0.8em;border-radius:1.2em;line-height:1.35;font-size:0.938em;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;}
${tones}
#workskin .message-text{display:inline;}
#workskin .chat.ios-scroll .chat-messages{height:${viewport}em;overflow-y:auto;overflow-x:hidden;}
#workskin .ios-group-sender{display:inline-block;font-size:0.733em;font-weight:600;line-height:1.2;margin-bottom:0.35em;vertical-align:middle;}
/* No object-fit: it is not on AO3's property list and has no legal equivalent,
   so a non-square source letterboxes inside the box rather than cropping. */
#workskin dd.bubble .group-avatar,#workskin dd.bubble .group-avatar-initials{display:inline-block;width:1.333em;height:1.333em;border-radius:50%;vertical-align:middle;margin-right:0.35em;margin-bottom:0.35em;flex-shrink:0;}
/* The initials badge re-declares its box, and the reason is arithmetic that is
   easy to get wrong twice. A length in em resolves against the element's OWN
   font-size, so width:1.333em beside font-size:0.6em does not draw a 1.333em
   circle in the bubble's text — it draws 1.333 x 0.6 = 0.8em, a 12px circle
   holding two bold 9px letters. They do not fit, they wrapped, and the second
   letter fell outside the circle in the preview, the PNG and the archive alike.

   0.5 x 1.6 is also 0.8, so the painted circle is the same size it has always
   been; only the letters inside it got room. nowrap is the guard that makes the
   next miscalculation show up as a slight overflow rather than as a second
   line. Change one of these three numbers and you must change the others. */
#workskin dd.bubble .group-avatar-initials{background:${colour.cardBg};text-align:center;font-size:0.5em;width:1.6em;height:1.6em;line-height:1.6em;font-weight:700;white-space:nowrap;}
/* REPLY CONTEXT. A compact quote inside the new bubble, not a recreation of the
   live app's blurred focus mode — there is nothing to tap in a static work. */
#workskin blockquote.ios-reply{display:block;margin:0 0 0.45em 0;padding:0.35em 0.5em;border-left:0.25em solid ${colour.quoteBar};border-radius:0.3em;background:${colour.cardBg};font-style:normal;color:inherit;overflow:hidden;}
/* font-style on the children too: a browser italicises blockquote content, and
   resetting only the parent leaves the quoted line in italics. Colour is
   inherited from the bubble on purpose — the tone tints the bar, not the text,
   or a red quote lands inside a blue outgoing bubble. */
#workskin blockquote.ios-reply b,#workskin blockquote.ios-reply span{display:block;font-style:normal;color:inherit;}
#workskin blockquote.ios-reply b{font-size:0.75em;opacity:0.85;}
/* No max-height. The excerpt is already capped at 180 characters where it is
   built, and a height clamp on top of that clipped the last line — worse in the
   PNG than in the browser, because html2canvas paints text lower. */
#workskin blockquote.ios-reply span{font-size:0.8em;}
#workskin .ios-reply-thumb{float:right;width:2.5em;height:2.5em;border-radius:0.25em;margin-left:0.4em;}
#workskin blockquote.ios-reply-missing{border-left-color:#c8102e;}
/* IMAGE COLLAGES. Inline-block cells plus child margins, never gap — AO3 keeps a property
   only if it is on its list or contains a shorthand name, so column-gap passes
   and bare gap does not. No object-fit either; it has no legal equivalent. */
#workskin .ios-images{display:block;margin-top:0.4em;font-size:0;overflow:hidden;border-radius:0.7em;}
#workskin .ios-image{display:block;width:100%;height:auto;margin:0;}
${imageCompositionCSS('.ios-images')}
/* LINK CARD. The whole card is the anchor; the URL line keeps the destination
   readable when the skin is off. */
#workskin a.ios-link-preview{display:block;margin-top:0.4em;border-radius:0.7em;overflow:hidden;background:${colour.cardBg};color:inherit;text-decoration:none;padding-bottom:0.4em;}
#workskin a.ios-link-preview b,#workskin a.ios-link-preview span{display:block;margin:0.25em 0.55em 0 0.55em;}
#workskin .ios-link-image{display:block;width:100%;height:auto;margin:0;}
#workskin .ios-link-description{font-size:0.85em;opacity:0.85;}
#workskin .ios-link-site,#workskin .ios-link-url{font-size:0.75em;opacity:0.7;overflow-wrap:anywhere;}
/* VOICE MESSAGE. The static card is honest about not playing: a glyph, a drawn
   waveform, and a real link. The native control in Work Text is never made
   transparent or floated over the fake waveform. */
#workskin .ios-audio-card,#workskin .ios-video-card{display:block;position:relative;margin-top:0.4em;padding:0.5em;border-radius:0.7em;background:${colour.cardBg};overflow:hidden;}
#workskin .ios-audio-play{display:inline-block;width:1.8em;vertical-align:middle;}
#workskin .ios-waveform{display:inline-block;width:11em;height:2.2em;vertical-align:middle;white-space:nowrap;overflow:hidden;}
#workskin .ios-wave-bar{display:inline-block;width:0.13em;margin-right:0.11em;vertical-align:middle;background:${colour.waveBar};border-radius:0.1em;}
#workskin .ios-wave-1{height:0.4em;}#workskin .ios-wave-2{height:0.7em;}#workskin .ios-wave-3{height:1em;}#workskin .ios-wave-4{height:1.3em;}#workskin .ios-wave-5{height:1.6em;}#workskin .ios-wave-6{height:1.9em;}
#workskin .ios-audio-duration,#workskin .ios-audio-transcript,#workskin .ios-video-title,#workskin .ios-video-duration,#workskin .ios-media-description,#workskin .ios-captions,#workskin .ios-media-source{display:block;font-size:0.75em;margin-top:0.25em;}
#workskin .ios-video-title{font-weight:600;}
#workskin .ios-media-source{color:inherit;text-decoration:underline;overflow-wrap:anywhere;}
#workskin .ios-native-audio{display:block;width:100%;margin-top:0.45em;}
#workskin .ios-video-poster,#workskin .ios-native-video,#workskin .ios-youtube-player iframe{display:block;width:100%;height:auto;border:0;border-radius:0.5em;background:#000;}
#workskin .ios-youtube-player iframe{height:11.25em;max-width:100%;}
#workskin .ios-video-placeholder{display:block;box-sizing:border-box;min-height:8em;padding:3.5em 1em;text-align:center;background:${colour.placeholderBg};color:${colour.placeholderColor};border-radius:0.5em;}
#workskin .ios-video-play{position:absolute;left:45%;top:2.5em;font-size:2em;color:#fff;text-shadow:0 1px 3px #000;}
/* TAPBACKS. Top corner, on the side away from the tail, so the stack clears the
   tail in both directions by construction rather than by tuning offsets. The
   space it hangs into is reserved with real padding and margin: the chip is out
   of flow and the text is not, so a margin alone leaves it lying on the words —
   invisible in the browser by a pixel, and plainly wrong in every PNG. */
#workskin .ios-tapbacks{position:absolute;top:-0.75em;background:${colour.reactionChipBg};color:${colour.reactionChipColor};border:0.125em solid ${colour.reactionChipBorder};border-radius:0.875em;padding:0.063em 0.4em;font-size:0.813em;line-height:1.35;box-shadow:0 1px 3px rgba(0,0,0,0.2);white-space:nowrap;z-index:2;}
#workskin dd.bubble.out .ios-tapbacks{left:-0.5em;}
#workskin dd.bubble.in .ios-tapbacks{right:-0.5em;}
#workskin dd.bubble.has-tapbacks{padding-top:0.95em;margin-top:1.2em;}
/* EVENTS sit outside dl.msg and are centred plain text, never a bubble. */
#workskin .ios-event{text-align:center;margin:0.9em 0;color:${colour.eventColor};}
#workskin .ios-event dl{margin:0;}
#workskin .ios-event dd{display:inline-block;font-size:0.688em;font-weight:600;padding:0.2em 0.5em;}
#workskin .ios-event-system dd{max-width:82%;font-weight:400;}
/* A media bubble uses the same 17.333em ceiling as an ordinary iMessage
   bubble, but unlike a text-only bubble it has a stable width. The old 60%
   ceiling was resolved inside an auto-sized flex wrapper and capped media at
   roughly 13.9em even when the row had more room. Reply cards, sender labels,
   and captions then made that shrink-to-fit geometry needlessly fragile. One
   image and a collage now share one predictable box. */
#workskin dd.bubble.image-bubble{width:17.333em;padding:0.533em 0.8em;box-sizing:border-box;overflow:visible;}
#workskin dd.bubble.image-bubble img.message-image{width:100%;height:auto;display:block;border-radius:0.8em;margin-top:0.4em;}
#workskin dd.bubble.image-bubble.out{border-bottom-right-radius:0.267em;}
#workskin dd.bubble.image-bubble.out img.message-image{border-bottom-right-radius:0.267em;}
#workskin dd.bubble.image-bubble.in{border-bottom-left-radius:0.267em;}
#workskin dd.bubble.image-bubble.in img.message-image{border-bottom-left-radius:0.267em;}
#workskin dd.bubble.out{background:${senderBg};color:#fff;border-bottom-right-radius:0.267em;}
#workskin dd.bubble.out .bubble-tail{display:none;}
#workskin dd.bubble.out.has-tail .bubble-tail-out{display:block;position:absolute;right:-0.533em;bottom:-0.067em;color:${senderBg};}
#workskin dd.bubble.in{background:${colour.receiverBubbleBg};color:${colour.receiverTextColor};border-bottom-left-radius:0.267em;}
#workskin dd.bubble.in .bubble-tail{display:none;}
/* pointer-events dropped from both tail rules — not on AO3's property list, and
   purely defensive: the tails are decorative and sit outside the bubble's text. */
#workskin dd.bubble.in.has-tail .bubble-tail-in{display:block;position:absolute;left:-0.533em;bottom:-0.067em;color:${colour.receiverBubbleBg};}
/* Native emoji-only messages float without the coloured bubble or tail. Keep
   the message metadata at its ordinary size: only the content span grows. */
#workskin dd.bubble.emoji-only{background:transparent;box-shadow:none;padding:0.133em 0.2em;border-radius:0;overflow:visible;}
#workskin dd.bubble.emoji-only .emoji-content{display:block;line-height:1.05;white-space:nowrap;}
#workskin dd.bubble.emoji1 .emoji-content{font-size:4em;}
#workskin dd.bubble.emoji2 .emoji-content{font-size:2.4em;}
#workskin dd.bubble.emoji-only.out .time{color:${colour.statusIndicatorColor};}
/* TWO WAYS TO DRAW THE SAME TAIL, and both are needed.
   The SVG above is for the PNG: html2canvas cannot rasterise ::before/::after,
   which is the only reason an inline <svg> is in the markup at all.
   AO3 is the mirror image — it removes <svg> together with its contents, so on
   the archive the SVG tails simply vanish, silently, with the work saving fine.
   Hence the pure-CSS pair below, which is the border-plus-radius trick every
   community iOS skin uses. They are scoped to .css-tails, a class only
   buildWorkSkin adds, so the browser never draws both at once. */
/* Single quotes on content, matching the Twitter stylesheet. Both forms are
   very likely fine — this pair was content:"" for a long time — but the CSS AO3
   stored for this skin on 7 Aug 2026 was read back rule by rule, and the
   single-quoted form is the one we have actually watched survive the sanitizer
   intact. No reason to run two conventions. */
#workskin .chat.css-tails dd.bubble.out.has-tail::after{content:'';position:absolute;right:-0.4em;bottom:0;width:0.533em;height:1.067em;border-right:8px solid ${senderBg};border-bottom-right-radius:1.067em 0.533em;}
#workskin .chat.css-tails dd.bubble.in.has-tail::after{content:'';position:absolute;left:-0.4em;bottom:0;width:0.533em;height:1.067em;border-left:8px solid ${colour.receiverBubbleBg};border-bottom-left-radius:1.067em 0.533em;}
#workskin dd.bubble.out .time{display:block;font-size:0.733em;color:rgba(255,255,255,0.65);margin-top:0.545em;font-weight:400;}
#workskin dd.bubble.in .time{display:block;font-size:0.733em;color:${colour.receiverTimeColor};margin-top:0.545em;font-weight:400;}
#workskin dd.bubble.image-bubble .time.image-time{position:absolute;bottom:0.727em;right:0.727em;margin:0;background:rgba(0,0,0,0.6);padding:0.182em 0.545em;border-radius:0.909em;font-size:0.733em;color:#fff;}
/* THE TAPBACK CHIP, and where iMessage actually draws one.
   Until 8 Aug 2026 this rule matched nothing: the iOS branch emitted the span
   as a SIBLING of the bubble and the selector is a descendant. Once the markup
   was fixed the rule applied for the first time and brought two defects with
   it. Both are fixed here.
   1. It was bottom-right for BOTH directions — and an outgoing bubble's tail is
      also bottom-right, so the chip landed on the tail and on the "Read"
      receipt underneath it. iMessage puts a tapback on the TOP corner, on the
      side away from the tail: top-left for an outgoing bubble, top-right for an
      incoming one. That clears the tail in both directions by construction
      rather than by tuning offsets.
   2. The background was a hardcoded near-black in light mode as well as dark.
      It is a palette entry now, like the 22 around it. */
#workskin dd.bubble .reaction{position:absolute;top:-0.75em;background:${colour.reactionChipBg};color:${colour.reactionChipColor};border:0.125em solid ${colour.reactionChipBorder};border-radius:0.875em;padding:0.063em 0.375em;font-size:0.875em;line-height:1.35;box-shadow:0 1px 3px rgba(0,0,0,0.2);z-index:2;}
#workskin dd.bubble.out .reaction{left:-0.5em;}
#workskin dd.bubble.in .reaction{right:-0.5em;}
/* Reserve the strip the chip sits in with PADDING, not margin.
   Margin only pushes the neighbouring row away; it leaves the chip lying on
   the bubble's own first line, because the chip is out of flow and the text
   is not. It looked survivable in the browser only because the chip's lower
   edge landed within a pixel of where the text began -- and a pixel is not a
   margin. html2canvas draws text a few px lower than the browser does, so in
   every PNG the chip sat on top of the words; a narrow bubble, a larger
   reader font or AO3's paragraph injection would each have done the same on
   the archive. Padding makes the clearance real in every renderer.
   Only the reserve was wrong -- the chip's POSITION was always right, sitting
   mostly outside the bubble on the corner away from the tail. Pulling it up to
   -0.35em to make room was a mistake: it moved the chip inside and then needed
   a strip so tall the bubble looked hollow. The chip is ~1.5em tall and hangs
   0.75em out, so it reaches ~0.75em in; 0.95em covers that plus a descender.
   The margin is the OTHER direction: the chip sticks 0.75em ABOVE the bubble,
   into the previous message. 0.5em was not enough and it overlapped by 1.3px
   -- caught by measuring, not by looking, which is the point of that test. */
#workskin dd.bubble.has-reaction{padding-top:0.95em;margin-top:1.2em;}
/* LIGHT-MODE COLOUR, and it was wrong until 7 Aug 2026. This and three sibling
   rules — dt.sender, .typing-label, .typing-bubble .dot — chose between
   rgba(255,255,255,x) and rgba(235,235,245,x). Both are near-white: 235,235,245
   is iOS's secondary label for DARK backgrounds, so the light branch was
   painting near-white text on a white page. A real AO3 render showed "Read" as
   barely-there grey, and in light mode the typing dots and label were invisible
   outright. rgba(60,60,67,·) is the light-mode counterpart. */
#workskin dd.status-indicator{font-size:0.625em;color:${colour.statusIndicatorColor};text-align:right;margin:0.2em 1em 0 0;font-weight:400;}
#workskin dd.attach{margin-top:0.125em;}
#workskin img.attach-img{max-width:13.75em;border-radius:0.75em;display:block;}
#workskin .row.typing{align-items:center;margin-left:-0.375em;}
#workskin .row.typing > *{margin-left:0.375em;}
/* NO FLEX AND NO > * HERE — the dots vanish outright on AO3 with either.
   A .dot is a <span>, and width/height do not apply to an inline box. Today
   they are only honoured because display:flex blockifies its flex items. AO3
   wraps the three spans in a single <p>, at which point they stop being flex
   items, the 8x8 is ignored, and the indicator measures 0x0 — invisible, with
   no error anywhere. Measured in tests/ao3-injection.spec.ts.
   inline-block makes the size stick whether or not anything blockifies them,
   and the margin moves to a descendant selector so an injected <p> cannot
   intercept it. */
#workskin .typing-bubble{background:${colour.typingBubbleBg};padding:0.625em 0.875em;border-radius:1.125em;display:inline-block;line-height:0;border-bottom-left-radius:0.25em;}
/* NOTE ON THE TYPING DOTS. Static, with the three dots at descending opacity —
   no animation, because AO3 allows neither the animation property nor
   @keyframes, and refuses the whole skin over either.
   This is the community's answer, not a compromise we invented: the same
   descending-opacity trio appears in the iOS text-message tutorial that every
   AO3 messaging skin descends from. It reads as "mid-typing" while standing
   still, which a single flat-grey trio does not.
   Do not delete the :nth-child rules to "simplify" — a rule left with no
   declarations is an AO3 error, not a no-op, which is exactly how the
   animation-delay versions of these two failed. */
#workskin .typing-bubble .dot{display:inline-block;vertical-align:middle;width:0.5em;height:0.5em;margin-left:0.25em;background:${colour.typingDotBg};border-radius:50%;opacity:0.4;}
#workskin .typing-bubble .dot:first-child{margin-left:0;}
#workskin .typing-bubble .dot:nth-child(1){opacity:0.85;}
#workskin .typing-bubble .dot:nth-child(2){opacity:0.65;}
#workskin .typing-label{font-size:0.688em;color:${colour.typingLabelColor};font-weight:400;}
#workskin .ios-footer{position:relative;${footerBg}height:2.938em;border-top:1px solid ${colour.inputBarBorder};}
#workskin .ios-input-bar{background:${colour.inputBarBg};padding:0.5em 0.75em;border-top:1px solid ${colour.inputBarBorder};display:flex;align-items:center;}
/* Same fix as .ios-status-bar, and it was measured the same way. AO3 collapses
   the plus / field / mic into one paragraph, which then becomes the ONLY flex
   item — the field's flex:1 stops applying to the field and the placeholder
   grew 9px under injection. display:contents makes the paragraph disappear from
   the box tree so its children are the flex items again. We emit no paragraph
   here, so the preview and the PNG never see this rule.
   The margins are descendant selectors rather than a child combinator, for the
   same reason: an injected paragraph intercepts a direct-child match. */
#workskin .ios-input-bar p{display:contents;}
#workskin .ios-input-bar .ios-input-plus,#workskin .ios-input-bar .input-placeholder,#workskin .ios-input-bar .ios-input-mic{margin-left:0.5em;}
#workskin .ios-input-bar .ios-input-plus{margin-left:0;}
#workskin .ios-input-plus,#workskin .ios-input-mic{color:${colour.chromeColor};font-size:1.2em;line-height:1;}
#workskin .ios-input-bar .input-placeholder{flex:1;background:${colour.inputFieldBg};border:1px solid ${colour.inputFieldBorder};border-radius:1.286em;padding:0.571em 0.857em;font-size:0.875em;color:${colour.inputPlaceholderColor};}
/* Four .group-sender-row rules and three overrides of the avatar classes stood
   here. All of them were dead. The wrapper they styled came from a branch of
   the shared msgHTML that this renderer returns before ever reaching, so it was
   never emitted; the .group-avatar and .group-avatar-initials overrides
   restated the rules already set above, at a larger size and with !important,
   and the .group-sender rule named a class iMessage does not use — its sender
   is .ios-group-sender. Three sources disagreed about the size and display mode
   of one element and not one of them was reachable.
   The live rules are above, beside .ios-group-sender. */
${getTextFormattingCSS(isDark, 15)}
#workskin .wm{margin-top:1.778em;font-size:0.563em;opacity:0.45;text-align:center;color:${colour.timeBreakColor};}
${VISUALLY_HIDDEN_CSS}`;
}

/**
 * WhatsApp colour, both themes side by side. See TEXT_FORMATTING_COLOURS.
 *
 * `senderBg` and `recvBg` are parameters for the same reason iOS's `recvBg` is:
 * in light mode both bubbles are the colour the author picked in settings, and
 * dark mode replaces them with WhatsApp's own greens and slates. Unlike iOS,
 * `buildCSS` does *not* pin these for Android — the setting reaches the
 * stylesheet, so freezing them into a static table would be a visible bug.
 *
 * `bubbleShadow` is not a colour but it varies with the theme in exactly the
 * same way, so it lives here rather than as the one surviving ternary.
 */
function androidColours(senderBg: string, recvBg: string) {
  return {
    light: {
      chatBg: '#ece5dd',
      headerBgColor: '#075e54',
      footerBgColor: '#f0f0f0',
      footerBorderColor: '#d1d7db',
      senderBubbleBg: senderBg,
      receiverBubbleBg: recvBg,
      bubbleTextColor: '#000',
      timeColor: 'rgba(0,0,0,0.45)',
      senderNameColor: 'rgba(100,100,100,0.8)',
      timeBreakColor: '#667781',
      typingLabelColor: 'rgba(0,0,0,0.6)',
      typingDotBg: 'rgba(0,0,0,0.4)',
      avatarPlaceholderBg: '#128c7e',
      // The neutral fill behind a monogram avatar, matching the iOS palette
      // key of the same name. Deliberately NOT avatarPlaceholderBg: that is
      // solid brand teal, and the monogram is painted in the participant's
      // tone on top of it, which would be teal on teal.
      cardBg: 'rgba(0,0,0,0.06)',
      bubbleShadow: '0 1px 2px rgba(0,0,0,0.1)',
      // WhatsApp draws the reaction as a pill in the surface colour, attached
      // to the bubble — not as a bare emoji floating under it.
      reactionChipBg: '#fff',
      reactionChipBorder: 'rgba(0,0,0,0.08)',
    },
    dark: {
      chatBg: '#0b141a',
      headerBgColor: '#1f2c34',
      footerBgColor: '#1f2c34',
      footerBorderColor: '#2a3942',
      senderBubbleBg: '#005c4b',
      receiverBubbleBg: '#1f2c34',
      bubbleTextColor: '#e9edef',
      timeColor: 'rgba(255,255,255,0.6)',
      senderNameColor: 'rgba(255,255,255,0.7)',
      timeBreakColor: '#8696a0',
      typingLabelColor: 'rgba(255,255,255,0.6)',
      typingDotBg: 'rgba(255,255,255,0.4)',
      avatarPlaceholderBg: '#00a884',
      cardBg: 'rgba(255,255,255,0.12)',
      bubbleShadow: '0 1px 2px rgba(0,0,0,0.3)',
      reactionChipBg: '#233138',
      reactionChipBorder: 'rgba(255,255,255,0.08)',
    },
  };
}

function buildAndroidCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.androidDarkMode;
  const colour = androidColours(senderBg, recvBg)[isDark ? 'dark' : 'light'];
  const cssUrl = (value: string | undefined) => value && /^https:\/\/[^'"()<>\s]+$/i.test(value) ? value : '';
  const headerImage = cssUrl(s.androidHeaderImageUrl);
  const footerImage = cssUrl(s.androidFooterImageUrl);
  const wallpaper = cssUrl(s.androidWallpaperUrl);
  const headerBg = headerImage ? `background:url('${headerImage}') no-repeat center;background-size:100% auto;` : `background:${colour.headerBgColor};`;
  const footerBg = footerImage ? `background:url('${footerImage}') no-repeat center;background-size:100% auto;` : `background:${colour.footerBgColor};`;
  const messageBg = wallpaper ? `background-color:${colour.chatBg};background-image:url('${wallpaper}');background-position:center top;background-repeat:repeat;` : `background:${colour.chatBg};`;
  const viewport = Math.max(20, Math.min(60, Math.round(s.androidViewportHeightEm || 30)));
  const tones = WHATSAPP_PARTICIPANT_TONES.map(tone => {
    const value = isDark ? tone.dark : tone.light;
    return `#workskin .wa-tone-${tone.id}{color:${value};}\n#workskin .wa-reply-${tone.id}{border-left-color:${value};}`;
  }).join('\n');

  return `/* Generated with AO3 SkinGen */
#workskin .chat{width:100%;max-width:${emFromPx(Math.min(maxWidth, 400))};min-width:20em;margin:0 auto;display:flex;flex-direction:column;font-family:${s.fontFamily};background:${colour.chatBg};padding:0;border-radius:1.25em;overflow:hidden;}
${PARAGRAPH_RESET_CSS}
#workskin .android-header{${headerBg}min-height:3.75em;display:flex;align-items:center;color:#fff;padding:0.35em 0.65em;overflow:hidden;}
#workskin .wa-back{font-size:2em;line-height:1;margin-right:0.25em;}
#workskin .android-header-avatar,#workskin .android-header-avatar-placeholder{width:2.5em;height:2.5em;border-radius:50%;display:block;flex-shrink:0;margin-right:0.65em;border:0.125em solid rgba(255,255,255,0.2);}
#workskin .android-header-avatar-placeholder{background:${colour.avatarPlaceholderBg};color:#fff;text-align:center;line-height:2.5em;font-weight:600;}
#workskin .android-header-name-wrapper{min-width:0;flex:1;color:#fff;overflow:hidden;}
#workskin .android-header-name{font-size:1em;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#workskin .android-header-subtitle{font-size:0.75em;line-height:1.2;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
#workskin .wa-header-actions{font-size:1.3em;white-space:nowrap;margin-left:0.5em;}
#workskin .chat-messages{padding:0.75em 0.5em;${messageBg}}
#workskin .chat.wa-scroll .chat-messages{height:${viewport}em;overflow-y:auto;overflow-x:hidden;}
#workskin .row{display:flex;width:100%;align-items:flex-end;}
#workskin .row.single{margin:0.7em 0;}
#workskin .row.first{margin:0.7em 0 0.12em 0;}
#workskin .row.middle{margin:0.12em 0;}
#workskin .row.last{margin:0.12em 0 0.7em 0;}
#workskin .row.out{justify-content:flex-end;}
#workskin .row.in{justify-content:flex-start;}
#workskin dl.msg{margin:0;display:flex;flex-direction:column;max-width:82%;}
#workskin .row.out dl.msg{align-items:flex-end;}
#workskin .row.in dl.msg{align-items:flex-start;}
#workskin dd{margin:0;}
#workskin dd.bubble{position:relative;display:inline-block;min-width:2.5em;max-width:20em;padding:0.5em 0.714em;border-radius:0.571em;line-height:1.4;font-size:0.875em;box-shadow:${colour.bubbleShadow};white-space:normal;word-break:keep-all;overflow-wrap:anywhere;}
/* WhatsApp media uses the ordinary bubble's existing 20em ceiling as a real
   width. The msg wrapper still keeps every message inside the platform's side
   gutter; the media box itself no longer shrink-wraps around a reply excerpt
   or sender name. Single images and collages therefore render consistently. */
#workskin dd.bubble.image-bubble{width:20em;max-width:100%;box-sizing:border-box;overflow:visible;}
#workskin dd.bubble.out{background:${colour.senderBubbleBg};color:${colour.bubbleTextColor};}
#workskin dd.bubble.in{background:${colour.receiverBubbleBg};color:${colour.bubbleTextColor};}
#workskin .row.out.last dd.bubble,#workskin .row.out.single dd.bubble{border-bottom-right-radius:0.143em;}
#workskin .row.in.last dd.bubble,#workskin .row.in.single dd.bubble{border-bottom-left-radius:0.143em;}
#workskin .group-sender{display:block;font-size:0.8em;font-weight:700;line-height:1.2;margin-bottom:0.35em;}
/* The participant avatar, which WhatsApp group chats never drew. It lives
   inside .group-sender, so both of these size themselves against that
   element's 0.8em rather than the bubble's.

   The monogram takes its colour from the wa-tone class on the parent, which is
   the whole point: a tone is a finite enum compiled to a class, so it survives
   AO3. A free hex in a style attribute would not — the archive strips inline
   styles, and the preview and the published work would disagree.

   No object-fit: not on AO3's list and it has no legal equivalent, so a
   non-square avatar letterboxes into the circle rather than cropping. */
#workskin .group-sender .group-avatar,#workskin .group-sender .group-avatar-initials{display:inline-block;width:1.667em;height:1.667em;border-radius:50%;vertical-align:middle;margin-right:0.35em;flex-shrink:0;}
/* 0.75 x 1.667 = 1.25em of the sender line, and two bold letters at 0.75em
   need about 1.44 of their own em against the 1.667 they are given — it fits,
   but only just, which is how the iMessage variant above came to wrap. nowrap
   holds the pair on one line if a font ever measures wider than this one. */
#workskin .group-sender .group-avatar-initials{background:${colour.cardBg};color:inherit;text-align:center;line-height:1.667em;font-size:0.75em;font-weight:700;white-space:nowrap;}
${tones}
#workskin .message-text{display:inline;}
#workskin .wa-reply{display:block;margin:0 0 0.45em 0;padding:0.4em 0.5em;border-left:0.25em solid #667781;border-radius:0.25em;background:rgba(0,0,0,0.06);font-style:normal;}
#workskin .wa-reply b,#workskin .wa-reply span{display:block;}
#workskin .wa-reply span{font-size:0.9em;max-height:3.8em;overflow:hidden;}
#workskin .wa-reply-missing{border-left-color:#b3261e;}
#workskin .wa-images{display:block;margin-top:0.4em;font-size:0;overflow:hidden;border-radius:0.45em;}
#workskin .wa-image{display:block;width:100%;height:auto;margin:0;}
${imageCompositionCSS('.wa-images')}
#workskin .wa-link-preview{display:block;margin-top:0.4em;border-radius:0.4em;overflow:hidden;background:rgba(0,0,0,0.07);color:inherit;text-decoration:none;padding-bottom:0.4em;}
#workskin .wa-link-preview b,#workskin .wa-link-preview span{display:block;margin:0.25em 0.5em 0 0.5em;}
#workskin .wa-link-image{display:block;width:100%;height:auto;margin:0;}
#workskin .wa-link-description{font-size:0.9em;opacity:0.85;}
#workskin .wa-link-site,#workskin .wa-link-url{font-size:0.78em;opacity:0.7;overflow-wrap:anywhere;}
#workskin .wa-media{display:block;position:relative;margin-top:0.4em;padding:0.5em;border-radius:0.45em;background:rgba(0,0,0,0.06);overflow:hidden;}
#workskin .wa-play{display:inline-block;width:1.8em;vertical-align:middle;}
#workskin .wa-waveform{display:inline-block;width:12em;height:2.2em;vertical-align:middle;white-space:nowrap;overflow:hidden;}
#workskin .wa-wave-bar{display:inline-block;width:0.14em;margin-right:0.12em;vertical-align:middle;background:${isDark ? '#8696a0' : '#667781'};border-radius:0.1em;}
#workskin .wa-wave-1{height:0.4em;}#workskin .wa-wave-2{height:0.7em;}#workskin .wa-wave-3{height:1em;}#workskin .wa-wave-4{height:1.3em;}#workskin .wa-wave-5{height:1.6em;}#workskin .wa-wave-6{height:1.9em;}
#workskin .wa-duration,#workskin .wa-transcript,#workskin .wa-media-description,#workskin .wa-captions,#workskin .wa-media-source{display:block;font-size:0.78em;margin-top:0.25em;}
#workskin .wa-media-source{color:inherit;text-decoration:underline;overflow-wrap:anywhere;}
#workskin .wa-video-poster,#workskin .wa-native-video,#workskin .wa-youtube-player iframe{display:block;width:100%;height:auto;border:0;border-radius:0.35em;background:#000;}
#workskin .wa-youtube-player iframe{height:11.25em;max-width:100%;}
#workskin .wa-video-placeholder{display:block;box-sizing:border-box;min-height:8em;padding:3.5em 1em;text-align:center;background:#1f2c34;color:#aebac1;border-radius:0.35em;}
#workskin .wa-video-play{position:absolute;left:46%;top:2.5em;font-size:2em;color:#fff;text-shadow:0 1px 3px #000;}
#workskin .wa-native-audio{display:block;width:100%;margin-top:0.45em;}
#workskin dd.bubble .time{display:block;font-size:0.714em;color:${colour.timeColor};margin-top:0.4em;text-align:right;padding-right:2.4em;}
#workskin .wa-ticks{position:absolute;right:0.55em;bottom:0.45em;font-size:0.75em;color:${colour.timeColor};letter-spacing:-0.2em;}
#workskin .wa-ticks-read{color:#53bdeb;}
#workskin .wa-reactions{position:absolute;bottom:-1.65em;background:${colour.reactionChipBg};border:0.071em solid ${colour.reactionChipBorder};border-radius:0.857em;padding:0.1em 0.45em;font-size:0.857em;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,0.15);white-space:nowrap;z-index:2;}
#workskin dd.bubble.out .wa-reactions{right:0.75em;}
#workskin dd.bubble.in .wa-reactions{left:0.75em;}
#workskin dd.bubble.has-reaction{margin-bottom:2em;}
#workskin .wa-event{text-align:center;margin:0.8em 0;color:${colour.timeBreakColor};}
#workskin .wa-event dl{margin:0;}
#workskin .wa-event dd{display:inline-block;background:${isDark ? '#182229' : '#fff5c4'};border-radius:0.5em;padding:0.4em 0.65em;font-size:0.75em;box-shadow:${colour.bubbleShadow};}
#workskin .wa-event-system dd{max-width:82%;}
#workskin dd.bubble.emoji-only{background:transparent;box-shadow:none;padding:0.143em 0.214em;border-radius:0;overflow:visible;}
#workskin dd.bubble.emoji-only .emoji-content{display:block;line-height:1.05;white-space:nowrap;}
#workskin dd.bubble.emoji1 .emoji-content{font-size:4.286em;}
#workskin dd.bubble.emoji2 .emoji-content{font-size:2.571em;}
#workskin .row.typing{align-items:center;}
#workskin .typing-bubble{background:${colour.receiverBubbleBg};padding:0.625em 0.875em;border-radius:0.5em;display:inline-block;line-height:0;box-shadow:${colour.bubbleShadow};}
#workskin .typing-bubble .dot{display:inline-block;vertical-align:middle;width:0.5em;height:0.5em;margin-left:0.25em;background:${colour.typingDotBg};border-radius:50%;opacity:0.4;}
#workskin .typing-bubble .dot:first-child{margin-left:0;}
#workskin .typing-bubble .dot:nth-child(1){opacity:0.85;}
#workskin .typing-bubble .dot:nth-child(2){opacity:0.65;}
#workskin .typing-label{font-size:0.688em;color:${colour.typingLabelColor};margin-left:0.4em;}
#workskin .android-footer{${footerBg}min-height:3.75em;border-top:0.063em solid ${colour.footerBorderColor};display:flex;align-items:center;padding:0 0.6em;color:${isDark ? '#e9edef' : '#54656f'};}
#workskin .wa-footer-plus,#workskin .wa-footer-mic{width:2em;text-align:center;font-size:1.35em;}
#workskin .wa-footer-input{flex:1;background:${isDark ? '#2a3942' : '#fff'};border-radius:1.25em;padding:0.55em 0.9em;color:${isDark ? '#8696a0' : '#667781'};font-size:0.9em;}
${getTextFormattingCSS(isDark, 14)}
#workskin .wm{margin-top:1.333em;font-size:0.563em;opacity:0.45;text-align:center;color:${colour.timeBreakColor};}
${VISUALLY_HIDDEN_CSS}`;
}

/**
 * Twitter colour, both themes side by side. See TEXT_FORMATTING_COLOURS.
 *
 * The only fully static table of the four: nothing here falls back to the
 * author's bubble colour, so it needs no parameters. (`buildTwitterCSS` still
 * takes `senderBg`; it does not use it.)
 */
const TWITTER_COLOURS = {
  light: {
    bgColor: '#fff',
    bgHover: '#f7f9f9',
    textPrimary: '#0f1419',
    textSecondary: '#536471',
    borderColor: '#eff3f4',
    handleColor: '#71767b',
    quoteHover: '#f7f9f9',
    replyLineColor: '#cfd9de',
  },
  dim: {
    bgColor: '#15202b',
    bgHover: '#1c2732',
    textPrimary: '#f7f9f9',
    textSecondary: '#8b98a5',
    borderColor: '#38444d',
    handleColor: '#8b98a5',
    quoteHover: '#1c2732',
    replyLineColor: '#536471',
  },
  dark: {
    bgColor: '#000',
    bgHover: '#080808',
    textPrimary: '#e7e9ea',
    textSecondary: '#71767b',
    borderColor: '#2f3336',
    handleColor: '#71767b',
    quoteHover: '#080808',
    replyLineColor: '#333639',
  },
} as const;

function buildTwitterCSS(s: SkinProject['settings'], senderBg: string, maxWidth: number): string {
  const theme = resolveTwitterTheme(s);
  const isDark = theme !== 'light';
  const colour = TWITTER_COLOURS[theme];
  const pollWidths = Array.from({ length: 21 }, (_, index) =>
    `#workskin .tweet .poll-pct-${index * 5}{width:${index * 5}%;}`
  ).join('');

  return `/* Generated with AO3 SkinGen */
/* NOTE ON UNITS. Sizes here are em, not px, and that is the whole reason this
   card works on a phone. AO3 forbids @media blocks in skin CSS — media is a
   field on the skin record, not something you can write here — so a breakpoint
   is not available to us. Sizing in em is what every "scalable" community work
   skin does instead, and AO3's own FAQ pushes it: "We highly encourage learning
   about and using em, which lets you set dimensions relative to the user's
   current font size. This will make your layouts much more flexible and
   responsive to different browser and font settings, and improve their
   accessibility to users with differing needs."

   Every value below was converted against its own rule's font-size context, so
   at a 16px base this renders identically to the px version it replaced — the
   PNG export is unchanged. On AO3, where .userstuff computes to roughly 15px,
   the card scales down to match the reader's text instead of overhanging it.

   Hairline borders stay in px on purpose: a 1px rule should stay 1px at any
   text size. So does the clipped box in the visually-hidden rule, which is not
   layout at all.

   Keep decimals to three places. AO3's number grammar is
   -?\\.?\\d{1,3}\\.?\\d{0,3}, so 0.9375em is parsed as "0.937" + "5em" and our
   lint — which tokenises rather than re-scanning — rejects it. 0.938em is fine. */
#workskin .chat{width:34.375em;max-width:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0 auto;box-sizing:border-box;}
${PARAGRAPH_RESET_CSS}
#workskin .tweets .tweet{background:${colour.bgColor};border:1px solid ${colour.borderColor};border-radius:1em;padding:1em;margin:0 0 0.75em 0;position:relative;box-sizing:border-box;transition:background-color 0.2s;}
#workskin .tweets .tweet:hover{background:${colour.bgHover};}
#workskin .tweets .tweet.reply{margin-left:2.75em;margin-top:-0.5em;}
#workskin .tweets .tweet.reply::before{content:'';position:absolute;left:-2em;top:-0.5em;bottom:0.75em;width:2px;background:${colour.replyLineColor};}
#workskin .tweets .tweet.reply::after{content:'';position:absolute;left:-2em;top:1.25em;width:1.25em;height:2px;background:${colour.replyLineColor};}
/* NOTE ON GAP. AO3 accepts a property only if it is on its list or CONTAINS
   one of its shorthand names as a substring. column-gap passes (it contains
   "column"); bare gap matches nothing and is rejected — and AO3 refuses the
   entire skin over one bad property, so this CSS could never be pasted as a
   work skin while it used gap. The margins below are the same spacing by
   other means, and keep this stylesheet legal for both the image path and the
   work skin path. Do not reintroduce gap here. */
/* NOTE ON LAYOUT. Float and inline-block, not flexbox — on purpose.
   Every established AO3 Twitter work skin builds the avatar/post split with
   float:left plus overflow:hidden, and none of them use flex. Our own
   flex version renders correctly in this app and in a local AO3 simulation,
   but wrong on the real archive: the name line right-aligns and the X logo
   drops to its own line. Whatever the archive is doing to those declarations,
   float and inline-block are what the community has already proved survives
   it, and they degrade to something readable if a rule is dropped rather than
   collapsing the layout. Do not convert this back to flex. */
#workskin .tweet-header{overflow:hidden;margin-bottom:0.75em;position:relative;}
#workskin .tweet img.avatar{width:2.5em;height:2.5em;border-radius:50%;float:left;margin-right:0.75em;}
#workskin .tweet .head{overflow:hidden;}
#workskin .tweet .head-content{display:block;}
/* No white-space:nowrap here — .head establishes a block formatting context to
   clear the floated avatar, so anything that overflows the line is clipped
   rather than shown. .name and .handle carry their own nowrap, so they stay
   whole while the line itself is free to wrap. */
#workskin .tweet .name-line{line-height:1.25;}
/* Descendant selectors, not a child combinator. AO3 collapses this whole line
   into a single paragraph, so the combinator matches that paragraph and puts
   the 0.25em on the wrapper instead of on the name, handle and Follow label —
   which is why a real save read "Jamie Chen @jamiechen-Follow" with nothing
   between the parts. Naming the element types reaches them through the
   injected paragraph. The logo takes the last-child reset by class, for the
   same reason. */
#workskin .tweet .name-line .name,#workskin .tweet .name-line .verified-container,#workskin .tweet .name-line .handle,#workskin .tweet .name-line .follow-dot,#workskin .tweet .name-line .follow-btn,#workskin .tweet .name-line .twitter-logo{display:inline-block;vertical-align:middle;margin-right:0.25em;}
#workskin .tweet .name-line .twitter-logo{margin-right:0;}
#workskin .tweet .name{font-weight:700;color:${colour.textPrimary};font-size:0.938em;line-height:1.333;white-space:nowrap;}
#workskin .tweet .verified-container{display:inline-block;vertical-align:middle;}
/* THE VERIFIED TICK IS DRAWN, NOT FETCHED. It used to be an 18px PNG on our
   CDN, and every chrome image is a request from inside a published fic — a
   twenty-tweet thread was a hundred of them, forever. That is not theoretical:
   a WhatsApp skin author outgrew a free Cloudinary tier and every image in
   every fic using their skin broke at once (KNOWLEDGE §7, §11).
   A circle with a character in it costs nothing, scales with the reader's text
   instead of being pinned to 18px, and survives a reader who blocks images.
   The glyph is a real text node rather than a content:'' pseudo-element
   BECAUSE THIS SHEET
   ALSO DRIVES THE PNG and html2canvas cannot rasterise a pseudo-element.
   Sizing note: the geometry is em of the badge's OWN font-size, so the box
   stays 18px while the glyph inside it is 11px. Change font-size and the
   circle resizes with it — which is what the expanded and quote variants below
   do, instead of restating the geometry.
   The height comes from line-height:1 plus symmetric padding rather than
   from a tall line box, AND THAT IS NOT A STYLE CHOICE. html2canvas places a
   glyph from the top of the content box, so centring by line-height put the
   tick below the circle — white on a white card, i.e. a badge that rasterised
   as an empty blue disc. Padding is measured the same way by both renderers.
   Verified by exporting a PNG, not by reasoning about it. */
#workskin .tweet .verified-badge{display:inline-block;vertical-align:middle;font-size:0.688em;width:1.636em;line-height:1;padding:0.318em 0;text-align:center;font-weight:700;color:#fff;background:#1d9bf0;border-radius:50%;}
#workskin .tweet .handle{color:${colour.handleColor};font-weight:400;font-size:0.938em;line-height:1.333;white-space:nowrap;}
#workskin .tweet .follow-dot{color:${colour.handleColor};font-size:0.938em;line-height:1.333;}
#workskin .tweet .follow-btn{background:transparent;color:#1d9bf0;font-weight:700;font-size:0.938em;padding:0;border:none;cursor:pointer;line-height:1.333;flex-shrink:0;white-space:nowrap;}
#workskin .tweet .follow-btn:hover{color:#1a8cd8;text-decoration:underline;}
#workskin .tweet .twitter-logo{width:1.25em;height:1.25em;display:inline-block;vertical-align:middle;}
#workskin .tweet .body{margin-top:0.8em;font-size:0.938em;line-height:1.333;color:${colour.textPrimary};word-wrap:break-word;white-space:pre-wrap;}
#workskin .tweet .body .hashtag{color:#1d9bf0;font-weight:400;}
#workskin .tweet .body .mention{color:#1d9bf0;font-weight:400;}
#workskin .tweet .tweet-image{width:100%;max-width:100%;height:auto;max-height:17.813em;border-radius:1em;margin-top:0.75em;border:1px solid ${colour.borderColor};display:block;}
#workskin .tweet .twitter-media-grid{display:block;width:100%;margin-top:0.75em;border:1px solid ${colour.borderColor};border-radius:0.75em;overflow:hidden;box-sizing:border-box;font-size:0;}
#workskin .tweet .twitter-media-image{display:block;width:100%;max-width:100%;height:auto;margin:0;box-sizing:border-box;}
${imageCompositionCSS('.tweet .twitter-media-grid')}
#workskin .tweet .media-crop-fill-width .twitter-media-image{width:100%;height:auto;}
#workskin .tweet .media-crop-fill-height{height:14em;}
#workskin .tweet .media-crop-fill-height .twitter-media-image{height:14em;width:auto;max-width:none;}
#workskin .tweet .quote-media{margin-top:0.5em;}
#workskin .tweet .twitter-video-card{margin-top:0.75em;border:1px solid ${colour.borderColor};border-radius:0.75em;overflow:hidden;background:${colour.bgColor};white-space:normal;}
#workskin .tweet .video-source{display:block;color:${colour.textPrimary};text-decoration:none;}
#workskin .tweet .video-poster-wrap{display:block;position:relative;min-height:8em;background:${colour.bgHover};overflow:hidden;}
#workskin .tweet .video-poster{display:block;width:100%;height:auto;}
#workskin .tweet .video-poster-placeholder{display:block;text-align:center;padding:4em 1em;color:${colour.textSecondary};}
#workskin .tweet .video-play{position:absolute;left:50%;top:50%;margin-left:-1.25em;margin-top:-1.25em;width:2.5em;line-height:2.5;text-align:center;border-radius:50%;background:rgba(0,0,0,0.72);color:#fff;}
#workskin .tweet .video-duration{position:absolute;right:0.5em;bottom:0.5em;padding:0.125em 0.375em;border-radius:0.25em;background:rgba(0,0,0,0.78);color:#fff;font-size:0.75em;}
#workskin .tweet .video-title{display:block;padding:0.625em 0.75em 0;color:${colour.textPrimary};}
#workskin .tweet .video-description,#workskin .tweet .video-captions,#workskin .tweet .video-fallback{padding:0.375em 0.75em 0;color:${colour.textSecondary};font-size:0.813em;line-height:1.385;}
#workskin .tweet .video-fallback{padding-bottom:0.75em;word-break:break-word;}
#workskin .tweet .video-captions a,#workskin .tweet .video-fallback a{color:#1d9bf0;}
#workskin .tweet .twitter-video-player iframe,#workskin .tweet .twitter-native-video{display:block;width:100%;max-width:100%;height:19.688em;border:0;background:#000;}
#workskin .tweet .translation-context{margin-top:0.5em;color:#1d9bf0;font-size:0.813em;}
#workskin .tweet .account-label{display:inline-block;margin-top:0.286em;padding:0.143em 0.429em;border:1px solid ${colour.borderColor};border-radius:0.286em;color:${colour.textSecondary};font-size:0.75em;line-height:1.333;}
#workskin .tweets .tweet-activity{margin:0.25em 0 0.375em 1em;color:${colour.textSecondary};font-size:0.813em;font-weight:700;}
#workskin .tweet .twitter-poll{margin-top:0.75em;white-space:normal;}
#workskin .tweet .poll-option{position:relative;overflow:hidden;margin-top:0.375em;padding:0.5em 0.625em;border-radius:0.375em;background:${colour.bgHover};color:${colour.textPrimary};}
#workskin .tweet .poll-bar{position:absolute;left:0;top:0;bottom:0;background:#cfe8fa;}
#workskin .tweet .poll-option.selected{border:2px solid #1d9bf0;}
#workskin .tweet .poll-option.winner{font-weight:700;}
#workskin .tweet .poll-option-text,#workskin .tweet .poll-percent,#workskin .tweet .poll-state{position:relative;z-index:1;}
#workskin .tweet .poll-percent{float:right;margin-left:0.5em;}
#workskin .tweet .poll-state{font-size:0.75em;color:${colour.textSecondary};}
#workskin .tweet .poll-footer{margin-top:0.5em;color:${colour.textSecondary};font-size:0.813em;}
${pollWidths}
#workskin .tweet .time-line{margin-top:1.067em;font-size:0.938em;color:${colour.textSecondary};padding-bottom:1.067em;border-bottom:1px solid ${colour.borderColor};}
#workskin .tweet.no-metrics .time-line{padding-bottom:0;border-bottom:none;}
/* Flex is kept HERE only because its failure mode is graceful: if the
   archive drops it, the metric chips fall back to inline-block and bunch to
   the left, which still reads fine. The header above could not tolerate that. */
#workskin .tweet .metrics{display:flex;justify-content:space-between;padding:0.857em 0;font-size:0.875em;color:${colour.textSecondary};border-bottom:1px solid ${colour.borderColor};width:100%;}
/* THE ONE RULE THAT ONLY EXISTS FOR AO3, and it costs the PNG nothing.
   We never emit a <p> inside .metrics — but AO3 does. It collapses the whole
   run of chips into a SINGLE paragraph, which then becomes the only flex item,
   so space-between has nothing to distribute and all three counts bunch to the
   left. That is exactly what a real save looked like.
   display:contents removes the injected paragraph from the layout tree without
   removing it from the DOM, so the chips are direct flex items again and the
   row spreads as designed. Since no such paragraph exists in the preview, this
   rule matches nothing there and the image export is byte-identical.
   Note it does NOT rescue a child combinator, which selects on DOM structure —
   something display:contents does not change. That is why .name-line above had
   to move to descendant selectors instead. The two fixes are complementary. */
#workskin .tweet .metrics p{display:contents;}
#workskin .tweet .metric{display:inline-block;cursor:pointer;transition:color 0.2s;margin-right:1.286em;}
#workskin .tweet .metric:first-child{justify-content:flex-start;}
#workskin .tweet .metric:last-child{margin-right:0;}
#workskin .tweet .metric-icon{width:1.429em;height:1.429em;display:inline-block;vertical-align:middle;margin-right:0.429em;}
/* ALL THREE METRIC ICONS ARE CHARACTERS. They used to be blue-circle PNGs on
   our CDN, which meant a reader fetched three of them per tweet every time
   they opened the chapter — a twenty-tweet thread was a hundred requests
   inside somebody's published fic, forever, and a WhatsApp skin author already
   lost every image in every fic using their skin when a free tier ran out
   (KNOWLEDGE §7, §19).
   The glyphs are also closer to the real site than the circles were: Twitter
   draws a grey outline heart, not a filled disc. They take the metric colour,
   so the hover tints below now reach the icon as well, and dark mode needs no
   second set of files.
   Deliberately NOT a fixed box: these are ordinary inline text, because a
   glyph centred inside a small box is what html2canvas cannot rasterise (see
   .verified-badge). As plain text it rasterises like every other word here.
   1.286em of the 14px metrics context is 18px, which is the size the real
   site uses and close enough to the 20px images that the row does not jump. */
#workskin .tweet .glyph-icon{font-size:1.286em;line-height:1;margin-right:0.222em;vertical-align:-0.111em;}
#workskin .tweet .metric-count{color:${colour.textSecondary};font-weight:400;font-size:1em;line-height:1.429;vertical-align:middle;}
#workskin .tweet .metric:hover .metric-count{text-decoration:underline;}
#workskin .tweet .metric.replies:hover{color:#1d9bf0;}
#workskin .tweet .metric.replies:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.retweets:hover{color:#00ba7c;}
#workskin .tweet .metric.retweets:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.likes:hover{color:#f91880;}
#workskin .tweet .metric.likes:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.bookmarks:hover{color:#1d9bf0;}
#workskin .tweet .metric.bookmarks:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.views:hover{color:${colour.textSecondary};}
#workskin .tweet .metric.views:hover .metric-icon{opacity:1;}
#workskin .tweet .replying-to{font-size:0.813em;color:${colour.textSecondary};margin:0.615em 0 0.308em 0;line-height:1.231;}
#workskin .tweet .replying-to .reply-handle{color:#1d9bf0;text-decoration:none;}
#workskin .tweet .replying-to .reply-handle:hover{text-decoration:underline;}
/* position:relative so the X logo can sit in the card's corner, the way the
   real detail view draws it. AO3 allows position, top and right — all three
   are on the allowlist — so this survives the archive. It must be a stylesheet
   rule and not an inline style: AO3 strips inline styles outright, and the app
   and the archive would then disagree about where the logo is. */
#workskin .tweet.expanded{padding:1em;display:flex;margin-left:-0.75em;position:relative;}
#workskin .tweet.expanded > *{margin-left:0.75em;}
/* Out of flow, so the flex row above never lays it out and the -0.75em/0.75em
   margin pair cannot shift it. Matches the card's 1em padding.

   Descendant selector plus display:contents, both required, for the reason
   spelled out at .quote-head below. AO3 wraps a bare <img> child in a
   paragraph of its own, and that paragraph then becomes a real flex item: a
   child combinator here stopped matching the moment the wrapper appeared, the
   logo dropped back into flow inside it, and .expanded-content lost 31px of
   width under injection. Measured, not guessed — ao3-injection.spec.ts caught
   it. The descendant selector keeps positioning the image through the wrapper;
   display:contents keeps the wrapper from taking any width. */
#workskin .tweet.expanded > p{display:contents;}
#workskin .tweet.expanded .twitter-logo{position:absolute;top:1em;right:1em;margin:0;width:1.25em;height:1.25em;display:block;}
#workskin .tweet.expanded .avatar{width:2.5em;height:2.5em;flex-shrink:0;margin:0;}
#workskin .tweet.expanded .expanded-content{flex:1;min-width:0;}
#workskin .tweet.expanded .expanded-name{display:flex;align-items:center;margin-bottom:0.125em;margin-left:-0.25em;}
#workskin .tweet.expanded .expanded-name p{display:contents;}
#workskin .tweet.expanded .expanded-name .name,#workskin .tweet.expanded .expanded-name .verified-container{margin-left:0.25em;}
#workskin .tweet.expanded .expanded-name .name{font-weight:700;color:${colour.textPrimary};font-size:1.25em;line-height:1.2;}
/* 20px instead of 18px, stated once as a font-size — the badge's own geometry
   is in em of this, so the circle follows the glyph. */
#workskin .tweet.expanded .expanded-name .verified-badge{font-size:0.764em;}

#workskin .tweet.expanded .expanded-handle{color:${colour.textSecondary};font-size:0.938em;line-height:1.333;margin-bottom:0.267em;}
#workskin .tweet.expanded .expanded-handle .handle{color:inherit;font-size:1em;line-height:inherit;}
#workskin .tweet.expanded .replying-to{margin:0 0 0.923em 0;}
#workskin .tweet.expanded .expanded-body{font-size:1.438em;line-height:1.217;color:${colour.textPrimary};word-wrap:break-word;white-space:pre-wrap;}
#workskin .tweet.expanded .tweet-image{margin-top:1em;}
#workskin .tweet.expanded .time-line{border:none;padding:0;margin-top:1.067em;}
#workskin .tweet .quote{border:1px solid ${colour.borderColor};border-radius:0.75em;padding:0.75em;margin-top:0.75em;transition:background-color 0.2s;cursor:pointer;}
#workskin .tweet .quote:hover{background:${colour.quoteHover};}
#workskin .tweet .quote-head{display:flex;align-items:center;font-size:0.875em;line-height:1.143;margin-bottom:0.286em;margin-left:-0.286em;}
/* Descendant selectors plus display:contents — this row needs BOTH fixes.
   contents makes the injected paragraph stop being the single flex item;
   naming the element types gets the gap margin past it, since a child
   combinator would still match the paragraph. Measured: without these the
   quote handle slid 3px left and the line shifted 1px. */
#workskin .tweet .quote-head p{display:contents;}
#workskin .tweet .quote-head .quote-avatar,#workskin .tweet .quote-head .quote-name,#workskin .tweet .quote-head .quote-verified-container,#workskin .tweet .quote-head .quote-handle{margin-left:0.286em;}
#workskin .tweet .quote-name{font-weight:700;color:${colour.textPrimary};}
#workskin .tweet .quote-avatar{width:1.429em;height:1.429em;border-radius:50%;overflow:hidden;}
#workskin .tweet .quote-verified-container{display:inline-flex;align-items:center;margin-left:-0.143em;}
#workskin .tweet .quote-verified-container > *{margin-left:0.143em;}
/* Same drawn badge, 16px inside a 14px quote head. */
#workskin .tweet .quote-verified-badge{display:inline-block;vertical-align:middle;font-size:0.699em;width:1.636em;line-height:1;padding:0.318em 0;text-align:center;font-weight:700;color:#fff;background:#1d9bf0;border-radius:50%;}

#workskin .tweet .quote-handle{color:${colour.textSecondary};font-weight:400;font-size:1em;}
#workskin .tweet .quote-body{margin-top:0.267em;font-size:0.938em;line-height:1.333;color:${colour.textPrimary};}
#workskin .tweet .quote-image{width:100%;height:auto;border-radius:0.75em;margin-top:0.75em;border:1px solid ${colour.borderColor};}
#workskin .tweets .wm{margin-top:1.2em;font-size:0.563em;opacity:0.45;text-align:center;color:${colour.textSecondary};}
#workskin .link{text-decoration:none;color:#1d9bf0;}
${VISUALLY_HIDDEN_CSS}`;
}

function buildGoogleCSS(maxWidth: number): string {
  return `/* Generated with AO3 SkinGen */
#workskin .chat{width:100%;min-width:20em;max-width:${emFromPx(Math.min(maxWidth, 600))};margin:0 auto;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;padding:1.25em 0;}
${PARAGRAPH_RESET_CSS}
#workskin .logo-container{text-align:center;margin:0 0 1.625em 0;padding:1.25em 0;}
#workskin .google-logo-img{height:5.75em;width:auto;display:inline-block;}
#workskin .logo{text-align:center;margin:0 0 0.5em 0;font-weight:400;font-size:3em;font-family:"Product Sans",Arial,sans-serif;line-height:1;letter-spacing:-0.01em;}
#workskin .logo.old{font-family:"Cardo","Garamond",serif;}
#workskin .logo.naver{font-family:"Maven Pro",Verdana,sans-serif;}
#workskin .naver-green{color:#2DB400;}
#workskin .blue{color:#4285F4;}#workskin .red{color:#EA4335;}#workskin .yellow{color:#FBBC04;}#workskin .green{color:#34A853;}
#workskin .search-wrap{margin-top:1.25em;max-width:36.5em;margin-left:auto;margin-right:auto;}
#workskin .search-container{background:#fff;border:1px solid #dfe1e5;border-radius:1.5em;box-shadow:0 1px 6px rgba(32,33,36,0.28);overflow:hidden;}
/* NO FLEX BELOW, AND NO > *. Both were here, and a save on the real archive
   on 7 Aug 2026 came back with the tab bar stacked one-per-line and the mic and
   lens icons sitting against the query text instead of at the right edge.

   The cause is now reproduced rather than guessed. AO3 wraps our children in
   <p>, which does not remove flex — it moves it. The injected paragraph becomes
   the flex item, so every child we were laying out is a grandchild, and the
   layout silently evaporates. margin-left:auto had nothing to push against;
   the .tab spans, still display:flex themselves, became blocks and stacked.

   THE PARAGRAPH RESET DOES NOT FIX THIS. Zeroing a <p>'s margins stops it
   adding space; it does not make it stop being a box in between. The reset is
   still worth having — it is why the gaps are not also enormous — but it is not
   a substitute for laying out in a way that survives the wrapper.

   > * is exactly as fragile as flex for the same reason, and it was our
   standard substitute for gap. An injected <p> matches > * and takes the
   margin meant for the icon inside it. Descendant selectors (.x img) survive;
   child combinators do not.

   What survives: absolute positioning (its containing block is the nearest
   POSITIONED ancestor, and an injected <p> is not one) and inline-block (which
   flows horizontally inside whatever block ends up wrapping it). This is the
   same conclusion §5a reached empirically for the Twitter header — now with a
   mechanism, and with a harness that reproduces the failure. */
#workskin .search-container .search-bar{position:relative;padding:0.688em 5em 0.688em 1em;font-size:1em;color:#202124;line-height:1.5;border-bottom:1px solid #e8eaed;white-space:nowrap;}
#workskin .search-bar-solo{position:relative;background:#fff;border:1px solid #dfe1e5;border-radius:1.5em;padding:0.688em 5em 0.688em 1em;font-size:1em;color:#202124;line-height:1.5;box-shadow:0 1px 6px rgba(32,33,36,0.28);white-space:nowrap;}
#workskin .search-icon-left{width:1.25em;height:1.25em;opacity:0.54;display:inline-block;vertical-align:middle;margin-right:0.5em;}
#workskin .search-text{color:#202124;display:inline-block;vertical-align:middle;max-width:100%;overflow:hidden;text-overflow:ellipsis;}
#workskin .search-icons-right{position:absolute;right:0.875em;top:50%;transform:translateY(-50%);}
#workskin .search-icons-right img{margin-left:0.75em;vertical-align:middle;}
#workskin .search-icon-clear{width:0.875em;height:0.875em;opacity:0.54;cursor:pointer;display:inline-block;}
#workskin .search-icon-clear:hover{opacity:0.87;}
#workskin .search-icon-mic{width:1.125em;height:1.125em;cursor:pointer;display:inline-block;}
#workskin .search-icon-lens{width:1.125em;height:1.125em;opacity:0.54;cursor:pointer;display:inline-block;}
#workskin .search-icon-lens:hover{opacity:0.87;}
#workskin .suggest-box{padding:0.5em 0;}
#workskin .suggest-item{padding:0.375em 1em;font-size:1em;line-height:1.5;color:#202124;cursor:pointer;}
#workskin .suggest-item:hover{background:#f8f9fa;}
#workskin .suggest-icon{width:1.25em;height:1.25em;opacity:0.54;display:inline-block;vertical-align:middle;margin-right:0.875em;}
#workskin .suggest-item b,#workskin .suggest-item strong{font-weight:700;color:#202124;}
#workskin .search-tabs{border-bottom:1px solid #dadce0;margin:1.25em 0 0 0;padding:0;white-space:nowrap;}
#workskin .search-tabs .tab{padding:1.077em 0.923em;font-size:0.813em;color:#5f6368;cursor:pointer;border-bottom:3px solid transparent;display:inline-block;vertical-align:bottom;}
#workskin .search-tabs .tab:first-child{margin-left:0.923em;}
#workskin .search-tabs .tab:hover{color:#202124;}
#workskin .search-tabs .tab.active{color:#1a73e8;border-bottom-color:#1a73e8;}
#workskin .search-tabs .tab-icon{width:1.231em;height:1.231em;opacity:0.87;display:inline-block;vertical-align:middle;margin-right:0.462em;}
/* p.search-stats, not .search-stats: these are the only real <p> elements we
   emit, and the paragraph reset above is (0,1,1,1). Tagging the selector with
   its element matches that specificity, and being later in the sheet wins the
   tie — so the reset still neutralises anything AO3 injects while our own two
   paragraphs keep their margins. See PARAGRAPH_RESET_CSS. */
#workskin p.search-stats{margin:0.857em 0 0 0.857em;color:#70757a;font-size:0.875em;}
#workskin p.search-dym{margin:1em 0 0 0.75em;font-size:1em;line-height:1.5;}
#workskin .search-dym1{color:#5f6368;}
#workskin .search-dym2{color:#1a0dab;font-weight:400;text-decoration:none;cursor:pointer;}
#workskin .search-dym2:hover{text-decoration:underline;}
#workskin .search-result{margin:1.5em 0 0 0.75em;max-width:37.5em;}
#workskin .result-url{color:#006621;font-size:0.875em;line-height:1.3;margin-bottom:0.286em;}
#workskin .result-title{color:#1a0dab;font-size:1.25em;line-height:1.3;font-weight:400;cursor:pointer;margin-bottom:0.2em;}
#workskin .result-title:hover{text-decoration:underline;}
#workskin .result-desc{color:#4d5156;font-size:0.875em;line-height:1.58;}
#workskin .wm{margin-top:2.667em;font-size:0.563em;opacity:0.45;text-align:center;}
${VISUALLY_HIDDEN_CSS}`;
}

export function buildCSS(project: SkinProject): string {
  const s = project.settings;
  
  // iOS Mode Override
  let senderColor = s.senderColor;
  let receiverColor = s.receiverColor;
  let bubbleOpacity = s.bubbleOpacity;
  
  if (project.template === 'ios') {
    if (s.iosMode === 'sms') {
      senderColor = '#34C759'; // Green
      receiverColor = '#E9E9EB';
      bubbleOpacity = 1.0;
    } else {
      // Default to iMessage Blue
      senderColor = '#007AFF';
      receiverColor = '#E9E9EB';
      bubbleOpacity = 1.0;
    }
  }

  const senderBg = hexToRgba(senderColor, bubbleOpacity);
  const recvBg = hexToRgba(receiverColor, bubbleOpacity);
  const neutralBg = s.useDarkNeutral ? 'rgba(255,255,255,0.08)' : 'transparent';
  const maxWidth = s.maxWidthPx;
  
  switch(project.template) {
    case 'android':
      return buildAndroidCSS(s, senderBg, recvBg, neutralBg, maxWidth);
    case 'twitter':
      return buildTwitterCSS(s, senderBg, maxWidth);
    case 'google':
      return buildGoogleCSS(maxWidth);
    case 'ios':
    default:
      return buildIOSCSS(s, senderBg, recvBg, neutralBg, maxWidth);
  }
}
