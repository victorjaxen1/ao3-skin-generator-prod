import { resolveMessageIdentity } from './identity';
import {
  Message,
  SkinProject,
  TwitterPoll,
  TwitterPostLayout,
  TwitterSceneMode,
  TwitterTheme,
  TwitterVideo,
} from './schema';

export type TwitterRelationshipIssueCode = 'duplicate-id' | 'missing-parent' | 'self-parent' | 'cycle';

export interface TwitterRelationshipIssue {
  code: TwitterRelationshipIssueCode;
  messageId: string;
  parentId?: string;
}

export interface TwitterPostNode {
  message: Message;
  children: TwitterPostNode[];
  issues: TwitterRelationshipIssue[];
}

export interface NormalizedTwitterScene {
  mode: TwitterSceneMode;
  theme: TwitterTheme;
  posts: Message[];
  roots: TwitterPostNode[];
  issues: TwitterRelationshipIssue[];
}

export interface NormalizedYouTubeUrl {
  videoId: string;
  canonicalUrl: string;
  embedUrl: string;
}

export interface TwitterExportPartition {
  messages: Message[];
  continuation?: {
    rootMessageId: string;
    handle: string;
    excerpt: string;
  };
}

export function resolveTwitterSceneMode(
  settings: SkinProject['settings'],
  messageCount: number,
): TwitterSceneMode {
  if (settings.twitterSceneMode) return settings.twitterSceneMode;
  if (settings.twitterThreadMode) return 'thread';
  return messageCount <= 1 ? 'single' : 'timeline';
}

/** Read the additive scene-mode field while keeping old projects stable. */
export function getTwitterSceneMode(
  project: Pick<SkinProject, 'settings' | 'messages'>,
): TwitterSceneMode {
  return resolveTwitterSceneMode(project.settings, project.messages.length);
}

export function resolveTwitterTheme(settings: SkinProject['settings']): TwitterTheme {
  return settings.twitterTheme || (settings.twitterDarkMode ? 'dark' : 'light');
}

export function normalizeYouTubeUrl(value: string): NormalizedYouTubeUrl | undefined {
  const trimmed = value.trim();
  if (!trimmed || /[<>]/.test(trimmed)) return undefined;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = '';
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] || '';
  else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v') || '';
    else {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') videoId = parts[1] || '';
    }
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return undefined;
  return {
    videoId,
    canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
  };
}

function isSafeHttpUrl(value: string | undefined, requireHttps = true): boolean {
  if (!value) return true;
  if (/[<>]/.test(value)) return false;
  try {
    const parsed = new URL(value);
    return requireHttps ? parsed.protocol === 'https:' : parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateTwitterVideo(video: TwitterVideo | undefined): string[] {
  if (!video) return [];
  const issues: string[] = [];
  if (video.title.length > 200) issues.push('Keep the video title under 200 characters.');
  if (!isSafeHttpUrl(video.posterUrl)) issues.push('Poster must use a valid HTTPS address.');
  if (!isSafeHttpUrl(video.captionTrackUrl)) issues.push('Caption track must use a valid HTTPS address.');
  if (video.captionTrackUrl && (!video.captionLanguage?.trim() || !video.captionLabel?.trim())) {
    issues.push('Caption tracks need a language and label.');
  }
  if (video.source === 'youtube') {
    if (!normalizeYouTubeUrl(video.url)) issues.push('Use a supported YouTube watch, share, Shorts, live, or embed address.');
  } else {
    if (!isSafeHttpUrl(video.url)) issues.push('Direct videos must use a valid HTTPS address.');
    if (!/^video\/(mp4|webm|ogg)$/i.test(video.mimeType || '')) {
      issues.push('Direct videos need a supported MIME type: video/mp4, video/webm, or video/ogg.');
    }
  }
  return issues;
}

export function calculateTwitterPollPercentages(poll: TwitterPoll): number[] {
  const votes = poll.options.map(option => Math.max(0, option.votes || 0));
  const total = votes.reduce((sum, count) => sum + count, 0);
  if (total > 0) {
    const raw = votes.map(count => count * 100 / total);
    const rounded = raw.map(Math.floor);
    let remainder = 100 - rounded.reduce((sum, value) => sum + value, 0);
    raw
      .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .forEach(({ index }) => {
        if (remainder > 0) {
          rounded[index] += 1;
          remainder -= 1;
        }
      });
    return rounded;
  }
  return poll.options.map(option => Math.max(0, Math.min(100, option.percent || 0)));
}

export function getTwitterPollError(poll: TwitterPoll | undefined): string | undefined {
  if (!poll) return undefined;
  if (poll.options.length < 2 || poll.options.length > 4) return 'Polls need two to four options.';
  if (poll.options.some(option => !option.text.trim())) return 'Every poll option needs text.';
  if (poll.state === 'closed' && !poll.options.some(option => option.votes !== undefined)) {
    const total = poll.options.reduce((sum, option) => sum + (option.percent || 0), 0);
    if (total !== 100) return 'Closed poll percentages must total 100.';
  }
  return undefined;
}

/** Add canonical Twitter fields without deleting compatibility fallbacks. */
export function migrateTwitterProject(project: SkinProject): SkinProject {
  if (project.template !== 'twitter') return project;
  const twitterSceneMode = getTwitterSceneMode(project);
  const twitterTheme = resolveTwitterTheme(project.settings);
  const hasPerPostQuote = project.messages.some(message => !!message.twitterQuote);
  const legacyQuote = project.settings.twitterQuoteEnabled && !hasPerPostQuote
    ? {
        name: project.settings.twitterQuoteName || '',
        handle: cleanHandle(project.settings.twitterQuoteHandle),
        avatarUrl: project.settings.twitterQuoteAvatar || undefined,
        verified: project.settings.twitterQuoteVerified || undefined,
        text: project.settings.twitterQuoteText || '',
        attachments: project.settings.twitterQuoteImage
          ? [{ type: 'image' as const, url: project.settings.twitterQuoteImage, alt: 'Image in quoted post' }]
          : undefined,
      }
    : undefined;
  return {
    ...project,
    settings: { ...project.settings, twitterSceneMode, twitterTheme },
    messages: project.messages.map((message, index) => ({
      ...message,
      twitterLayout: message.twitterLayout || (message.expandedView ? 'expanded' : 'auto'),
      twitterMediaCrop: message.twitterMediaCrop || 'auto',
      ...(legacyQuote && index === 0 ? { twitterQuote: legacyQuote } : {}),
      ...(message.parentId
        ? { twitterReplyHandlesMode: message.twitterReplyHandlesMode || (message.replyToHandles ? 'manual' : 'auto') }
        : {}),
    })),
  };
}

export function resolveTwitterLayout(
  project: Pick<SkinProject, 'settings' | 'messages'>,
  message: Message,
  index: number,
): Exclude<TwitterPostLayout, 'auto'> {
  const requested = message.twitterLayout
    || (message.expandedView ? 'expanded' : 'auto');
  if (requested !== 'auto') return requested;
  return getTwitterSceneMode(project) === 'single' && index === 0 ? 'expanded' : 'compact';
}

/** All descendants are invalid parent choices because selecting one creates a cycle. */
export function getTwitterDescendantIds(messages: Message[], parentId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const message of messages) {
    if (!message.parentId) continue;
    const list = children.get(message.parentId) || [];
    list.push(message.id);
    children.set(message.parentId, list);
  }

  const descendants = new Set<string>();
  const pending = [...(children.get(parentId) || [])];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (descendants.has(id)) continue;
    descendants.add(id);
    pending.push(...(children.get(id) || []));
  }
  return descendants;
}

export function validateTwitterRelationships(messages: Message[]): TwitterRelationshipIssue[] {
  const issues: TwitterRelationshipIssue[] = [];
  const byId = new Map<string, Message>();
  for (const message of messages) {
    if (byId.has(message.id)) issues.push({ code: 'duplicate-id', messageId: message.id });
    else byId.set(message.id, message);
  }

  for (const message of messages) {
    if (!message.parentId) continue;
    if (message.parentId === message.id) {
      issues.push({ code: 'self-parent', messageId: message.id, parentId: message.parentId });
    } else if (!byId.has(message.parentId)) {
      issues.push({ code: 'missing-parent', messageId: message.id, parentId: message.parentId });
    }
  }

  const state = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cycleIds = new Set<string>();
  const visit = (messageId: string) => {
    if (state.get(messageId) === 2) return;
    if (state.get(messageId) === 1) {
      const start = stack.lastIndexOf(messageId);
      for (const id of stack.slice(Math.max(0, start))) cycleIds.add(id);
      return;
    }
    state.set(messageId, 1);
    stack.push(messageId);
    const parentId = byId.get(messageId)?.parentId;
    if (parentId && parentId !== messageId && byId.has(parentId)) visit(parentId);
    stack.pop();
    state.set(messageId, 2);
  };
  for (const message of messages) visit(message.id);
  for (const message of messages) {
    if (cycleIds.has(message.id)) {
      issues.push({ code: 'cycle', messageId: message.id, parentId: message.parentId });
    }
  }
  return issues;
}

function cleanHandle(value: string | undefined): string | undefined {
  const handle = value?.trim().replace(/^@+/, '');
  return handle || undefined;
}

export function deriveTwitterReplyHandles(project: SkinProject, message: Message): string[] {
  if (message.twitterReplyHandlesMode === 'manual' || (!message.twitterReplyHandlesMode && message.replyToHandles)) {
    return (message.replyToHandles || []).map(cleanHandle).filter((handle): handle is string => !!handle);
  }
  if (!message.parentId) return [];
  const parent = project.messages.find(candidate => candidate.id === message.parentId);
  if (!parent) return [];
  const identity = resolveMessageIdentity(project, parent);
  const handle = cleanHandle(identity.twitterHandle)
    || cleanHandle(identity.name.toLowerCase().replace(/\s+/g, ''));
  return handle ? [handle] : [];
}

/**
 * Produce one defensive, render-ready model. Malformed local/legacy state is
 * promoted to roots, while strict backup import can reject the same issues.
 */
export function normalizeTwitterScene(project: SkinProject): NormalizedTwitterScene {
  const issues = validateTwitterRelationships(project.messages);
  const invalidParents = new Set(
    issues
      .filter(issue => issue.code === 'missing-parent' || issue.code === 'self-parent' || issue.code === 'cycle')
      .map(issue => issue.messageId),
  );
  const issueByMessage = new Map<string, TwitterRelationshipIssue[]>();
  for (const issue of issues) {
    const list = issueByMessage.get(issue.messageId) || [];
    list.push(issue);
    issueByMessage.set(issue.messageId, list);
  }

  const posts = project.messages.map((message, index) => {
    const parentId = message.parentId && !invalidParents.has(message.id) ? message.parentId : undefined;
    const normalized = {
      ...message,
      parentId,
      replyToHandles: parentId ? deriveTwitterReplyHandles(project, { ...message, parentId }) : undefined,
      expandedView: resolveTwitterLayout(project, message, index) === 'expanded',
    };
    return normalized;
  });

  const nodes = posts.map(message => ({
    message,
    children: [],
    issues: issueByMessage.get(message.id) || [],
  } satisfies TwitterPostNode));
  const firstNodeById = new Map<string, TwitterPostNode>();
  for (const node of nodes) if (!firstNodeById.has(node.message.id)) firstNodeById.set(node.message.id, node);
  const roots: TwitterPostNode[] = [];
  for (const node of nodes) {
    const { message } = node;
    const parent = message.parentId ? firstNodeById.get(message.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }

  return { mode: getTwitterSceneMode(project), theme: resolveTwitterTheme(project.settings), posts, roots, issues };
}

/**
 * Keep complete root trees together when possible. A thread longer than the
 * limit is split in authored traversal order and carries explicit continuation
 * context; parent links that cross the boundary are promoted so no reply can
 * disappear when the partition is rendered independently.
 */
export function partitionTwitterSceneForExport(
  project: SkinProject,
  limit = 15,
): TwitterExportPartition[] {
  const scene = normalizeTwitterScene(project);
  if (scene.posts.length === 0) return [{ messages: [] }];
  const partitions: TwitterExportPartition[] = [];
  const walk = (node: TwitterPostNode): Message[] => [
    node.message,
    ...node.children.flatMap(walk),
  ];

  for (const root of scene.roots) {
    const tree = walk(root);
    if (tree.length <= limit) {
      const last = partitions[partitions.length - 1];
      if (last && !last.continuation && last.messages.length + tree.length <= limit) last.messages.push(...tree);
      else partitions.push({ messages: [...tree] });
      continue;
    }

    const rootIdentity = resolveMessageIdentity(project, root.message);
    const handle = cleanHandle(rootIdentity.twitterHandle)
      || cleanHandle(rootIdentity.name.toLowerCase().replace(/\s+/g, ''))
      || 'user';
    const excerpt = root.message.content.replace(/\s+/g, ' ').trim().slice(0, 90);
    for (let offset = 0; offset < tree.length; offset += limit) {
      const rawChunk = tree.slice(offset, offset + limit);
      const ids = new Set(rawChunk.map(message => message.id));
      const messages = rawChunk.map(message => message.parentId && !ids.has(message.parentId)
        ? {
            ...message,
            parentId: undefined,
            replyToHandles: deriveTwitterReplyHandles(project, message),
            twitterReplyHandlesMode: 'manual' as const,
          }
        : message);
      partitions.push({
        messages,
        ...(offset > 0 ? { continuation: { rootMessageId: root.message.id, handle, excerpt } } : {}),
      });
    }
  }
  return partitions;
}
