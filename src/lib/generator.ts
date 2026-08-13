import { SkinProject, Message } from './schema';
import { sanitizeAttribute, sanitizeText, sanitizeUrl, formatMessageText } from './sanitize';
import { PLATFORM_ASSETS, FALLBACK_TEXT } from './platformAssets';
import { resolveMessageIdentity } from './identity';

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

function safeCssColor(value: string | undefined, fallback: string): string {
  return value && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

function msgHTML(msg: Message, template: string, project: SkinProject, options?: { index?: number; allMessages?: Message[]; isReply?: boolean }): string {
  // Time break (iOS/Android)
  const timeBreak = msg.showTimeBreak && msg.timeBreakText
    ? `<div class="time-break">${sanitizeText(msg.timeBreakText)}</div>`
    : '';

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
  const resolvedIdentity = resolveMessageIdentity(project, msg);
  const avatar = resolvedIdentity.avatarUrl ? `<img src="${sanitizeUrl(resolvedIdentity.avatarUrl)}" alt="${sanitizeAttribute(resolvedIdentity.name)} avatar" class="avatar" />` : '';
  
  // Group Chat: Show sender name with avatar/initials for incoming messages (WhatsApp & iOS)
  const isGroupMode = (template === 'android' && project.settings.androidGroupMode) ||
                       (template === 'ios' && project.settings.iosGroupMode);
  
  // Auto-match participantId if not set but we're in group mode
  let participantId = msg.participantId;
  const groupParticipants = template === 'android'
    ? project.settings.androidGroupParticipants
    : project.settings.iosGroupParticipants;
  
  if (isGroupMode && !msg.outgoing && !participantId && groupParticipants) {
    // Try to match by sender name to participant name
    const matchedParticipant = groupParticipants.find(
      p => p.name.toLowerCase() === msg.sender.toLowerCase()
    );
    if (matchedParticipant) {
      participantId = matchedParticipant.id;
    }
  }
  
  const showSenderName = isGroupMode && !msg.outgoing && participantId;
  
  let senderNameHTML = '';
  if (showSenderName) {
    // Find participant to get avatar and color
    const participant = groupParticipants?.find(p => p.id === participantId);
    
    if (participant) {
      // Build avatar or initials with inline styles for maximum specificity
      let avatarHTML = '';
      if (participant.avatarUrl) {
        // The width/height ATTRIBUTES are the ones that matter on AO3: `style`
        // is on no allowed-attribute list, so the sanitizer strips it silently
        // and the inline sizing below never reaches the archive at all.
        avatarHTML = `<img src="${sanitizeUrl(participant.avatarUrl)}" alt="${sanitizeAttribute(participant.name)}" class="group-avatar" width="20" height="20" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block !important;" />`;
      } else {
        // Generate initials (first 2 chars of name)
        const initials = participant.name.substring(0, 2).toUpperCase();
        const participantColor = safeCssColor(participant.color, '#777777');
        avatarHTML = `<div class="group-avatar-initials" style="width:20px;height:20px;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;background-color:${participantColor}20;color:${participantColor};">${sanitizeText(initials)}</div>`;
      }
      
      // Use roleColor from message or fall back to participant color
      const displayColor = safeCssColor(msg.roleColor, safeCssColor(participant.color, '#777777'));
      senderNameHTML = `<div class="group-sender-row" style="display:flex !important;align-items:center;gap:6px;margin-bottom:4px;visibility:visible !important;">${avatarHTML}<div class="group-sender" style="color: ${displayColor};">${sanitizeText(participant.name)}</div></div>`;
    }
  }
  
  // Only show sender name for templates that need it (not WhatsApp 1-on-1)
  const who = (template === 'android' && !isGroupMode) ? '' : `<dt class="sender">${sanitizeText(resolvedIdentity.name)}</dt>`;

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

  const hiddenSpeaker = senderNameHTML
    ? ''
    : `<dt class="visually-hidden">${sanitizeText(speaker)}: </dt>`;
  
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
  const bubbleClasses = `bubble ${msg.outgoing?'out':'in'}${hasAttachment ? ' image-bubble' : ''}${hasReaction ? ' has-reaction' : ''}`;
  let bubble = `<dd class="${bubbleClasses}">`;
  
  // Add group sender name INSIDE bubble (at top)
  if (senderNameHTML) {
    bubble += senderNameHTML;
  }
  
  // Add message text if present
  if (sanitized && sanitized.trim()) {
    bubble += sanitized;
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
  if (template === 'ios' && msg.outgoing && project.settings.iosShowReadReceipt && msg.status === 'read') {
    statusIndicator = `<dd class="status-indicator">Read</dd>`;
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
    
    // Override avatar if using main identity
    const effectiveAvatar = displayAvatar ? `<img src="${sanitizeUrl(displayAvatar)}" alt="Avatar" class="avatar" width="40" height="40" />` : '';
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
    const timestampLine = project.settings.twitterTimestamp || (msg.timestamp ? msg.timestamp : '');
    
    // Build tweet image from attachments array
    let tweetImage = '';
    if (msg.attachments && msg.attachments.length > 0 && msg.attachments[0].type === 'image') {
      tweetImage = `<img src="${sanitizeUrl(msg.attachments[0].url)}" alt="${attachmentAlt(msg.attachments[0])}" class="tweet-image" />`;
    }
    
    // Enhanced metrics with icons - use per-tweet metrics if available, otherwise fall back to global
    // Only use global defaults if the property doesn't exist on the message object
    const replies = msg.hasOwnProperty('twitterReplies') ? msg.twitterReplies : project.settings.twitterReplies;
    const retweets = msg.hasOwnProperty('twitterRetweets') ? msg.twitterRetweets : project.settings.twitterRetweets;
    const likes = msg.hasOwnProperty('twitterLikes') ? msg.twitterLikes : project.settings.twitterLikes;
    const views = msg.twitterViews;
    const bookmarks = msg.twitterBookmarks;
    
    // Use gray icons in dark mode
    const isDarkMode = project.settings.twitterDarkMode;
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
    
    let quote = '';
    if (project.settings.twitterQuoteEnabled) {
      const qAvatar = project.settings.twitterQuoteAvatar ? `<img src="${sanitizeUrl(project.settings.twitterQuoteAvatar)}" alt="Quote avatar" class="quote-avatar" />` : '';
      const qHandle = project.settings.twitterQuoteHandle ? `@${sanitizeText(project.settings.twitterQuoteHandle.replace(/^@/, ''))}` : '';
      const qVerified = project.settings.twitterQuoteVerified ? `<span class="verified-container quote-verified-container"><span class="quote-verified-badge" title="Verified">✔</span></span>` : '';
      const qText = sanitizeText(project.settings.twitterQuoteText || '');
      const qImage = project.settings.twitterQuoteImage ? `<img src="${sanitizeUrl(project.settings.twitterQuoteImage)}" alt="Quote image" class="quote-image" />` : '';
      quote = `<div class="quote"><div class="quote-head">${qAvatar}<span class="quote-name">${sanitizeText(project.settings.twitterQuoteName||'')}</span>${qVerified}<span class="quote-handle">${sanitizeText(qHandle)}</span></div><div class="quote-body">${highlightTwitterText(qText)}${qImage}</div></div>`;
    }
    const bodyWithFormatting = highlightTwitterText(sanitized);

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
      // Expanded view: avatar on left, larger text, no header/metrics, content indented
      return `<div class="tweet expanded" data-message-id="${sanitizeAttribute(msg.id)}">${effectiveAvatar}<div class="expanded-content"><div class="expanded-name"><b class="name">${safeDisplayName}</b>${verified}</div><div class="expanded-handle">${openParen}${sanitizeText(handle)}${closeParen}</div>${replyingTo}${attribution}<div class="expanded-body">${bodyWithFormatting}${tweetImage}${quote}</div>${timestampLine ? `<div class="time-line">${sanitizeText(timestampLine)}</div>`:''}</div></div>`;
    }
    
    // Add reply class if this is a threaded reply. `no-metrics` suppresses the
    // divider under the timestamp, which otherwise draws a rule pointing at an
    // empty space when the tweet has no counts.
    const tweetClass = [isReply ? 'tweet reply' : 'tweet', hasMetrics ? '' : 'no-metrics']
      .filter(Boolean)
      .join(' ');
    
    return `<div class="${tweetClass}" data-message-id="${sanitizeAttribute(msg.id)}"><div class="tweet-header">${effectiveAvatar}<div class="head"><div class="head-content"><div class="name-line"><b class="name">${safeDisplayName}</b> ${verified} ${openParen}<span class="handle">${sanitizeText(handle)}</span>${closeParen}<span class="follow-dot">·</span>${chromeGap}${followBtn}<img src="${xLogo}" alt="" class="twitter-logo" width="20" height="20" /></div></div></div></div>${replyingTo}${attribution}<div class="body">${bodyWithFormatting}${tweetImage}${quote}</div>${timestampLine ? `<div class="time-line">${sanitizeText(timestampLine)}</div>`:''}${metrics}</div>`;
  }
  
  if (template === 'google') {
    // Google search: just display as search result (simplified)
    return `<div class="row"><span class="search-term">${sanitized}</span></div>`;
  }
  
  // iOS: No avatars or names in 1-on-1 (authentic behavior)
  if (template === 'ios') {
    const rowClass = msg.outgoing ? 'row out' : 'row in';
    const groupClass = isFirstInGroup && isLastInGroup ? 'single' : isFirstInGroup ? 'first' : isLastInGroup ? 'last' : 'middle';
    const tailClass = isLastInGroup ? 'has-tail' : 'no-tail';
    
    // Check if this message has an image
    const hasImage = msg.attachments && msg.attachments.length > 0 && msg.attachments[0].type === 'image';
    
    // Build bubble with text content (add group sender name if applicable)
    let bubbleContent = senderNameHTML ? senderNameHTML + sanitized : sanitized;
    
    // Add image inline if present
    if (hasImage) {
      const imgUrl = sanitizeUrl(msg.attachments[0].url);
      bubbleContent += `<img src="${imgUrl}" alt="${attachmentAlt(msg.attachments[0])}" class="message-image" />`;
    }
    
    // Add timestamp. The hidden space is what stops "hey10:23" when no CSS
    // applies — the time is styled onto its own line, so nothing separates it
    // from the message text in the markup. See srOnly().
    if (isLastInGroup && msg.timestamp) {
      const timeClass = hasImage ? 'time image-time' : 'time';
      bubbleContent += `${srOnly(' ')}<span class="${timeClass}">${sanitizeText(msg.timestamp)}</span>`;
    }
    
    // Add inline SVG tail for html2canvas compatibility (::after doesn't render in canvas)
    let tailSvg = '';
    if (isLastInGroup) {
      if (msg.outgoing) {
        // Right-pointing tail for outgoing messages
        tailSvg = `<svg class="bubble-tail bubble-tail-out" width="12" height="16" viewBox="0 0 12 16" xmlns="http://www.w3.org/2000/svg"><path d="M0,0 Q0,16 12,16 L0,16 Z" fill="currentColor"/></svg>`;
      } else {
        // Left-pointing tail for incoming messages  
        tailSvg = `<svg class="bubble-tail bubble-tail-in" width="12" height="16" viewBox="0 0 12 16" xmlns="http://www.w3.org/2000/svg"><path d="M12,0 Q12,16 0,16 L12,16 Z" fill="currentColor"/></svg>`;
      }
    }
    
    /**
     * The reaction goes INSIDE the bubble, not beside it.
     *
     * The only rule that styles this is `#workskin dd.bubble .reaction`, a
     * **descendant** selector. This branch used to emit the span as a sibling of
     * the bubble, inside `<dl class="msg">`, so that rule matched nothing and
     * every iMessage tapback rendered as unstyled inline text trailing the
     * bubble — in the preview, in the PNG and on AO3 alike. The feature looked
     * implemented and was not.
     *
     * `dd.bubble` is already `position:relative` and `.image-bubble` is
     * explicitly `overflow:visible`, so a chip hanging over the edge is what the
     * stylesheet was always written for.
     */
    const reaction = msg.reaction ? `<span class="reaction">${sanitizeText(msg.reaction)}</span>` : '';

    // `has-reaction` exists so the stylesheet can reserve the space the chip
    // hangs into. The chip is absolutely positioned and therefore out of flow,
    // so without a class on the bubble itself the only way to select "a bubble
    // with a reaction" is :has(), which is not worth betting an AO3 skin on.
    const reactionClass = msg.reaction ? ' has-reaction' : '';
    const bubbleClass = hasImage
      ? `bubble ${msg.outgoing?'out':'in'} ${tailClass} image-bubble${reactionClass}`
      : `bubble ${msg.outgoing?'out':'in'} ${tailClass}${reactionClass}`;
    const bubble = `<dd class="${bubbleClass}">${bubbleContent}${tailSvg}${reaction}</dd>`;


    // Add status indicators
    let statusIndicator = '';
    if (msg.outgoing && project.settings.iosShowReadReceipt && msg.status === 'read' && isLastInGroup) {
      statusIndicator = `<dd class="status-indicator">Read</dd>`;
    }

    // Who is speaking, for when no CSS applies.
    //
    // A bubble carries its speaker entirely in colour and alignment, so with
    // the skin off — a download, or Hide Creator's Style — the whole
    // conversation collapses to unattributed lines: "hey / you free tonight?"
    // with no way to tell who said which.
    //
    // <dt> is the right element rather than a span: this is already a <dl>,
    // where the term is the speaker and the definition is what they said. AO3
    // allows dt, and unstyled browsers indent dd under dt for free.
    return `${timeBreak}<div class="${rowClass} ${groupClass}" data-message-id="${sanitizeAttribute(msg.id)}"><dl class="msg">${hiddenSpeaker}${bubble}${statusIndicator}</dl></div>`;
  }
  
  // Android and other templates: show avatar and sender name (with grouping for Android)
  if (template === 'android') {
    const rowClass = msg.outgoing ? 'row out' : 'row in';
    const groupClass = isFirstInGroup && isLastInGroup ? 'single' : isFirstInGroup ? 'first' : isLastInGroup ? 'last' : 'middle';
    
    // Check if this message has an image
    const hasImage = msg.attachments && msg.attachments.length > 0 && msg.attachments[0].type === 'image';
    
    let finalBubble = '';
    if (hasImage) {
      // Build bubble with both text and image - INCLUDE senderNameHTML for group mode!
      let bubbleContent = '';
      
      // Add group sender name at top of bubble (for group mode incoming messages)
      if (senderNameHTML) {
        bubbleContent += senderNameHTML;
      }
      
      // Add message text
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

export type SkinTheme = 'light' | 'dark';

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
  const field = THEME_SETTING[project.template as keyof typeof THEME_SETTING];
  if (!field) return project;
  return { ...project, settings: { ...project.settings, [field]: theme === 'dark' } };
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

export function buildHTML(project: SkinProject): string {
  // iOS and Android templates with enhanced features
  if (project.template === 'ios' || project.template === 'android') {
    const s = project.settings;
    const isIOS = project.template === 'ios';
    
    // Header.
    //
    // This used to be a five-way branch on (platform × has-background-image),
    // duplicating the initials helper and diverging on which settings each
    // branch honoured. Both platforms ship with a default header image, so the
    // image branches were the live ones — and they were the branches missing
    // group names and online status. The trailing `else` was unreachable
    // outright, which is why the status bar never rendered at all.
    //
    // Same data in every case now; the background image only changes what sits
    // behind it.
    const getInitials = (name: string) => {
      if (!name) return '?';
      // Emoji in a name produce a garbled monogram
      const cleanName = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
      const words = cleanName.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) return '?';
      if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    };

    const statusBar = isIOS && s.iosShowStatusBar
      ? `<div class="ios-status-bar"><span class="signal">📶</span><span class="time">${sanitizeText(s.iosStatusBarTime || '9:41')}</span><span class="status-icons">🔋</span></div>`
      : '';

    let header = '';
    if (isIOS) {
      const contactName = s.iosGroupMode
        ? (s.iosGroupName || 'Group Chat')
        : (s.iosContactName || s.chatContactName || '');
      const avatarUrl = s.iosAvatarUrl || '';

      // A background image needs its container even with nothing to overlay.
      if (s.iosHeaderImageUrl || contactName || avatarUrl) {
        const avatarOverlay = avatarUrl
          ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="ios-header-avatar" width="38" height="38" />`
          : (contactName ? `<div class="ios-header-avatar-placeholder">${sanitizeText(getInitials(contactName))}</div>` : '');
        const nameOverlay = contactName
          ? `<div class="ios-header-name">${sanitizeText(contactName)}</div>`
          : '';
        header = `<div class="ios-header">${avatarOverlay}${nameOverlay}</div>`;
      }
    } else {
      const isGroupMode = s.androidGroupMode;
      const contactName = isGroupMode
        ? (s.androidGroupName || 'Group Chat')
        // androidContactName first, matching iOS above and ComposeBar. The old
        // order was inverted relative to everything else in the app, so a
        // legacy project carrying BOTH fields had a WhatsApp header and its own
        // messages disagreeing about who you were talking to.
        : (s.androidContactName || s.chatContactName || '');
      const avatarUrl = s.androidAvatarUrl || '';

      if (s.androidHeaderImageUrl || contactName || avatarUrl) {
        const avatarOverlay = avatarUrl
          ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="android-header-avatar" width="40" height="40" />`
          : (contactName ? `<div class="android-header-avatar-placeholder">${sanitizeText(getInitials(contactName))}</div>` : '');

        // Group chats show the member count where a 1-on-1 shows "online".
        const participantCount = s.androidGroupParticipants?.length ?? 0;
        const subtitleText = isGroupMode && participantCount
          ? `${participantCount} participant${participantCount === 1 ? '' : 's'}`
          : (s.androidShowStatus !== false ? (s.androidStatusText || 'online') : '');
        const subtitle = subtitleText
          ? `<div class="android-header-subtitle">${sanitizeText(subtitleText)}</div>`
          : '';

        const nameOverlay = contactName
          ? `<div class="android-header-name-wrapper"><div class="android-header-name">${sanitizeText(contactName)}</div>${subtitle}</div>`
          : '';
        header = `<div class="android-header">${avatarOverlay}${nameOverlay}</div>`;
      }
    }
    header = `${statusBar}${header}`;
    
    // Messages
    const body = (isIOS || !isIOS) 
      ? project.messages.map((m, i) => msgHTML(m, project.template, project, { index: i, allMessages: project.messages })).join('')
      : project.messages.map(m => msgHTML(m, project.template, project)).join('');
    
    // Typing indicator
    // The three dots are pure CSS shapes, so with no skin the indicator is
    // either nothing at all or a bare name floating after the conversation.
    // The iOS tutorial solves it with exactly this line — <span class="hide">Mom
    // is typing...</span> — and it is the one piece of the fic that is
    // otherwise invisible in a download rather than merely ugly.
    const typing = s.chatShowTyping ? typingRowHTML(s.chatTypingName) : '';
    
    // iOS Footer with background image
    let footer = '';
    if (isIOS && s.iosFooterImageUrl) {
      footer = `<div class="ios-footer"></div>`;
    } else if (!isIOS && s.androidFooterImageUrl) {
      footer = `<div class="android-footer"></div>`;
    } else if (isIOS && s.iosShowInputBar) {
      footer = `<div class="ios-input-bar"><span>📷</span><div class="input-placeholder">${sanitizeText(s.iosInputPlaceholder || 'iMessage')}</div><span>🎤</span></div>`;
    }
    
    // Wrap messages in container for iOS and Android
    const messagesContainer = (isIOS || !isIOS) ? `<div class="chat-messages">${body}${typing}</div>` : `${body}${typing}`;
    
    return `<div class="${chatClass(project)}">${header}${messagesContainer}${footer}</div>`;
  }
  
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
    // Thread mode: organize tweets hierarchically
    if (project.settings.twitterThreadMode) {
      // Build a tree structure: find top-level tweets and their replies
      const topLevelTweets = project.messages.filter(m => !m.parentId);
      const tweetsByParent: { [key: string]: Message[] } = {};
      
      // Group replies by parent
      project.messages.forEach(m => {
        if (m.parentId) {
          if (!tweetsByParent[m.parentId]) {
            tweetsByParent[m.parentId] = [];
          }
          tweetsByParent[m.parentId].push(m);
        }
      });
      
      // Recursive function to render a tweet and its replies
      const renderTweetThread = (tweet: Message, isReply: boolean = false): string => {
        const tweetHTML = msgHTML(tweet, 'twitter', project, isReply ? { isReply: true } : undefined);
        const replies = tweetsByParent[tweet.id] || [];
        const repliesHTML = replies.map(reply => renderTweetThread(reply, true)).join('');
        return tweetHTML + repliesHTML;
      };
      
      // Render all top-level tweets and their threads
      const tweets = topLevelTweets.map(tweet => renderTweetThread(tweet)).join('');
      return `<div class="${chatClass(project, 'tweets')}">${tweets}</div>`;
    } else {
      // Simple mode: each message becomes its own tweet
      const tweets = project.messages.map(m => msgHTML(m, 'twitter', project)).join('');
      return `<div class="${chatClass(project, 'tweets')}">${tweets}</div>`;
    }
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
    },
  };
}

function buildIOSCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.iosDarkMode;
  const colour = iosColours(recvBg)[isDark ? 'dark' : 'light'];

  const headerBg = s.iosHeaderImageUrl ? `background:url('${s.iosHeaderImageUrl}') no-repeat top center;background-size:100% auto;` : 'background:#007aff;';
  const footerBg = s.iosFooterImageUrl ? `background:url('${s.iosFooterImageUrl}') no-repeat bottom center;background-size:100% auto;` : `background:${colour.inputBarBg};`;

    return `/* Generated with AO3 SkinGen */
#workskin .chat{width:100%;max-width:${emFromPx(Math.min(maxWidth, 375))};min-width:20em;margin:0 auto;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:0;background:${colour.chatBg};}
${PARAGRAPH_RESET_CSS}
#workskin .ios-header{position:relative;${headerBg}height:4.063em;display:flex;align-items:center;padding:0;overflow:hidden;}
#workskin .ios-header-avatar{position:absolute;left:4.063em;top:50%;transform:translateY(-50%);width:2.375em;height:2.375em;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);}
#workskin .ios-header-avatar img{width:100%;height:100%;}
#workskin .ios-header-avatar-placeholder{position:absolute;left:4.643em;top:50%;transform:translateY(-50%);width:2.714em;height:2.714em;border-radius:50%;background:rgba(255,255,255,0.25);color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.875em;font-weight:700;border:2px solid rgba(255,255,255,0.3);}
/* No max-width here. It used to read calc(100% - 177px), where 177 is exactly
   left(112) + right(65) — so an absolutely positioned box that already spans
   between those two edges was being constrained to the width it already had.
   calc() is genuinely absent from AO3's value grammar, and this one bought
   nothing, so it goes rather than being approximated. */
#workskin .ios-header-name{position:absolute;left:7.467em;right:4.333em;top:0;bottom:0;display:flex;align-items:center;font-size:0.938em;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.4);line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
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
#workskin dd.bubble.image-bubble{padding:0.533em 0.8em;max-width:60%;overflow:visible;}
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
#workskin .ios-input-bar > *{margin-left:0.5em;}
#workskin .ios-input-bar > *:first-child{margin-left:0;}
#workskin .ios-input-bar .input-placeholder{flex:1;background:${colour.inputFieldBg};border:1px solid ${colour.inputFieldBorder};border-radius:1.286em;padding:0.571em 0.857em;font-size:0.875em;color:${colour.inputPlaceholderColor};}
/* The gap property is spelled out as child margins: AO3 keeps a property only
   if it is on its list or CONTAINS a shorthand name, so column-gap passes and
   bare gap does not. Same substitution as the Twitter stylesheet. */
#workskin dd.bubble .group-sender-row{display:flex !important;align-items:center;margin-bottom:0.267em;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble.image-bubble .group-sender-row{display:flex !important;align-items:center;margin-bottom:0.4em;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble .group-sender-row > *{margin-right:0.4em;}
#workskin dd.bubble .group-sender-row > *:last-child{margin-right:0;}
/* No object-fit — it is not on AO3's list and has no legal equivalent. The
   avatar is a fixed 20x20 square, so a non-square source letterboxes instead of
   cropping. Visible only to authors who upload a non-square avatar. */
#workskin dd.bubble .group-avatar{width:1.333em;height:1.333em;border-radius:50%;flex-shrink:0;display:block !important;}
#workskin dd.bubble .group-avatar-initials{width:2.5em;height:2.5em;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:0.533em;font-weight:700;flex-shrink:0;}
#workskin dd.bubble .group-sender{font-size:0.733em;font-weight:600;line-height:1.2;opacity:0.9;display:inline-block !important;}
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
      bubbleShadow: '0 1px 2px rgba(0,0,0,0.3)',
      reactionChipBg: '#233138',
      reactionChipBorder: 'rgba(255,255,255,0.08)',
    },
  };
}

function buildAndroidCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.androidDarkMode;
  const colour = androidColours(senderBg, recvBg)[isDark ? 'dark' : 'light'];

  const headerBg = s.androidHeaderImageUrl ? `background:url('${s.androidHeaderImageUrl}') no-repeat top center;background-size:100% auto;` : `background:${colour.headerBgColor};`;
  const footerBg = s.androidFooterImageUrl ? `background:url('${s.androidFooterImageUrl}') no-repeat bottom center;background-size:contain;` : `background:${colour.footerBgColor};`;

    return `/* Generated with AO3 SkinGen */
#workskin .chat{width:100%;max-width:${emFromPx(Math.min(maxWidth, 400))};min-width:20em;margin:0 auto;display:flex;flex-direction:column;font-family:${s.fontFamily};background:${colour.chatBg};padding:0;}
${PARAGRAPH_RESET_CSS}
#workskin .android-header{position:relative;${headerBg}height:3.75em;display:flex;align-items:center;padding:0;overflow:visible;}
#workskin .android-header-avatar{position:absolute;left:3.75em;top:0;bottom:0;margin:auto 0;width:2.5em;height:2.5em;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.2);}
#workskin .android-header-avatar img{width:100%;height:100%;}
#workskin .android-header-avatar-placeholder{position:absolute;left:3.75em;top:0;bottom:0;margin:auto 0;width:2.5em;height:2.5em;border-radius:50%;background:${colour.avatarPlaceholderBg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:1em;font-weight:600;border:2px solid rgba(255,255,255,0.2);}
/* max-width dropped for the same reason as .ios-header-name: 170 was
   left(110) + right(60), constraining the box to the width it already had. */
#workskin .android-header-name{position:absolute;left:6.875em;right:3.75em;top:0;bottom:0;display:flex;align-items:center;font-size:1em;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0.25em 0;}
#workskin .android-header-name-wrapper{position:absolute;left:6.875em;right:3.75em;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3);padding:0.25em 0;}
#workskin .android-header-name-wrapper .android-header-name{position:static;font-size:1em;font-weight:600;line-height:1.4;padding:0;max-width:100%;overflow:visible;}
#workskin .android-header-subtitle{font-size:0.75em;opacity:0.8;line-height:1.2;margin-top:0.167em;}
#workskin .chat-header{padding:0.5em 0.75em;background:${colour.headerBgColor};color:#fff;margin-bottom:0.75em;}
#workskin .chat-header .contact-name{font-size:1em;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
#workskin .chat-header .status{font-size:0.75em;opacity:0.8;display:block;margin-top:0.167em;}
#workskin .chat-messages{padding:0.75em 0.5em;background:${colour.chatBg};}
#workskin .time-break{text-align:center;font-size:0.688em;color:${colour.timeBreakColor};margin:1.091em 0 0.727em 0;font-weight:500;}
#workskin .row{display:flex;margin:0 0 0 -0.375em;align-items:flex-end;flex-wrap:wrap;width:100%;}
#workskin .row > *{margin-left:0.375em;}
#workskin .row.single{margin:0.75em 0;}
#workskin .row.first{margin:0.75em 0 0.125em 0;}
#workskin .row.middle{margin:0.125em 0;}
#workskin .row.last{margin:0.125em 0 0.75em 0;}
#workskin .row.out{justify-content:flex-end;}
#workskin .row.in{justify-content:flex-start;}
#workskin img.avatar{width:2em;height:2em;border-radius:50%;overflow:hidden;flex-shrink:0;}
#workskin dl.msg{margin:0;display:flex;flex-direction:column;margin-top:-0.063em;}
#workskin dl.msg > *{margin-top:0.063em;}
#workskin .row.out dl.msg{align-items:flex-end;}
#workskin .row.in dl.msg{align-items:flex-start;}
/* was calc(75% - 8px), which resolves to 73% at the 400px card. */
#workskin dt.sender{font-size:0.75em;color:${colour.senderNameColor};margin:0 0 0.333em 0.667em;padding:0.333em 0;font-weight:600;max-width:73%;overflow:visible;white-space:nowrap;line-height:1.4;}
#workskin dd{margin:0;}
#workskin dd.bubble{position:relative;display:inline-block;min-width:0;max-width:20em;padding:0.5em 0.714em;border-radius:0.571em;line-height:1.4;font-size:0.875em;box-shadow:${colour.bubbleShadow};white-space:normal;word-break:keep-all;overflow-wrap:anywhere;}
#workskin dd.bubble.image-bubble{padding:0.5em 0.714em;max-width:70%;overflow:visible;margin-top:0.286em;}
#workskin dd.bubble.image-bubble img.message-image{width:100%;height:auto;display:block;border-radius:0.429em;margin-top:0.429em;}
#workskin dd.bubble.image-bubble.out{border-bottom-right-radius:0.143em;}
#workskin dd.bubble.image-bubble.out img.message-image{border-bottom-right-radius:0.143em;}
#workskin dd.bubble.image-bubble.in{border-bottom-left-radius:0.143em;}
#workskin dd.bubble.image-bubble.in img.message-image{border-bottom-left-radius:0.143em;}
#workskin dd.bubble.out{background:${colour.senderBubbleBg};color:${colour.bubbleTextColor};border-top-right-radius:0.571em;border-bottom-right-radius:0.143em;border-bottom-left-radius:0.571em;border-top-left-radius:0.571em;}
#workskin dd.bubble.in{background:${colour.receiverBubbleBg};color:${colour.bubbleTextColor};border-top-left-radius:0.571em;border-bottom-left-radius:0.143em;border-bottom-right-radius:0.571em;border-top-right-radius:0.571em;}
/* The gap property is spelled out as child margins: AO3 keeps a property only
   if it is on its list or CONTAINS a shorthand name, so column-gap passes and
   bare gap does not. Same substitution as the Twitter stylesheet. */
#workskin dd.bubble .group-sender-row{display:flex !important;align-items:center;margin-bottom:0.286em;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble.image-bubble .group-sender-row{display:flex !important;align-items:center;margin-bottom:0.429em;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble .group-sender-row > *{margin-right:0.429em;}
#workskin dd.bubble .group-sender-row > *:last-child{margin-right:0;}
/* No object-fit — it is not on AO3's list and has no legal equivalent. The
   avatar is a fixed 20x20 square, so a non-square source letterboxes instead of
   cropping. Visible only to authors who upload a non-square avatar. */
#workskin dd.bubble .group-avatar{width:1.429em;height:1.429em;border-radius:50%;flex-shrink:0;display:block !important;}
#workskin dd.bubble .group-avatar-initials{width:2.5em;height:2.5em;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:0.571em;font-weight:700;flex-shrink:0;}
#workskin dd.bubble .group-sender{font-size:0.786em;font-weight:600;line-height:1.2;opacity:0.9;display:inline-block !important;}
#workskin dd.bubble .time{display:block;font-size:0.714em;color:${colour.timeColor};margin-top:0.4em;text-align:right;font-weight:400;padding-right:2em;}
#workskin dd.bubble.image-bubble .time.image-time{position:absolute;bottom:0.6em;right:0.8em;margin:0;background:rgba(0,0,0,0.5);padding:0.2em 0.6em;border-radius:0.8em;font-size:0.714em;color:#fff;padding-right:2.4em;}
#workskin dd.bubble.out .check-icon{position:absolute;bottom:0.429em;right:0.429em;height:1em;width:auto;opacity:0.7;}
#workskin dd.bubble.image-bubble.out .check-icon{bottom:0.571em;right:0.571em;z-index:1;}
/* WhatsApp's reaction, measured off a real WhatsApp screenshot rather than
   reasoned about -- two earlier attempts got it wrong from first principles.
   Three things the real app does, all of which we had wrong:
   1. The pill sits ENTIRELY BELOW the bubble, in the gap between rows. It does
      not straddle the bubble's edge and it does not sit inside it.
   2. Therefore the bubble's own layout is COMPLETELY UNCHANGED by a reaction.
      No reserved strip, no extra padding, no taller bubble, and the time and
      ticks stay exactly where they are. Reserving space inside the bubble --
      which is what the first two attempts did -- is what made a group bubble
      with no timestamp read as a hollow box with a chip lost in its corner.
   3. It sits on the SENDER'S OWN side: bottom-right for an outgoing message,
      bottom-left for an incoming one. The old comment here claimed WhatsApp
      always attaches lower-left "regardless of who sent it". It does not.
   Because the pill is outside the bubble entirely, it cannot land on the text,
   which is the whole class of bug the previous two versions kept producing.
   What it CAN land on is the next row, and the margin below is what stops it.
   (No backticks in this comment: it lives inside a template literal.) */
#workskin dd.bubble .reaction{position:absolute;bottom:-1.6em;background:${colour.reactionChipBg};border:0.071em solid ${colour.reactionChipBorder};border-radius:0.857em;padding:0.071em 0.286em;font-size:0.857em;line-height:1.4;box-shadow:0 1px 2px rgba(0,0,0,0.15);z-index:2;}
#workskin dd.bubble.out .reaction{right:0.75em;}
#workskin dd.bubble.in .reaction{left:0.75em;}
/* The pill is ~1.43em tall and hangs 1.6em down, so it clears the bubble by a
   little and needs ~1.6em of room beneath it. Margin is correct HERE, where
   padding was not: the thing being pushed away really is the next row. */
#workskin dd.bubble.has-reaction{margin-bottom:2em;}
#workskin dd.status-indicator{font-size:0.625em;color:${colour.timeColor};text-align:right;margin:0.2em 1em 0 0;font-weight:400;}
#workskin dd.attach{margin-top:0.25em;}
#workskin img.attach-img{max-width:12.5em;border-radius:0.5em;display:block;}
#workskin .row.typing{align-items:center;margin-left:-0.375em;}
#workskin .row.typing > *{margin-left:0.375em;}
/* inline-block, not flex — an injected <p> makes the dots stop being flex
   items and an inline span ignores width/height, so the indicator renders 0x0.
   See the longer note in buildIOSCSS. */
#workskin .typing-bubble{background:${colour.receiverBubbleBg};padding:0.625em 0.875em;border-radius:0.5em;display:inline-block;line-height:0;box-shadow:${colour.bubbleShadow};}
/* Static dots at descending opacity — see the note in buildIOSCSS. */
#workskin .typing-bubble .dot{display:inline-block;vertical-align:middle;width:0.5em;height:0.5em;margin-left:0.25em;background:${colour.typingDotBg};border-radius:50%;opacity:0.4;}
#workskin .typing-bubble .dot:first-child{margin-left:0;}
#workskin .typing-bubble .dot:nth-child(1){opacity:0.85;}
#workskin .typing-bubble .dot:nth-child(2){opacity:0.65;}
#workskin .typing-label{font-size:0.688em;color:${colour.typingLabelColor};}
#workskin .android-footer{position:relative;${footerBg}height:3.75em;border-top:1px solid ${colour.footerBorderColor};overflow:visible;background-position:center;}
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
  dark: {
    bgColor: '#15202b',
    bgHover: '#1c2e3f',
    textPrimary: '#e7e9ea',
    textSecondary: '#8b98a5',
    borderColor: '#38444d',
    handleColor: '#8b98a5',
    quoteHover: '#1c2e3f',
    replyLineColor: '#38444d',
  },
} as const;

function buildTwitterCSS(s: SkinProject['settings'], senderBg: string, maxWidth: number): string {
  const isDark = s.twitterDarkMode;
  const colour = TWITTER_COLOURS[isDark ? 'dark' : 'light'];

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
#workskin .tweet.expanded{padding:1em;display:flex;margin-left:-0.75em;}
#workskin .tweet.expanded > *{margin-left:0.75em;}
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
