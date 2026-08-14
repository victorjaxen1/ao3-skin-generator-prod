import { Message, SkinProject } from './schema';
import { resolveMessageIdentity } from './identity';
import { calculateTwitterPollPercentages, deriveTwitterReplyHandles } from './twitter';
import { iosMessageLabel } from './ios';

const PLATFORM_LABEL: Record<SkinProject['template'], string> = {
  ios: 'iMessage conversation',
  android: 'WhatsApp conversation',
  twitter: 'X / Twitter scene',
  google: 'Google search results',
};

function plainMessageText(value: string): string {
  return value
    .replace(/```([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1$2')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/~([^~\n]+)~/g, '$1')
    .trim();
}

function attachmentLines(message: Message): string[] {
  return (message.attachments || []).map(attachment => {
    if (attachment.decorative) return '[Decorative image]';
    return attachment.alt?.trim() ? `[Image: ${attachment.alt.trim()}]` : '[Image: no description provided]';
  });
}

function chatSpeaker(project: SkinProject, message: Message): string {
  return resolveMessageIdentity(project, message).name;
}

function twitterSpeaker(project: SkinProject, message: Message): string {
  const identity = resolveMessageIdentity(project, message);
  return identity.twitterHandle ? `${identity.name} (@${identity.twitterHandle})` : identity.name;
}

function whatsappLines(project: SkinProject, message: Message): string[] {
  if (message.whatsappEvent) return [`— ${message.whatsappEvent.text.trim()} —`];
  const lines: string[] = [];
  if (message.whatsappReply) {
    const target = project.messages.find(candidate => candidate.id === message.whatsappReply!.messageId);
    if (target) lines.push(`${chatSpeaker(project, message)} replied to ${chatSpeaker(project, target)}: ${plainMessageText(target.content) || (target.whatsappMedia?.kind === 'audio' ? 'Voice message' : target.whatsappMedia?.kind === 'video' ? 'Video' : target.attachments?.length ? 'Photo' : target.whatsappLinkPreview?.title || 'Message')}`);
    else lines.push(`${chatSpeaker(project, message)} replied to an unavailable message.`);
  }
  const speaker = chatSpeaker(project, message);
  const timestamp = message.timestamp?.trim() ? ` (${message.timestamp.trim()})` : '';
  const content = plainMessageText(message.content);
  lines.push(`${speaker}${timestamp}:${content ? ` ${content}` : ''}`);
  lines.push(...attachmentLines(message));
  if (message.whatsappLinkPreview) {
    lines.push(`[Link: ${message.whatsappLinkPreview.title}]`);
    if (message.whatsappLinkPreview.description?.trim()) lines.push(plainMessageText(message.whatsappLinkPreview.description));
    lines.push(message.whatsappLinkPreview.url);
  }
  if (message.whatsappMedia?.kind === 'audio') {
    lines.push(`[Voice message${message.whatsappMedia.duration ? `, ${message.whatsappMedia.duration}` : ''}]`);
    if (message.whatsappMedia.transcript?.trim()) lines.push(`Transcript: ${plainMessageText(message.whatsappMedia.transcript)}`);
    lines.push(`Source: ${message.whatsappMedia.url}`);
  }
  if (message.whatsappMedia?.kind === 'video') {
    lines.push(`[Video${message.whatsappMedia.duration ? `, ${message.whatsappMedia.duration}` : ''}]`);
    if (message.whatsappMedia.description?.trim()) lines.push(plainMessageText(message.whatsappMedia.description));
    lines.push(`Source: ${message.whatsappMedia.url}`);
    if (message.whatsappMedia.source === 'direct' && message.whatsappMedia.captionTrackUrl) lines.push(`Captions: ${message.whatsappMedia.captionLabel || message.whatsappMedia.captionLanguage || 'caption track'} — ${message.whatsappMedia.captionTrackUrl}`);
  }
  if (message.whatsappReactions?.length) lines.push(`Reactions: ${message.whatsappReactions.map(reaction => `${reaction.emoji}${(reaction.count || 1) > 1 ? ` ×${reaction.count}` : ''}`).join(', ')}`);
  return lines;
}

/**
 * The iOS reading order §11.1 specifies.
 *
 * Separate from `whatsappLines` on purpose: the two platforms label the same
 * concepts differently — Apple's are Tapbacks, not reactions — and a shared
 * function would settle that by picking one platform's vocabulary for both.
 */
function iosLines(project: SkinProject, message: Message): string[] {
  if (message.iosEvent) return [`— ${message.iosEvent.text.trim()} —`];
  const lines: string[] = [];
  if (message.iosReply) {
    const target = project.messages.find(candidate => candidate.id === message.iosReply!.messageId);
    if (target) {
      const excerpt = plainMessageText(target.content) || iosMessageLabel(target);
      lines.push(`${chatSpeaker(project, message)} replied to ${chatSpeaker(project, target)}: ${excerpt}`);
    } else {
      lines.push(`${chatSpeaker(project, message)} replied to an unavailable message.`);
    }
  }
  const timestamp = message.timestamp?.trim() ? ` (${message.timestamp.trim()})` : '';
  const content = plainMessageText(message.content);
  lines.push(`${chatSpeaker(project, message)}${timestamp}:${content ? ` ${content}` : ''}`);
  lines.push(...attachmentLines(message));
  if (message.iosLinkPreview) {
    lines.push(`[Link: ${message.iosLinkPreview.title}]`);
    if (message.iosLinkPreview.description?.trim()) lines.push(plainMessageText(message.iosLinkPreview.description));
    lines.push(message.iosLinkPreview.url);
  }
  if (message.iosMedia?.kind === 'audio') {
    lines.push(`[Voice message${message.iosMedia.duration ? `, ${message.iosMedia.duration}` : ''}]`);
    if (message.iosMedia.transcript?.trim()) lines.push(`Transcript: ${plainMessageText(message.iosMedia.transcript)}`);
    lines.push(`Source: ${message.iosMedia.url}`);
  }
  if (message.iosMedia?.kind === 'video') {
    lines.push(`[Video${message.iosMedia.title ? `: ${message.iosMedia.title}` : ''}${message.iosMedia.duration ? `, ${message.iosMedia.duration}` : ''}]`);
    if (message.iosMedia.description?.trim()) lines.push(plainMessageText(message.iosMedia.description));
    lines.push(`Source: ${message.iosMedia.url}`);
    if (message.iosMedia.source === 'direct' && message.iosMedia.captionTrackUrl) {
      lines.push(`Captions: ${message.iosMedia.captionLabel || message.iosMedia.captionLanguage || 'caption track'} — ${message.iosMedia.captionTrackUrl}`);
    }
  }
  if (message.iosTapbacks?.length) {
    lines.push(`Tapbacks: ${message.iosTapbacks.map(tapback => `${tapback.emoji}${(tapback.count || 1) > 1 ? ` ×${tapback.count}` : ''}`).join(', ')}`);
  } else if (message.reaction?.trim()) {
    // The retired single-emoji field. §0.7 forbids *migrating* it into
    // `iosTapbacks` — the new editor owns that field canonically — but a
    // project saved before this release still carries one, and the renderer
    // still draws it, so the transcript has to agree with what a reader sees.
    lines.push(`[Reaction: ${message.reaction.trim()}]`);
  }
  if (message.outgoing && message.status) lines.push(`Status: ${message.status}`);
  return lines;
}

export function buildSceneTranscript(project: SkinProject): string {
  const lines: string[] = [PLATFORM_LABEL[project.template]];

  if (project.template === 'google') {
    const query = project.settings.googleQuery?.trim();
    if (query) lines.push(`Search: ${query}`);
    for (const message of project.messages) {
      lines.push('');
      lines.push(plainMessageText(message.content) || 'Untitled result');
      if (message.googleResultUrl?.trim()) lines.push(message.googleResultUrl.trim());
      if (message.googleResultDescription?.trim()) lines.push(plainMessageText(message.googleResultDescription));
    }
    return lines.join('\n').trim();
  }

  for (const message of project.messages) {
    lines.push('');
    if (project.template === 'android' && !message.isTyping) {
      lines.push(...whatsappLines(project, message));
      continue;
    }
    if (project.template === 'ios' && !message.isTyping) {
      // The time break belongs above its owning message, and an event replaces
      // the message entirely, so the break is emitted here rather than inside
      // iosLines where it would land after the reply relationship.
      if (message.showTimeBreak && message.timeBreakText?.trim()) lines.push(`— ${message.timeBreakText.trim()} —`);
      lines.push(...iosLines(project, message));
      continue;
    }
    if (message.showTimeBreak && message.timeBreakText?.trim()) lines.push(`— ${message.timeBreakText.trim()} —`);
    if (message.isTyping && (project.template === 'ios' || project.template === 'android')) {
      lines.push(`${chatSpeaker(project, message)} is typing…`);
      continue;
    }

    const speaker = project.template === 'twitter'
      ? twitterSpeaker(project, message)
      : chatSpeaker(project, message);
    const content = plainMessageText(message.content);
    const timestamp = message.timestamp?.trim() ? ` (${message.timestamp.trim()})` : '';
    lines.push(`${speaker}${timestamp}:${content ? ` ${content}` : ''}`);
    lines.push(...attachmentLines(message));
    if (project.template === 'twitter') {
      const replyHandles = deriveTwitterReplyHandles(project, message);
      if (message.parentId && replyHandles.length) lines.push(`Replying to ${replyHandles.map(handle => `@${handle}`).join(', ')}.`);
      if (message.twitterTranslation) {
        lines.push(`Original${message.twitterTranslation.languageLabel ? ` (${message.twitterTranslation.languageLabel})` : ''}: ${plainMessageText(message.twitterTranslation.originalText)}`);
        lines.push(`Translation: ${plainMessageText(message.twitterTranslation.translatedText)}`);
      }
      if (message.twitterQuote) {
        const quotedCharacter = message.twitterQuote.characterId
          ? project.cast?.characters.find(character => character.id === message.twitterQuote!.characterId)
          : undefined;
        const quoteName = quotedCharacter?.name || message.twitterQuote.name || 'External account';
        const quoteHandle = quotedCharacter?.twitterHandle || message.twitterQuote.handle;
        lines.push(`Quoted post by ${quoteName}${quoteHandle ? ` (@${quoteHandle.replace(/^@+/, '')})` : ''}: ${plainMessageText(message.twitterQuote.text)}`);
        lines.push(...attachmentLines({ ...message, attachments: message.twitterQuote.attachments }));
      }
      if (message.twitterVideo) {
        lines.push(`[Video: ${message.twitterVideo.title.trim() || 'Video'}]`);
        if (message.twitterVideo.description?.trim()) lines.push(plainMessageText(message.twitterVideo.description));
        lines.push(`Source: ${message.twitterVideo.url}`);
        if (message.twitterVideo.captionTrackUrl) lines.push(`Captions: ${message.twitterVideo.captionLabel || message.twitterVideo.captionLanguage || 'caption track'} — ${message.twitterVideo.captionTrackUrl}`);
      }
      if (message.twitterPoll) {
        const percentages = calculateTwitterPollPercentages(message.twitterPoll);
        lines.push(`${message.twitterPoll.state === 'open' ? 'Open' : 'Closed'} poll:`);
        message.twitterPoll.options.forEach((option, index) => lines.push(`- ${option.text}: ${percentages[index]}%`));
      }
      if (message.twitterAccountLabel) lines.push(`Account label: ${message.twitterAccountLabel}`);
      if (message.twitterActivity) {
        const names = message.twitterActivity.actorCharacterIds.map(id => project.cast?.characters.find(character => character.id === id)?.name).filter(Boolean);
        lines.push(`${names.join(', ') || 'Someone'} ${message.twitterActivity.type === 'liked' ? 'liked' : 'reposted'} this post.`);
      }
    }
    if (message.reaction?.trim()) lines.push(`[Reaction: ${message.reaction.trim()}]`);
  }

  return lines.join('\n').trim();
}

export function defaultSceneAlt(project: SkinProject): string {
  const count = project.messages.length;
  const unit = project.template === 'google' ? (count === 1 ? 'result' : 'results') : (count === 1 ? 'message' : 'messages');
  return `Fictional ${PLATFORM_LABEL[project.template]} with ${count} ${unit}.`;
}
