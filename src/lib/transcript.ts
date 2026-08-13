import { Message, SkinProject } from './schema';
import { resolveMessageIdentity } from './identity';
import { calculateTwitterPollPercentages, deriveTwitterReplyHandles } from './twitter';

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
