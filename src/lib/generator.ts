import { SkinProject, Message } from './schema';
import { sanitizeText, sanitizeUrl, formatMessageText } from './sanitize';
import { PLATFORM_ASSETS, FALLBACK_TEXT } from './platformAssets';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Generates CSS for WhatsApp/iMessage-style text formatting
 * Used in message bubbles across all templates
 */
function getTextFormattingCSS(isDark: boolean = false): string {
  const codeBlockBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)';
  const codeBorder = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)';
  const blockquoteBorder = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
  const blockquoteBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  
  return `
#workskin dd.bubble strong,#workskin dd.bubble b{font-weight:700;}
#workskin dd.bubble em,#workskin dd.bubble i{font-style:italic;}
#workskin dd.bubble s,#workskin dd.bubble strike,#workskin dd.bubble del{text-decoration:line-through;}
#workskin dd.bubble code{font-family:'SF Mono','Menlo','Monaco','Consolas',monospace;font-size:0.9em;background:${codeBlockBg};padding:2px 5px;border-radius:4px;border:1px solid ${codeBorder};}
#workskin dd.bubble pre{margin:8px 0;padding:0;}
#workskin dd.bubble pre code{display:block;padding:8px 10px;white-space:pre-wrap;word-break:break-word;border-radius:6px;}
#workskin dd.bubble blockquote{margin:6px 0;padding:4px 0 4px 10px;border-left:3px solid ${blockquoteBorder};background:${blockquoteBg};font-style:italic;}
#workskin dd.bubble ul,#workskin dd.bubble ol{margin:6px 0;padding-left:20px;}
#workskin dd.bubble li{margin:2px 0;}
#workskin dd.bubble ul{list-style-type:disc;}
#workskin dd.bubble ol{list-style-type:decimal;}`;
}

function applyBoldMarkup(raw: string): string {
  return raw.replace(/\*([^*]+)\*/g, '<b>$1</b>');
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

function msgHTML(msg: Message, template: string, project: SkinProject, options?: { index?: number; allMessages?: Message[]; isReply?: boolean }): string {
  // Time break (iOS/Android)
  const timeBreak = msg.showTimeBreak && msg.timeBreakText
    ? `<div class="time-break">${sanitizeText(msg.timeBreakText)}</div>`
    : '';
  
  const index = options?.index;
  const allMessages = options?.allMessages;
  const isReply = options?.isReply || false;
  
  // Use formatMessageText for rich formatting (bold, italic, strikethrough, code, lists, quotes)
  const sanitized = formatMessageText(msg.content);
  const avatar = msg.avatarUrl ? `<img src="${sanitizeUrl(msg.avatarUrl)}" alt="${sanitizeText(msg.sender)} avatar" class="avatar" />` : '';
  
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
        avatarHTML = `<img src="${sanitizeUrl(participant.avatarUrl)}" alt="${sanitizeText(participant.name)}" class="group-avatar" style="width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block !important;" />`;
      } else {
        // Generate initials (first 2 chars of name)
        const initials = participant.name.substring(0, 2).toUpperCase();
        avatarHTML = `<div class="group-avatar-initials" style="width:20px;height:20px;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;background-color:${participant.color}20;color:${participant.color};">${sanitizeText(initials)}</div>`;
      }
      
      // Use roleColor from message or fall back to participant color
      const displayColor = msg.roleColor || participant.color;
      senderNameHTML = `<div class="group-sender-row" style="display:flex !important;align-items:center;gap:6px;margin-bottom:4px;visibility:visible !important;">${avatarHTML}<div class="group-sender" style="color: ${displayColor};">${sanitizeText(msg.sender)}</div></div>`;
    }
  }
  
  // Only show sender name for templates that need it (not WhatsApp 1-on-1)
  const who = (template === 'android' && !isGroupMode) ? '' : `<dt class="sender">${msg.sender}</dt>`;
  
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
    let checkImg = '';
    if (msg.status === 'sending') checkImg = PLATFORM_ASSETS.whatsapp.checkmarkSending;
    else if (msg.status === 'sent') checkImg = PLATFORM_ASSETS.whatsapp.checkmarkSent;
    else if (msg.status === 'delivered') checkImg = PLATFORM_ASSETS.whatsapp.checkmarkDelivered;
    else if (msg.status === 'read') checkImg = PLATFORM_ASSETS.whatsapp.checkmarkRead;
    
    if (checkImg) {
      checkmarkHTML = `<img src="${checkImg}" alt="${msg.status}" class="check-icon" />`;
    }
  }

  // Build the message bubble with text content
  const hasAttachment = (template === 'ios' || template === 'android') && msg.attachments && msg.attachments.length > 0;
  const bubbleClasses = `bubble ${msg.outgoing?'out':'in'}${hasAttachment ? ' image-bubble' : ''}`;
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
      bubble += `<img src="${sanitizeUrl(att.url)}" alt="${sanitizeText(att.alt||'')}" class="message-image" />`;
    }
  }
  
  // Add timestamp (iOS/Android)
  if ((template === 'ios' || template === 'android') && msg.timestamp) {
    bubble += `<span class="time">${msg.timestamp||''}</span>`;
  }
  
  // Add checkmarks outside timestamp for absolute positioning (Android only)
  if (template === 'android' && checkmarkHTML) {
    bubble += checkmarkHTML;
  }
  
  // Add reaction if present (iOS/Android)
  if ((template === 'ios' || template === 'android') && msg.reaction) {
    bubble += `<span class="reaction">${msg.reaction}</span>`;
  }
  
  bubble += `</dd>`;
  
  // Add status indicators
  let statusIndicator = '';
  if (template === 'ios' && msg.outgoing && project.settings.iosShowReadReceipt && msg.status === 'read') {
    statusIndicator = `<dd class="status-indicator">Read</dd>`;
  }
  
  const atts = (msg.attachments||[]).map(a => `<dd class="attach"><span class="visually-hidden">Image:</span><img src="${sanitizeUrl(a.url)}" alt="${sanitizeText(a.alt||'')}" class="attach-img"/></dd>`).join('');
  
  if (template === 'twitter') {
    // Advanced tweet: optional quote tweet embed
    // For Tweet 2+, use custom identity if toggled, otherwise inherit from first message
    const firstMsg = project.messages[0];
    const useMainIdentity = !msg.useCustomIdentity;
    const displayName = useMainIdentity && firstMsg ? firstMsg.sender : msg.sender;
    const displayAvatar = useMainIdentity && firstMsg?.avatarUrl ? firstMsg.avatarUrl : msg.avatarUrl;
    
    // Determine if this is a reply
    const isReply = !!msg.parentId;
    
    // Override avatar if using main identity
    const effectiveAvatar = displayAvatar ? `<img src="${sanitizeUrl(displayAvatar)}" alt="Avatar" class="avatar" />` : '';
    
    // Handle logic: if using custom identity and has custom handle, use it; otherwise generate from name or use main handle
    const handle = msg.useCustomIdentity 
      ? (msg.twitterHandle 
          ? (msg.twitterHandle.startsWith('@') ? msg.twitterHandle : `@${msg.twitterHandle}`)
          : `@${displayName.toLowerCase().replace(/\s+/g, '')}`)
      : (project.settings.twitterHandle && project.settings.twitterHandle.trim().length>0)
        ? `@${project.settings.twitterHandle.replace(/^@/, '')}`
        : `@${displayName.toLowerCase().replace(/\s+/g, '')}`;
    
    // Use per-tweet verified status if custom identity, otherwise use main profile verified
    const isVerified = msg.useCustomIdentity ? (msg.verified || false) : (project.settings.twitterVerified || false);
    const verified = isVerified ? `<span class="verified-container"><img src="${PLATFORM_ASSETS.twitter.verifiedBadge}" alt="Verified" class="verified-badge" /></span>` : '';
    const timestampLine = project.settings.twitterTimestamp || (msg.timestamp ? msg.timestamp : '');
    
    // Build tweet image from attachments array
    let tweetImage = '';
    if (msg.attachments && msg.attachments.length > 0 && msg.attachments[0].type === 'image') {
      tweetImage = `<img src="${sanitizeUrl(msg.attachments[0].url)}" alt="${sanitizeText(msg.attachments[0].alt || '')}" class="tweet-image" />`;
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
    const replyIcon = isDarkMode ? PLATFORM_ASSETS.twitter.replyIconGrey : PLATFORM_ASSETS.twitter.replyIcon;
    const retweetIcon = isDarkMode ? PLATFORM_ASSETS.twitter.retweetIconGrey : PLATFORM_ASSETS.twitter.retweetIcon;
    const likeIcon = isDarkMode ? PLATFORM_ASSETS.twitter.likeIconGrey : PLATFORM_ASSETS.twitter.likeIcon;
    const xLogo = isDarkMode ? PLATFORM_ASSETS.twitter.logoGrey : PLATFORM_ASSETS.twitter.logo;
    
    const metrics = project.settings.twitterShowMetrics ? `<div class="metrics">${replies ? `<span class="metric replies" title="Replies"><img src="${replyIcon}" alt="" class="metric-icon" /><span class="metric-count">${formatNumber(replies)}</span></span>`:''}${retweets ? `<span class="metric retweets" title="Retweets"><img src="${retweetIcon}" alt="" class="metric-icon" /><span class="metric-count">${formatNumber(retweets)}</span></span>`:''}${likes ? `<span class="metric likes" title="Likes"><img src="${likeIcon}" alt="" class="metric-icon" /><span class="metric-count">${formatNumber(likes)}</span></span>`:''}${bookmarks ? `<span class="metric bookmarks" title="Bookmarks"><img src="${PLATFORM_ASSETS.twitter.bookmarkIcon}" alt="" class="metric-icon" /><span class="metric-count">${formatNumber(bookmarks)}</span></span>`:''}${views ? `<span class="metric views" title="Views"><img src="${PLATFORM_ASSETS.twitter.viewsIcon}" alt="" class="metric-icon" /><span class="metric-count">${formatNumber(views)}</span></span>`:''}</div>` : ''
    
    let quote = '';
    if (project.settings.twitterQuoteEnabled) {
      const qAvatar = project.settings.twitterQuoteAvatar ? `<img src="${sanitizeUrl(project.settings.twitterQuoteAvatar)}" alt="Quote avatar" class="quote-avatar" />` : '';
      const qHandle = project.settings.twitterQuoteHandle ? `@${sanitizeText(project.settings.twitterQuoteHandle.replace(/^@/, ''))}` : '';
      const qVerified = project.settings.twitterQuoteVerified ? `<span class="verified-container quote-verified-container"><img src="${PLATFORM_ASSETS.twitter.verifiedBadge}" alt="Verified" class="quote-verified-badge" /></span>` : '';
      const qText = sanitizeText(project.settings.twitterQuoteText || '');
      const qImage = project.settings.twitterQuoteImage ? `<img src="${sanitizeUrl(project.settings.twitterQuoteImage)}" alt="Quote image" class="quote-image" />` : '';
      quote = `<div class="quote"><div class="quote-head">${qAvatar}<span class="quote-name">${sanitizeText(project.settings.twitterQuoteName||'')}</span>${qVerified}<span class="quote-handle">${qHandle}</span></div><div class="quote-body">${highlightTwitterText(qText)}${qImage}</div></div>`;
    }
    const bodyWithFormatting = highlightTwitterText(sanitized);
    
    // Reply indicator - show "Replying to @handles" if this is a reply
    let replyingTo = '';
    if (isReply && msg.replyToHandles && msg.replyToHandles.length > 0) {
      const handles = msg.replyToHandles.map(h => `<a href="#" class="reply-handle">@${h.replace(/^@/, '')}</a>`);
      if (handles.length === 1) {
        replyingTo = `<div class="replying-to">Replying to ${handles[0]}</div>`;
      } else if (handles.length === 2) {
        replyingTo = `<div class="replying-to">Replying to ${handles[0]} and ${handles[1]}</div>`;
      } else {
        const lastHandle = handles.pop();
        replyingTo = `<div class="replying-to">Replying to ${handles.join(', ')}, and ${lastHandle}</div>`;
      }
    }
    
    // Follow button
    const followBtn = `<button class="follow-btn">Follow</button>`;
    
    // Check if this should be displayed as expanded view (clicked-into reply)
    if (msg.expandedView) {
      // Expanded view: avatar on left, larger text, no header/metrics, content indented
      return `<div class="tweet expanded" data-message-id="${msg.id}">${effectiveAvatar}<div class="expanded-content"><div class="expanded-name"><span class="name">${displayName}</span>${verified}</div><div class="expanded-handle">${handle}</div>${replyingTo}<div class="expanded-body">${bodyWithFormatting}${tweetImage}${quote}</div>${timestampLine ? `<div class="time-line">${timestampLine}</div>`:''}</div></div>`;
    }
    
    // Add reply class if this is a threaded reply
    const tweetClass = isReply ? 'tweet reply' : 'tweet';
    
    return `<div class="${tweetClass}" data-message-id="${msg.id}"><div class="tweet-header">${effectiveAvatar}<div class="head"><div class="head-content"><div class="name-line"><span class="name">${displayName}</span>${verified}<span class="handle">${handle}</span><span class="follow-dot">·</span>${followBtn}<img src="${xLogo}" alt="X" class="twitter-logo" /></div></div></div></div>${replyingTo}<div class="body">${bodyWithFormatting}${tweetImage}${quote}</div>${timestampLine ? `<div class="time-line">${timestampLine}</div>`:''}${metrics}</div>`;
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
      bubbleContent += `<img src="${imgUrl}" alt="" class="message-image" />`;
    }
    
    // Add timestamp
    if (isLastInGroup && msg.timestamp) {
      const timeClass = hasImage ? 'time image-time' : 'time';
      bubbleContent += `<span class="${timeClass}">${msg.timestamp}</span>`;
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
    
    const bubbleClass = hasImage ? `bubble ${msg.outgoing?'out':'in'} ${tailClass} image-bubble` : `bubble ${msg.outgoing?'out':'in'} ${tailClass}`;
    const bubble = `<dd class="${bubbleClass}">${bubbleContent}${tailSvg}</dd>`;
    
    
    // Add status indicators
    let statusIndicator = '';
    if (msg.outgoing && project.settings.iosShowReadReceipt && msg.status === 'read' && isLastInGroup) {
      statusIndicator = `<dd class="status-indicator">Read</dd>`;
    }
    
    // Add reaction if present
    const reaction = msg.reaction ? `<span class="reaction">${msg.reaction}</span>` : '';
    
    return `${timeBreak}<div class="${rowClass} ${groupClass}" data-message-id="${msg.id}"><dl class="msg">${bubble}${reaction}${statusIndicator}</dl></div>`;
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
      bubbleContent += `<img src="${imgUrl}" alt="" class="message-image" />`;
      
      // Add timestamp
      if (msg.timestamp) {
        bubbleContent += `<span class="time image-time">${sanitizeText(msg.timestamp)}</span>`;
      }
      
      // Add checkmarks
      bubbleContent += checkmarkHTML;
      
      finalBubble = `<dd class="bubble ${msg.outgoing?'out':'in'} image-bubble">${bubbleContent}</dd>`;
    } else {
      // Use the text bubble already built (already includes senderNameHTML)
      finalBubble = bubble;
    }
    
    return `${timeBreak}<div class="${rowClass} ${groupClass}" data-message-id="${msg.id}"><dl class="msg">${finalBubble}${statusIndicator}</dl></div>`;
  }
  
  // Other templates: basic row structure
  const rowClass = msg.outgoing ? 'row out' : 'row in';
  return `${timeBreak}<div class="${rowClass}" data-message-id="${msg.id}">${avatar}<dl class="msg">${who}${bubble}${statusIndicator}</dl></div>`;
}

export function buildHTML(project: SkinProject, expandAllEmails = false): string {
  // iOS and Android templates with enhanced features
  if (project.template === 'ios' || project.template === 'android') {
    const s = project.settings;
    const isIOS = project.template === 'ios';
    
    // iOS Header with background image and overlays
    let header = '';
    if (isIOS && s.iosHeaderImageUrl) {
      // iOS with background image - ALWAYS show header div for background image
      const avatarUrl = s.iosAvatarUrl || '';
      const contactName = s.iosContactName || '';
      
      // Always render header div (background image needs the container)
      const avatarOverlay = avatarUrl ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="ios-header-avatar" />` : '';
      const nameOverlay = contactName ? `<div class="ios-header-name">${sanitizeText(contactName)}</div>` : '';
      header = `<div class="ios-header">${avatarOverlay}${nameOverlay}</div>`;
    } else if (isIOS) {
      // iOS without background image - show header ONLY if name or avatar exists
      const contactName = s.iosContactName || s.chatContactName || '';
      const avatarUrl = s.iosAvatarUrl || '';
      
      // Only show header if we have name or avatar
      if (contactName || avatarUrl) {
        // Generate initials from name if no avatar
        const getInitials = (name: string) => {
          if (!name) return '?';
          const words = name.trim().split(/\s+/);
          if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
          return (words[0][0] + words[words.length - 1][0]).toUpperCase();
        };
        
        const avatarOverlay = avatarUrl 
          ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="ios-header-avatar" />` 
          : (contactName ? `<div class="ios-header-avatar-placeholder">${getInitials(contactName)}</div>` : '');
        const nameOverlay = contactName ? `<div class="ios-header-name">${sanitizeText(contactName)}</div>` : '';
        
        header = `<div class="ios-header">${avatarOverlay}${nameOverlay}</div>`;
      }
    } else if (!isIOS && s.androidHeaderImageUrl) {
      // Android Header with background image - ALWAYS show header div for background image
      const contactName = s.chatContactName || s.androidContactName || '';
      const avatarUrl = s.instagramAvatarUrl || s.androidAvatarUrl || '';
      
      // Always render header div (background image needs the container)
      // Generate initials from name if no avatar
      const getInitials = (name: string) => {
        if (!name) return '?';
        // Remove emojis and special characters
        const cleanName = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
        const words = cleanName.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return '?';
        if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
      };
      
      const avatarOverlay = avatarUrl 
        ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="android-header-avatar" />` 
        : (contactName ? `<div class="android-header-avatar-placeholder">${getInitials(contactName)}</div>` : '');
      const nameOverlay = contactName ? `<div class="android-header-name">${sanitizeText(contactName)}</div>` : '';
      header = `<div class="android-header">${avatarOverlay}${nameOverlay}</div>`;
    } else if (!isIOS) {
      // Android without background image - show header ONLY if name or avatar exists
      const isGroupMode = s.androidGroupMode;
      const contactName = isGroupMode 
        ? (s.androidGroupName || 'Group Chat')
        : (s.chatContactName || s.androidContactName || '');
      const avatarUrl = s.instagramAvatarUrl || s.androidAvatarUrl || '';
      
      // Only show header if we have name or avatar
      if (contactName || avatarUrl) {
        // Generate initials from name if no avatar
        const getInitials = (name: string) => {
          if (!name) return '?';
          // Remove emojis and special characters
          const cleanName = name.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();
          const words = cleanName.split(/\s+/).filter(w => w.length > 0);
          if (words.length === 0) return '?';
          if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
          return (words[0][0] + words[words.length - 1][0]).toUpperCase();
        };
        
        const avatarOverlay = avatarUrl 
          ? `<img src="${sanitizeUrl(avatarUrl)}" alt="avatar" class="android-header-avatar" />` 
          : `<div class="android-header-avatar-placeholder">${getInitials(contactName)}</div>`;
        
        // For group mode, show participant count
        const participantCount = isGroupMode && s.androidGroupParticipants 
          ? `<div class="android-header-subtitle">${s.androidGroupParticipants.length} participants</div>`
          : '';
        
        const nameOverlay = contactName 
          ? `<div class="android-header-name-wrapper"><div class="android-header-name">${sanitizeText(contactName)}</div>${participantCount}</div>` 
          : '';
        header = `<div class="android-header">${avatarOverlay}${nameOverlay}</div>`;
      }
    } else {
      // Fallback: iOS Status Bar (optional)
      const statusBar = isIOS && s.iosShowStatusBar 
        ? `<div class="ios-status-bar"><span class="signal">📶</span><span class="time">${s.iosStatusBarTime || '9:41'}</span><span class="status-icons">🔋</span></div>`
        : '';
      
      // Contact header with "To:" prefix if enabled
      const contactName = isIOS ? s.iosContactName : s.androidContactName;
      const contactHeader = contactName
        ? `<div class="chat-header">${isIOS && s.iosShowHeader ? '<span class="to-label">To: </span>' : ''}<span class="contact-name">${sanitizeText(contactName)}</span>${!isIOS && s.androidShowStatus ? `<span class="status">${sanitizeText(s.androidStatusText||'Online')}</span>` : ''}</div>`
        : '';
      
      header = `${statusBar}${contactHeader}`;
    }
    
    // Messages
    const body = (isIOS || !isIOS) 
      ? project.messages.map((m, i) => msgHTML(m, project.template, project, { index: i, allMessages: project.messages })).join('')
      : project.messages.map(m => msgHTML(m, project.template, project)).join('');
    
    // Typing indicator
    const typing = s.chatShowTyping 
      ? `<div class="row typing"><div class="typing-bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>${s.chatTypingName ? `<span class="typing-label">${sanitizeText(s.chatTypingName)}</span>` : ''}</div>`
      : '';
    
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
    
    return `<div class="chat">${header}${messagesContainer}${footer}</div>`;
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
        : `<img src="${PLATFORM_ASSETS.google.logo}" alt="Google" class="google-logo-img" />`;
    
    const logoClass = engine === 'google' ? 'logo-container' : engine === 'google-old' ? 'logo old' : 'logo naver';
    
    // Build suggestions
    const suggestions = (s.googleSuggestions||[]).filter(line=>line.trim().length>0).map(line => {
      const withBold = applyBoldMarkup(line);
      return `<div class="suggest-item"><img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="suggest-icon" />${sanitizeText(withBold)}</div>`;
    }).join('');
    
    // Build search bar with icons
    const searchBarContent = `<img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="search-icon-left" /><span class="search-text">${searchTerm}</span><div class="search-icons-right"><img src="${PLATFORM_ASSETS.google.clearIcon}" alt="" class="search-icon-clear" /><img src="${PLATFORM_ASSETS.google.micIcon}" alt="" class="search-icon-mic" /><img src="${PLATFORM_ASSETS.google.lensIcon}" alt="" class="search-icon-lens" /></div>`;
    
    // Build unified search component (bar + dropdown as one)
    const searchComponent = suggestions.length 
      ? `<div class="search-container"><div class="search-bar">${searchBarContent}</div><div class="suggest-box">${suggestions}</div></div>`
      : `<div class="search-bar-solo">${searchBarContent}</div>`;
    
    // Tabs (All, Images, Videos, News, etc.)
    const tabs = `<div class="search-tabs"><span class="tab active"><img src="${PLATFORM_ASSETS.google.searchIcon}" alt="" class="tab-icon" />All</span><span class="tab">Images</span><span class="tab">Videos</span><span class="tab">News</span><span class="tab">Maps</span><span class="tab">More</span></div>`;
    
    // Result statistics (only if enabled)
    const stats = s.googleShowStats && (s.googleResultsCount || s.googleResultsTime)
      ? `<p class="search-stats">${sanitizeText(`${s.googleResultsCount||''}${s.googleResultsCount&&s.googleResultsTime? ' ' : ''}${s.googleResultsTime ? '('+s.googleResultsTime+')':''}`)}</p>`
      : '';
    
    // Did you mean correction (only if enabled)
    const dym = s.googleShowDidYouMean && s.googleDidYouMean
      ? `<p class="search-dym"><span class="search-dym1">Did you mean: </span><span class="search-dym2">${sanitizeText(s.googleDidYouMean)}</span></p>`
      : '';
    
    // Build search results from messages array
    const results = project.messages.map(msg => {
      const title = sanitizeText(msg.content || 'Untitled Result');
      const url = sanitizeText(msg.googleResultUrl || 'https://example.com');
      const description = msg.googleResultDescription ? sanitizeText(msg.googleResultDescription) : '';
      
      return `<div class="search-result">
        <div class="result-url">${url}</div>
        <div class="result-title">${title}</div>
        ${description ? `<div class="result-desc">${description}</div>` : ''}
      </div>`;
    }).join('');
    
    const body = `<div class="${logoClass}">${logoHtml}</div><div class="search-wrap">${searchComponent}${tabs}${stats}${dym}${results}</div>`;
    return `<div class="chat">${body}</div>`;
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
      return `<div class="chat tweets">${tweets}</div>`;
    } else {
      // Simple mode: each message becomes its own tweet
      const tweets = project.messages.map(m => msgHTML(m, 'twitter', project)).join('');
      return `<div class="chat tweets">${tweets}</div>`;
    }
  }

  const body = project.messages.map(m => msgHTML(m, project.template, project)).join('');
  return `<div class="chat">${body}</div>`;
}

function buildIOSCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.iosDarkMode;
  
  // iOS Dark Mode color scheme
  const chatBg = isDark ? '#000000' : '#fff';
  const messagesBg = isDark ? '#000000' : '#fff';
  const headerLabelBg = isDark ? '#1c1c1e' : '#fff';
  const headerLabelColor = isDark ? '#8e8e93' : '#86868b';
  const contactNameColor = isDark ? '#fff' : '#000';
  const statusBarBg = isDark ? '#1c1c1e' : '#f6f6f6';
  const statusBarColor = isDark ? '#fff' : '#000';
  const statusBarBorder = isDark ? '#38383a' : '#e0e0e0';
  const timeBreakColor = isDark ? '#8e8e93' : '#86868b';
  const receiverBubbleBg = isDark ? '#262628' : recvBg;
  const receiverTextColor = isDark ? '#fff' : '#000';
  const receiverTimeColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
  const typingBubbleBg = isDark ? '#262628' : recvBg;
  const inputBarBg = isDark ? '#1c1c1e' : '#f6f6f6';
  const inputBarBorder = isDark ? '#38383a' : '#e0e0e0';
  const inputFieldBg = isDark ? '#2c2c2e' : '#fff';
  const inputFieldBorder = isDark ? '#48484a' : '#c7c7cc';
  const inputPlaceholderColor = isDark ? '#636366' : '#86868b';
  
  const headerBg = s.iosHeaderImageUrl ? `background:url('${s.iosHeaderImageUrl}') no-repeat top center;background-size:100% auto;` : 'background:#007aff;';
  const footerBg = s.iosFooterImageUrl ? `background:url('${s.iosFooterImageUrl}') no-repeat bottom center;background-size:100% auto;` : `background:${inputBarBg};`;
  
    return `/* Generated with AO3 Skin Generator - Free forever! Support: https://ao3skingenerator.com/donate */
#workskin .chat{width:100%;max-width:${Math.min(maxWidth, 375)}px;min-width:320px;margin:0 auto;display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;padding:0;background:${chatBg};}
#workskin .ios-header{position:relative;${headerBg}height:65px;display:flex;align-items:center;padding:0;overflow:hidden;}
#workskin .ios-header-avatar{position:absolute;left:65px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.3);}
#workskin .ios-header-avatar img{width:100%;height:100%;}
#workskin .ios-header-avatar-placeholder{position:absolute;left:65px;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,0.25);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;border:2px solid rgba(255,255,255,0.3);}
#workskin .ios-header-name{position:absolute;left:112px;right:65px;top:0;bottom:0;display:flex;align-items:center;font-size:15px;font-weight:600;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,0.4);line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 177px);}
#workskin .ios-status-bar{background:${statusBarBg};padding:6px 16px 4px 16px;display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:600;color:${statusBarColor};border-bottom:1px solid ${statusBarBorder};}
#workskin .ios-status-bar .time{flex:1;text-align:center;}
#workskin .ios-status-bar .status-icons{display:flex;align-items:center;font-size:12px;}
#workskin .ios-status-bar .status-icons > *{margin-left:4px;}
#workskin .ios-status-bar .status-icons > *:first-child{margin-left:0;}
#workskin .chat-header{text-align:center;font-size:13px;color:${headerLabelColor};padding:8px 12px 6px 12px;margin-bottom:4px;font-weight:400;background:${headerLabelBg};}
#workskin .chat-header .to-label{font-weight:400;color:${headerLabelColor};margin-right:4px;}
#workskin .chat-header .contact-name{font-weight:600;color:${contactNameColor};display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#workskin .chat-messages{padding:12px 8px;background:${messagesBg};}
#workskin .time-break{text-align:center;font-size:11px;color:${timeBreakColor};margin:12px 0 8px 0;font-weight:500;}
#workskin .row{display:flex;margin:0 0 0 -6px;align-items:flex-end;flex-wrap:wrap;width:100%;}
#workskin .row > *{margin-left:6px;}
#workskin .row.single{margin:12px 0;}
#workskin .row.first{margin:12px 0 2px 0;}
#workskin .row.middle{margin:2px 0;}
#workskin .row.last{margin:2px 0 12px 0;}
#workskin .row.out{justify-content:flex-end;}
#workskin .row.in{justify-content:flex-start;}
#workskin img.avatar{width:28px;height:28px;border-radius:50%;overflow:hidden;flex-shrink:0;}
#workskin dl.msg{margin:0;display:flex;flex-direction:column;margin-top:-1px;}
#workskin dl.msg > *{margin-top:1px;}
#workskin .row.out dl.msg{align-items:flex-end;}
#workskin .row.in dl.msg{align-items:flex-start;}
#workskin dt.sender{font-size:11px;color:${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(235,235,245,0.5)'};margin:6px 0 2px 36px;font-weight:500;max-width:calc(70% - 36px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
#workskin dd{margin:0;}
#workskin dd.bubble{position:relative;display:inline-block;min-width:0;max-width:260px;padding:8px 12px;border-radius:18px;line-height:1.35;font-size:15px;white-space:normal;word-break:keep-all;overflow-wrap:anywhere;}
#workskin dd.bubble.image-bubble{padding:8px 12px;max-width:60%;overflow:visible;}
#workskin dd.bubble.image-bubble img.message-image{width:100%;height:auto;display:block;border-radius:12px;margin-top:6px;}
#workskin dd.bubble.image-bubble.out{border-bottom-right-radius:4px;}
#workskin dd.bubble.image-bubble.out img.message-image{border-bottom-right-radius:4px;}
#workskin dd.bubble.image-bubble.in{border-bottom-left-radius:4px;}
#workskin dd.bubble.image-bubble.in img.message-image{border-bottom-left-radius:4px;}
#workskin dd.bubble.out{background:${senderBg};color:#fff;border-bottom-right-radius:4px;}
#workskin dd.bubble.out .bubble-tail{display:none;}
#workskin dd.bubble.out.has-tail .bubble-tail-out{display:block;position:absolute;right:-8px;bottom:-1px;color:${senderBg};pointer-events:none;}
#workskin dd.bubble.in{background:${receiverBubbleBg};color:${receiverTextColor};border-bottom-left-radius:4px;}
#workskin dd.bubble.in .bubble-tail{display:none;}
#workskin dd.bubble.in.has-tail .bubble-tail-in{display:block;position:absolute;left:-8px;bottom:-1px;color:${receiverBubbleBg};pointer-events:none;}
#workskin dd.bubble.out .time{display:block;font-size:11px;color:rgba(255,255,255,0.65);margin-top:6px;font-weight:400;}
#workskin dd.bubble.in .time{display:block;font-size:11px;color:${receiverTimeColor};margin-top:6px;font-weight:400;}
#workskin dd.bubble.image-bubble .time.image-time{position:absolute;bottom:8px;right:8px;margin:0;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:10px;font-size:11px;color:#fff;}
#workskin dd.bubble .reaction{position:absolute;bottom:-10px;right:8px;background:rgba(44,44,46,0.95);border:1.5px solid rgba(255,255,255,0.1);border-radius:14px;padding:3px 8px;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,0.3);}
#workskin dd.status-indicator{font-size:10px;color:${isDark ? 'rgba(255,255,255,0.45)' : 'rgba(235,235,245,0.45)'};text-align:right;margin:2px 10px 0 0;font-weight:400;}
#workskin dd.attach{margin-top:2px;}
#workskin img.attach-img{max-width:220px;border-radius:12px;display:block;}
#workskin .row.typing{align-items:center;margin-left:-6px;}
#workskin .row.typing > *{margin-left:6px;}
#workskin .typing-bubble{background:${typingBubbleBg};padding:10px 14px;border-radius:18px;display:flex;align-items:center;border-bottom-left-radius:4px;}
#workskin .typing-bubble > *{margin-left:4px;}
#workskin .typing-bubble > *:first-child{margin-left:0;}
#workskin .typing-bubble .dot{width:8px;height:8px;background:${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(235,235,245,0.6)'};border-radius:50%;animation:typing 1.4s infinite;}
#workskin .typing-bubble .dot:nth-child(2){animation-delay:0.2s;}
#workskin .typing-bubble .dot:nth-child(3){animation-delay:0.4s;}
@keyframes typing{0%,60%,100%{opacity:0.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-4px);}}
#workskin .typing-label{font-size:11px;color:${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(235,235,245,0.5)'};font-weight:400;}
#workskin .ios-footer{position:relative;${footerBg}height:47px;border-top:1px solid ${inputBarBorder};}
#workskin .ios-input-bar{background:${inputBarBg};padding:8px 12px;border-top:1px solid ${inputBarBorder};display:flex;align-items:center;}
#workskin .ios-input-bar > *{margin-left:8px;}
#workskin .ios-input-bar > *:first-child{margin-left:0;}
#workskin .ios-input-bar .input-placeholder{flex:1;background:${inputFieldBg};border:1px solid ${inputFieldBorder};border-radius:18px;padding:8px 12px;font-size:14px;color:${inputPlaceholderColor};}
#workskin dd.bubble .group-sender-row{display:flex !important;align-items:center;gap:6px;margin-bottom:4px;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble.image-bubble .group-sender-row{display:flex !important;align-items:center;gap:6px;margin-bottom:6px;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble .group-avatar{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block !important;}
#workskin dd.bubble .group-avatar-initials{width:20px;height:20px;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;}
#workskin dd.bubble .group-sender{font-size:11px;font-weight:600;line-height:1.2;opacity:0.9;display:inline-block !important;}
${getTextFormattingCSS(isDark)}
#workskin .wm{margin-top:16px;font-size:10px;opacity:0.4;text-align:center;color:${timeBreakColor};}
#workskin .visually-hidden{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;}`;
}

function buildAndroidCSS(s: SkinProject['settings'], senderBg: string, recvBg: string, neutralBg: string, maxWidth: number): string {
  const isDark = s.androidDarkMode;
  
  // WhatsApp dark theme colors
  const chatBg = isDark ? '#0b141a' : '#ece5dd';
  const headerBgColor = isDark ? '#1f2c34' : '#075e54';
  const headerBg = s.androidHeaderImageUrl ? `background:url('${s.androidHeaderImageUrl}') no-repeat top center;background-size:100% auto;` : `background:${headerBgColor};`;
  const footerBgColor = isDark ? '#1f2c34' : '#f0f0f0';
  const footerBg = s.androidFooterImageUrl ? `background:url('${s.androidFooterImageUrl}') no-repeat bottom center;background-size:contain;` : `background:${footerBgColor};`;
  const footerBorderColor = isDark ? '#2a3942' : '#d1d7db';
  
  // Bubble colors
  const senderBubbleBg = isDark ? '#005c4b' : senderBg;
  const receiverBubbleBg = isDark ? '#1f2c34' : recvBg;
  const bubbleTextColor = isDark ? '#e9edef' : '#000';
  const timeColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)';
  const senderNameColor = isDark ? 'rgba(255,255,255,0.7)' : 'rgba(100,100,100,0.8)';
  const timeBreakColor = isDark ? '#8696a0' : '#667781';
  const typingLabelColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)';
  const typingDotBg = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
  const avatarPlaceholderBg = isDark ? '#00a884' : '#128c7e';
  const bubbleShadow = isDark ? '0 1px 2px rgba(0,0,0,0.3)' : '0 1px 2px rgba(0,0,0,0.1)';
  
    return `/* Generated with AO3 Skin Generator - Free forever! Support: https://ao3skingenerator.com/donate */
#workskin .chat{width:100%;max-width:${Math.min(maxWidth, 400)}px;min-width:320px;margin:0 auto;display:flex;flex-direction:column;font-family:${s.fontFamily};background:${chatBg};padding:0;}
#workskin .android-header{position:relative;${headerBg}height:60px;display:flex;align-items:center;padding:0;overflow:visible;}
#workskin .android-header-avatar{position:absolute;left:60px;top:0;bottom:0;margin:auto 0;width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid rgba(255,255,255,0.2);}
#workskin .android-header-avatar img{width:100%;height:100%;}
#workskin .android-header-avatar-placeholder{position:absolute;left:60px;top:0;bottom:0;margin:auto 0;width:40px;height:40px;border-radius:50%;background:${avatarPlaceholderBg};display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;font-weight:600;border:2px solid rgba(255,255,255,0.2);}
#workskin .android-header-name{position:absolute;left:110px;right:60px;top:0;bottom:0;display:flex;align-items:center;font-size:16px;font-weight:600;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 170px);padding:4px 0;}
#workskin .android-header-name-wrapper{position:absolute;left:110px;right:60px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.3);padding:4px 0;}
#workskin .android-header-name-wrapper .android-header-name{position:static;font-size:16px;font-weight:600;line-height:1.4;padding:0;max-width:100%;overflow:visible;}
#workskin .android-header-subtitle{font-size:12px;opacity:0.8;line-height:1.2;margin-top:2px;}
#workskin .chat-header{padding:8px 12px;background:${headerBgColor};color:#fff;margin-bottom:12px;}
#workskin .chat-header .contact-name{font-size:16px;font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
#workskin .chat-header .status{font-size:12px;opacity:0.8;display:block;margin-top:2px;}
#workskin .chat-messages{padding:12px 8px;background:${chatBg};}
#workskin .time-break{text-align:center;font-size:11px;color:${timeBreakColor};margin:12px 0 8px 0;font-weight:500;}
#workskin .row{display:flex;margin:0 0 0 -6px;align-items:flex-end;flex-wrap:wrap;width:100%;}
#workskin .row > *{margin-left:6px;}
#workskin .row.single{margin:12px 0;}
#workskin .row.first{margin:12px 0 2px 0;}
#workskin .row.middle{margin:2px 0;}
#workskin .row.last{margin:2px 0 12px 0;}
#workskin .row.out{justify-content:flex-end;}
#workskin .row.in{justify-content:flex-start;}
#workskin img.avatar{width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;}
#workskin dl.msg{margin:0;display:flex;flex-direction:column;margin-top:-1px;}
#workskin dl.msg > *{margin-top:1px;}
#workskin .row.out dl.msg{align-items:flex-end;}
#workskin .row.in dl.msg{align-items:flex-start;}
#workskin dt.sender{font-size:12px;color:${senderNameColor};margin:0 0 4px 8px;padding:4px 0;font-weight:600;max-width:calc(75% - 8px);overflow:visible;white-space:nowrap;line-height:1.4;}
#workskin dd{margin:0;}
#workskin dd.bubble{position:relative;display:inline-block;min-width:0;max-width:280px;padding:7px 10px;border-radius:8px;line-height:1.4;font-size:14px;box-shadow:${bubbleShadow};white-space:normal;word-break:keep-all;overflow-wrap:anywhere;}
#workskin dd.bubble.image-bubble{padding:7px 10px;max-width:70%;overflow:visible;margin-top:4px;}
#workskin dd.bubble.image-bubble img.message-image{width:100%;height:auto;display:block;border-radius:6px;margin-top:6px;}
#workskin dd.bubble.image-bubble.out{border-bottom-right-radius:2px;}
#workskin dd.bubble.image-bubble.out img.message-image{border-bottom-right-radius:2px;}
#workskin dd.bubble.image-bubble.in{border-bottom-left-radius:2px;}
#workskin dd.bubble.image-bubble.in img.message-image{border-bottom-left-radius:2px;}
#workskin dd.bubble.out{background:${senderBubbleBg};color:${bubbleTextColor};border-top-right-radius:8px;border-bottom-right-radius:2px;border-bottom-left-radius:8px;border-top-left-radius:8px;}
#workskin dd.bubble.in{background:${receiverBubbleBg};color:${bubbleTextColor};border-top-left-radius:8px;border-bottom-left-radius:2px;border-bottom-right-radius:8px;border-top-right-radius:8px;}
#workskin dd.bubble .group-sender-row{display:flex !important;align-items:center;gap:6px;margin-bottom:4px;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble.image-bubble .group-sender-row{display:flex !important;align-items:center;gap:6px;margin-bottom:6px;visibility:visible !important;opacity:1 !important;}
#workskin dd.bubble .group-avatar{width:20px;height:20px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block !important;}
#workskin dd.bubble .group-avatar-initials{width:20px;height:20px;border-radius:50%;display:flex !important;align-items:center;justify-content:center;font-size:8px;font-weight:700;flex-shrink:0;}
#workskin dd.bubble .group-sender{font-size:11px;font-weight:600;line-height:1.2;opacity:0.9;display:inline-block !important;}
#workskin dd.bubble .time{display:block;font-size:10px;color:${timeColor};margin-top:4px;text-align:right;font-weight:400;padding-right:20px;}
#workskin dd.bubble.image-bubble .time.image-time{position:absolute;bottom:6px;right:8px;margin:0;background:rgba(0,0,0,0.5);padding:2px 6px;border-radius:8px;font-size:10px;color:#fff;padding-right:24px;}
#workskin dd.bubble.out .check-icon{position:absolute;bottom:6px;right:6px;height:14px;width:auto;opacity:0.7;}
#workskin dd.bubble.image-bubble.out .check-icon{bottom:8px;right:8px;z-index:1;}
#workskin dd.bubble .reaction{position:absolute;bottom:-8px;left:8px;background:transparent;border:none;border-radius:0;padding:0;font-size:18px;box-shadow:none;}
#workskin dd.status-indicator{font-size:10px;color:${timeColor};text-align:right;margin:2px 10px 0 0;font-weight:400;}
#workskin dd.attach{margin-top:4px;}
#workskin img.attach-img{max-width:200px;border-radius:8px;display:block;}
#workskin .row.typing{align-items:center;margin-left:-6px;}
#workskin .row.typing > *{margin-left:6px;}
#workskin .typing-bubble{background:${receiverBubbleBg};padding:10px 14px;border-radius:8px;display:flex;align-items:center;box-shadow:${bubbleShadow};}
#workskin .typing-bubble > *{margin-left:4px;}
#workskin .typing-bubble > *:first-child{margin-left:0;}
#workskin .typing-bubble .dot{width:8px;height:8px;background:${typingDotBg};border-radius:50%;animation:typing 1.4s infinite;}
#workskin .typing-bubble .dot:nth-child(2){animation-delay:0.2s;}
#workskin .typing-bubble .dot:nth-child(3){animation-delay:0.4s;}
@keyframes typing{0%,60%,100%{opacity:0.3;}30%{opacity:1;}}
#workskin .typing-label{font-size:11px;color:${typingLabelColor};}
#workskin .android-footer{position:relative;${footerBg}height:60px;border-top:1px solid ${footerBorderColor};overflow:visible;background-position:center;}
${getTextFormattingCSS(isDark)}
#workskin .wm{margin-top:12px;font-size:10px;opacity:0.5;text-align:center;color:${timeBreakColor};}
#workskin .visually-hidden{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;}`;
}

function buildTwitterCSS(s: SkinProject['settings'], senderBg: string, maxWidth: number): string {
  const isDark = s.twitterDarkMode;
  
  // Color scheme
  const bgColor = isDark ? '#15202b' : '#fff';
  const bgHover = isDark ? '#1c2e3f' : '#f7f9f9';
  const textPrimary = isDark ? '#e7e9ea' : '#0f1419';
  const textSecondary = isDark ? '#8b98a5' : '#536471';
  const borderColor = isDark ? '#38444d' : '#eff3f4';
  const handleColor = isDark ? '#8b98a5' : '#71767b';
  const quoteHover = isDark ? '#1c2e3f' : '#f7f9f9';
  const replyLineColor = isDark ? '#38444d' : '#cfd9de';
  
  return `/* Generated with AO3 Skin Generator - Free forever! Support: https://ao3skingenerator.com/donate */
#workskin .chat{width:550px;max-width:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:0 auto;box-sizing:border-box;}
#workskin .tweets .tweet{background:${bgColor};border:1px solid ${borderColor};border-radius:16px;padding:16px;margin:0 0 12px 0;position:relative;box-sizing:border-box;transition:background-color 0.2s;}
#workskin .tweets .tweet:hover{background:${bgHover};}
#workskin .tweets .tweet.reply{margin-left:44px;margin-top:-8px;}
#workskin .tweets .tweet.reply::before{content:'';position:absolute;left:-32px;top:-8px;bottom:12px;width:2px;background:${replyLineColor};}
#workskin .tweets .tweet.reply::after{content:'';position:absolute;left:-32px;top:20px;width:20px;height:2px;background:${replyLineColor};}
#workskin .tweet-header{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;position:relative;}
#workskin .tweet img.avatar{width:40px;height:40px;border-radius:50%;flex-shrink:0;}
#workskin .tweet .head{flex:1;min-width:0;}
#workskin .tweet .head-content{display:block;}
#workskin .tweet .name-line{display:flex;align-items:center;line-height:20px;gap:4px;flex-wrap:nowrap;}
#workskin .tweet .name{font-weight:700;color:${textPrimary};font-size:15px;line-height:20px;white-space:nowrap;}
#workskin .tweet .verified-container{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
#workskin .tweet .verified-badge{width:18px;height:18px;display:block;vertical-align:middle;}
#workskin .tweet .handle{color:${handleColor};font-weight:400;font-size:15px;line-height:20px;white-space:nowrap;}
#workskin .tweet .follow-dot{color:${handleColor};font-size:15px;line-height:20px;}
#workskin .tweet .follow-btn{background:transparent;color:#1d9bf0;font-weight:700;font-size:15px;padding:0;border:none;cursor:pointer;line-height:20px;flex-shrink:0;white-space:nowrap;}
#workskin .tweet .follow-btn:hover{color:#1a8cd8;text-decoration:underline;}
#workskin .tweet .twitter-logo{width:20px;height:20px;display:block;vertical-align:middle;flex-shrink:0;}
#workskin .tweet .body{margin-top:12px;font-size:15px;line-height:20px;color:${textPrimary};word-wrap:break-word;white-space:pre-wrap;}
#workskin .tweet .body .hashtag{color:#1d9bf0;font-weight:400;}
#workskin .tweet .body .mention{color:#1d9bf0;font-weight:400;}
#workskin .tweet .tweet-image{width:100%;max-width:100%;height:auto;max-height:285px;border-radius:16px;margin-top:12px;border:1px solid ${borderColor};display:block;}
#workskin .tweet .time-line{margin-top:16px;font-size:15px;color:${textSecondary};padding-bottom:16px;border-bottom:1px solid ${borderColor};}
#workskin .tweet .metrics{display:flex;padding:12px 0;font-size:14px;color:${textSecondary};border-bottom:1px solid ${borderColor};align-items:center;width:100%;gap:12px;}
#workskin .tweet .metric{display:inline-flex;align-items:center;cursor:pointer;transition:color 0.2s;gap:6px;flex:1;}
#workskin .tweet .metric:first-child{justify-content:flex-start;}
#workskin .tweet .metric:last-child{justify-content:flex-end;}
#workskin .tweet .metric-icon{width:20px;height:20px;display:block;flex-shrink:0;vertical-align:middle;}
#workskin .tweet .metric-count{color:${textSecondary};font-weight:400;font-size:14px;line-height:20px;vertical-align:middle;}
#workskin .tweet .metric:hover .metric-count{text-decoration:underline;}
#workskin .tweet .metric.replies:hover{color:#1d9bf0;}
#workskin .tweet .metric.replies:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.retweets:hover{color:#00ba7c;}
#workskin .tweet .metric.retweets:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.likes:hover{color:#f91880;}
#workskin .tweet .metric.likes:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.bookmarks:hover{color:#1d9bf0;}
#workskin .tweet .metric.bookmarks:hover .metric-icon{opacity:1;filter:none;}
#workskin .tweet .metric.views:hover{color:${textSecondary};}
#workskin .tweet .metric.views:hover .metric-icon{opacity:1;}
#workskin .tweet .replying-to{font-size:13px;color:${textSecondary};margin:8px 0 4px 0;line-height:16px;}
#workskin .tweet .replying-to .reply-handle{color:#1d9bf0;text-decoration:none;}
#workskin .tweet .replying-to .reply-handle:hover{text-decoration:underline;}
#workskin .tweet.expanded{padding:16px;display:flex;margin-left:-12px;}
#workskin .tweet.expanded > *{margin-left:12px;}
#workskin .tweet.expanded .avatar{width:40px;height:40px;flex-shrink:0;margin:0;}
#workskin .tweet.expanded .expanded-content{flex:1;min-width:0;}
#workskin .tweet.expanded .expanded-name{display:flex;align-items:center;margin-bottom:2px;margin-left:-4px;}
#workskin .tweet.expanded .expanded-name > *{margin-left:4px;}
#workskin .tweet.expanded .expanded-name .name{font-weight:700;color:${textPrimary};font-size:20px;line-height:24px;}
#workskin .tweet.expanded .expanded-name .verified-badge{width:20px;height:20px;}

#workskin .tweet.expanded .expanded-handle{color:${textSecondary};font-size:15px;line-height:20px;margin-bottom:4px;}
#workskin .tweet.expanded .replying-to{margin:0 0 12px 0;}
#workskin .tweet.expanded .expanded-body{font-size:23px;line-height:28px;color:${textPrimary};word-wrap:break-word;white-space:pre-wrap;}
#workskin .tweet.expanded .tweet-image{margin-top:16px;}
#workskin .tweet.expanded .time-line{border:none;padding:0;margin-top:16px;}
#workskin .tweet .quote{border:1px solid ${borderColor};border-radius:12px;padding:12px;margin-top:12px;transition:background-color 0.2s;cursor:pointer;}
#workskin .tweet .quote:hover{background:${quoteHover};}
#workskin .tweet .quote-head{display:flex;align-items:center;font-size:14px;line-height:16px;margin-bottom:4px;margin-left:-4px;}
#workskin .tweet .quote-head > *{margin-left:4px;}
#workskin .tweet .quote-name{font-weight:700;color:${textPrimary};}
#workskin .tweet .quote-avatar{width:20px;height:20px;border-radius:50%;overflow:hidden;}
#workskin .tweet .quote-verified-container{display:inline-flex;align-items:center;margin-left:-2px;}
#workskin .tweet .quote-verified-container > *{margin-left:2px;}
#workskin .tweet .quote-verified-badge{width:16px;height:16px;display:inline-block;vertical-align:middle;}

#workskin .tweet .quote-handle{color:${textSecondary};font-weight:400;font-size:14px;}
#workskin .tweet .quote-body{margin-top:4px;font-size:15px;line-height:20px;color:${textPrimary};}
#workskin .tweet .quote-image{width:100%;height:auto;border-radius:12px;margin-top:12px;border:1px solid ${borderColor};}
#workskin .tweets .wm{margin-top:12px;font-size:10px;opacity:0.5;text-align:center;color:${textSecondary};}
#workskin .link{text-decoration:none;color:#1d9bf0;}
#workskin .visually-hidden{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;}`;
}

function buildGoogleCSS(maxWidth: number): string {
  return `/* Generated with AO3 Skin Generator - Free forever! Support: https://ao3skingenerator.com/donate */
#workskin .chat{width:100%;min-width:320px;max-width:${Math.min(maxWidth, 600)}px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;box-sizing:border-box;padding:20px 0;}
#workskin .logo-container{text-align:center;margin:0 0 26px 0;padding:20px 0;}
#workskin .google-logo-img{height:92px;width:auto;display:inline-block;}
#workskin .logo{text-align:center;margin:0 0 24px 0;font-weight:400;font-size:48px;font-family:"Product Sans",Arial,sans-serif;line-height:1;letter-spacing:-0.5px;}
#workskin .logo.old{font-family:"Cardo","Garamond",serif;}
#workskin .logo.naver{font-family:"Maven Pro",Verdana,sans-serif;}
#workskin .naver-green{color:#2DB400;}
#workskin .blue{color:#4285F4;}#workskin .red{color:#EA4335;}#workskin .yellow{color:#FBBC04;}#workskin .green{color:#34A853;}
#workskin .search-wrap{margin-top:20px;max-width:584px;margin-left:auto;margin-right:auto;}
#workskin .search-container{background:#fff;border:1px solid #dfe1e5;border-radius:24px;box-shadow:0 1px 6px rgba(32,33,36,0.28);overflow:hidden;}
#workskin .search-container .search-bar{display:flex;align-items:center;padding:11px 14px 11px 16px;font-size:16px;color:#202124;line-height:1.5;border-bottom:1px solid #e8eaed;}
#workskin .search-container .search-bar > *{margin-left:8px;}
#workskin .search-container .search-bar > *:first-child{margin-left:0;}
#workskin .search-bar-solo{background:#fff;border:1px solid #dfe1e5;border-radius:24px;display:flex;align-items:center;padding:11px 14px 11px 16px;font-size:16px;color:#202124;line-height:1.5;box-shadow:0 1px 6px rgba(32,33,36,0.28);}
#workskin .search-bar-solo > *{margin-left:8px;}
#workskin .search-bar-solo > *:first-child{margin-left:0;}
#workskin .search-icon-left{width:20px;height:20px;opacity:0.54;flex-shrink:0;}
#workskin .search-text{flex:1;min-width:0;color:#202124;}
#workskin .search-icons-right{display:flex;align-items:center;margin-left:auto;flex-shrink:0;}
#workskin .search-icons-right{margin-left:-12px;}
#workskin .search-icons-right > *{margin-left:12px;}
#workskin .search-icon-clear{width:14px;height:14px;opacity:0.54;cursor:pointer;flex-shrink:0;}
#workskin .search-icon-clear:hover{opacity:0.87;}
#workskin .search-icon-mic{width:18px;height:18px;cursor:pointer;flex-shrink:0;}
#workskin .search-icon-lens{width:18px;height:18px;opacity:0.54;cursor:pointer;flex-shrink:0;}
#workskin .search-icon-lens:hover{opacity:0.87;}
#workskin .suggest-box{padding:8px 0;}
#workskin .suggest-item{display:flex;align-items:center;padding:6px 16px;font-size:16px;line-height:1.5;color:#202124;cursor:pointer;margin-left:-14px;}
#workskin .suggest-item > *{margin-left:14px;}
#workskin .suggest-item:hover{background:#f8f9fa;}
#workskin .suggest-icon{width:20px;height:20px;opacity:0.54;flex-shrink:0;}
#workskin .suggest-item b,#workskin .suggest-item strong{font-weight:700;color:#202124;}
#workskin .search-tabs{display:flex;border-bottom:1px solid #dadce0;margin:20px 0 0 0;padding:0;}
#workskin .search-tabs .tab{padding:14px 12px;font-size:13px;color:#5f6368;cursor:pointer;border-bottom:3px solid transparent;display:flex;align-items:center;margin:0 0 0 -8px;}
#workskin .search-tabs .tab > *{margin-left:8px;}
#workskin .search-tabs .tab > *{margin-left:8px;}
#workskin .search-tabs .tab:first-child{margin-left:12px;}
#workskin .search-tabs .tab:hover{color:#202124;}
#workskin .search-tabs .tab.active{color:#1a73e8;border-bottom-color:#1a73e8;}
#workskin .search-tabs .tab-icon{width:16px;height:16px;opacity:0.87;}
#workskin .search-stats{margin:12px 0 0 12px;color:#70757a;font-size:14px;}
#workskin .search-dym{margin:16px 0 0 12px;font-size:16px;line-height:1.5;}
#workskin .search-dym1{color:#5f6368;}
#workskin .search-dym2{color:#1a0dab;font-weight:400;text-decoration:none;cursor:pointer;}
#workskin .search-dym2:hover{text-decoration:underline;}
#workskin .search-result{margin:24px 0 0 12px;max-width:600px;}
#workskin .result-url{color:#006621;font-size:14px;line-height:1.3;margin-bottom:4px;}
#workskin .result-title{color:#1a0dab;font-size:20px;line-height:1.3;font-weight:400;cursor:pointer;margin-bottom:4px;}
#workskin .result-title:hover{text-decoration:underline;}
#workskin .result-desc{color:#4d5156;font-size:14px;line-height:1.58;}
#workskin .wm{margin-top:24px;font-size:10px;opacity:0.5;text-align:center;}`;
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
