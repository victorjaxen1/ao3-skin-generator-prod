import { Message, SkinProject } from './schema';

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
  if (message.outgoing) return project.settings.chatYourName?.trim() || 'You';
  const participants = project.template === 'android'
    ? project.settings.androidGroupParticipants
    : project.settings.iosGroupParticipants;
  return participants?.find(participant => participant.id === message.participantId)?.name
    || message.sender.trim()
    || 'Them';
}

function twitterSpeaker(project: SkinProject, message: Message): string {
  if (message.useCustomIdentity) {
    const name = message.sender.trim() || 'User';
    const handle = message.twitterHandle?.replace(/^@/, '').trim();
    return handle ? `${name} (@${handle})` : name;
  }
  const name = project.settings.twitterDisplayName?.trim() || message.sender.trim() || 'User';
  const handle = project.settings.twitterHandle?.replace(/^@/, '').trim();
  return handle ? `${name} (@${handle})` : name;
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
    if (message.reaction?.trim()) lines.push(`[Reaction: ${message.reaction.trim()}]`);
  }

  return lines.join('\n').trim();
}

export function defaultSceneAlt(project: SkinProject): string {
  const count = project.messages.length;
  const unit = project.template === 'google' ? (count === 1 ? 'result' : 'results') : (count === 1 ? 'message' : 'messages');
  return `Fictional ${PLATFORM_LABEL[project.template]} with ${count} ${unit}.`;
}
