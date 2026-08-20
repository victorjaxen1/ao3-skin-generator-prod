import { expect, test } from '@playwright/test';
import { buildHTML } from '../src/lib/generator';
import { defaultProject, Message, SkinProject } from '../src/lib/schema';
import {
  calculateTwitterPollPercentages,
  deriveTwitterReplyHandles,
  generateTweetMetrics,
  getTwitterPollError,
  getTwitterDescendantIds,
  getTwitterSceneMode,
  migrateTwitterProject,
  normalizeTwitterScene,
  normalizeYouTubeUrl,
  partitionTwitterSceneForExport,
  resolveTwitterTheme,
  resolveTwitterLayout,
  validateTwitterRelationships,
} from '../src/lib/twitter';

function twitterProject(messages: Message[]): SkinProject {
  const project = defaultProject();
  project.template = 'twitter';
  project.messages = messages;
  project.settings.twitterTimestamp = '';
  project.settings.twitterShowMetrics = false;
  project.cast = {
    twitterPrimaryId: 'alex',
    characters: [
      { id: 'alex', name: 'Alex', twitterHandle: 'alex' },
      { id: 'casey', name: 'Casey', twitterHandle: 'casey' },
    ],
  };
  return project;
}

const post = (id: string, content: string, parentId?: string, characterId = 'alex'): Message => ({
  id,
  sender: '',
  content,
  outgoing: true,
  characterId,
  parentId,
});

test('migrates legacy scene, layout, and reply-handle intent idempotently', () => {
  const project = twitterProject([
    { ...post('root', 'Root'), expandedView: true },
    { ...post('reply', 'Reply', 'root', 'casey'), replyToHandles: ['@alex'] },
  ]);
  project.settings.twitterThreadMode = true;

  const once = migrateTwitterProject(project);
  const twice = migrateTwitterProject(once);

  expect(once.settings.twitterSceneMode).toBe('thread');
  expect(once.messages[0].twitterLayout).toBe('expanded');
  expect(once.messages[1].twitterReplyHandlesMode).toBe('manual');
  expect(twice).toEqual(once);
});

test('normalizes a forest in authored root and sibling order', () => {
  const project = twitterProject([
    post('root-a', 'Root A'),
    post('root-b', 'Root B'),
    post('reply-a1', 'Reply A1', 'root-a'),
    post('reply-a2', 'Reply A2', 'root-a'),
    post('reply-b1', 'Reply B1', 'root-b'),
  ]);
  project.settings.twitterSceneMode = 'thread';

  const scene = normalizeTwitterScene(project);
  expect(scene.roots.map(node => node.message.id)).toEqual(['root-a', 'root-b']);
  expect(scene.roots[0].children.map(node => node.message.id)).toEqual(['reply-a1', 'reply-a2']);
  expect(scene.roots[1].children.map(node => node.message.id)).toEqual(['reply-b1']);
});

test('reports malformed relationships and defensively renders every post once', () => {
  const project = twitterProject([
    post('orphan', 'Orphan', 'gone'),
    post('self', 'Self', 'self'),
    post('cycle-a', 'Cycle A', 'cycle-b'),
    post('cycle-b', 'Cycle B', 'cycle-a'),
  ]);
  project.settings.twitterSceneMode = 'thread';

  expect(validateTwitterRelationships(project.messages).map(issue => issue.code)).toEqual([
    'missing-parent', 'self-parent', 'cycle', 'cycle',
  ]);
  const scene = normalizeTwitterScene(project);
  expect(scene.roots.map(node => node.message.id)).toEqual(['orphan', 'self', 'cycle-a', 'cycle-b']);

  const html = buildHTML(project);
  for (const id of ['orphan', 'self', 'cycle-a', 'cycle-b']) {
    expect(html.match(new RegExp(`data-message-id="${id}"`, 'g'))).toHaveLength(1);
  }
});

test('derives reply context from the live parent identity and preserves manual handles', () => {
  const project = twitterProject([post('root', 'Root'), post('reply', 'Reply', 'root', 'casey')]);
  expect(deriveTwitterReplyHandles(project, project.messages[1])).toEqual(['alex']);

  project.cast!.characters[0].twitterHandle = 'renamed';
  expect(deriveTwitterReplyHandles(project, project.messages[1])).toEqual(['renamed']);

  project.messages[1].twitterReplyHandlesMode = 'manual';
  project.messages[1].replyToHandles = ['@frozen'];
  expect(deriveTwitterReplyHandles(project, project.messages[1])).toEqual(['frozen']);
});

test('automatic reply context matches the visible fallback handle for an unnamed blank account', () => {
  const project = twitterProject([post('root', 'Root'), post('reply', 'Reply', 'root')]);
  project.cast!.characters[0] = { id: 'alex', name: 'User' };
  expect(deriveTwitterReplyHandles(project, project.messages[1])).toEqual(['user']);
});

test('prevents descendants from becoming parents and resolves automatic layout by scene mode', () => {
  const project = twitterProject([post('root', 'Root'), post('child', 'Child', 'root'), post('leaf', 'Leaf', 'child')]);
  expect([...getTwitterDescendantIds(project.messages, 'root')]).toEqual(['child', 'leaf']);

  project.settings.twitterSceneMode = 'single';
  expect(getTwitterSceneMode(project)).toBe('single');
  expect(resolveTwitterLayout(project, project.messages[0], 0)).toBe('expanded');
  expect(resolveTwitterLayout(project, project.messages[1], 1)).toBe('compact');
});

test('timeline keeps reply context without thread connectors and post timestamps override legacy global time', () => {
  const project = twitterProject([
    { ...post('root', 'Root'), timestamp: '1:00 PM' },
    { ...post('reply', 'Reply', 'root', 'casey'), timestamp: '1:01 PM' },
  ]);
  project.settings.twitterSceneMode = 'timeline';
  project.settings.twitterTimestamp = 'Legacy time';

  const timeline = buildHTML(project);
  expect(timeline).toContain('Replying to');
  expect(timeline).not.toContain('class="tweet reply');
  expect(timeline).toContain('1:00 PM');
  expect(timeline).not.toContain('Legacy time');

  project.settings.twitterSceneMode = 'thread';
  expect(buildHTML(project)).toContain('class="tweet reply');
});

// Both tweet templates carry the X logo.
//
// There are two of them — compact and expanded — and only compact ever had
// the logo. Nothing asserted the expanded one did, so it shipped without it
// in the 13 August overhaul and stayed that way: the four examples a
// developer reaches for first are all compact, and the bug hid behind them.
//
// The last case is the one that matters. A blank project defaults to scene
// mode `single`, and `resolveTwitterLayout` sends the first post of a single
// scene to the expanded template — so the DEFAULT path for a first-time
// visitor building a tweet was the one missing the logo.
test('both tweet templates carry the X logo, including a blank project default', () => {
  const compact = twitterProject([post('root', 'Root'), post('reply', 'Reply', 'root', 'casey')]);
  compact.settings.twitterSceneMode = 'thread';
  const compactHTML = buildHTML(compact);
  expect(compactHTML).toContain('class="tweet reply');
  expect(compactHTML).toContain('class="twitter-logo"');

  const expanded = twitterProject([{ ...post('root', 'Root'), twitterLayout: 'expanded' }]);
  const expandedHTML = buildHTML(expanded);
  expect(expandedHTML).toContain('class="tweet expanded"');
  expect(expandedHTML).toContain('class="twitter-logo"');

  // The default path, spelled out rather than assumed: no layout, no scene
  // mode, exactly what the picker produces.
  const blank = twitterProject([post('root', 'Root')]);
  expect(resolveTwitterLayout(blank, blank.messages[0], 0)).toBe('expanded');
  expect(buildHTML(blank)).toContain('class="twitter-logo"');
});

test('migrates legacy theme and global quote once, with canonical fields winning', () => {
  const project = twitterProject([post('root', 'Root'), post('other', 'Other')]);
  project.settings.twitterDarkMode = true;
  project.settings.twitterTheme = undefined;
  project.settings.twitterQuoteEnabled = true;
  project.settings.twitterQuoteName = 'Quoted User';
  project.settings.twitterQuoteHandle = '@quoted';
  project.settings.twitterQuoteText = 'Legacy quote';

  const migrated = migrateTwitterProject(project);
  expect(migrated.settings.twitterTheme).toBe('dark');
  expect(migrated.messages[0].twitterQuote).toMatchObject({ name: 'Quoted User', handle: 'quoted', text: 'Legacy quote' });
  expect(migrated.messages[1].twitterQuote).toBeUndefined();
  expect(migrateTwitterProject(migrated)).toEqual(migrated);
  expect(resolveTwitterTheme({ ...migrated.settings, twitterTheme: 'dim', twitterDarkMode: false })).toBe('dim');
});

test('normalizes supported YouTube URLs to one privacy-enhanced target', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=bN8449nalT8',
    'https://youtu.be/bN8449nalT8',
    'https://www.youtube.com/shorts/bN8449nalT8',
    'https://www.youtube.com/embed/bN8449nalT8',
  ]) {
    expect(normalizeYouTubeUrl(url)).toEqual({
      videoId: 'bN8449nalT8',
      canonicalUrl: 'https://www.youtube.com/watch?v=bN8449nalT8',
      embedUrl: 'https://www.youtube-nocookie.com/embed/bN8449nalT8',
    });
  }
  expect(normalizeYouTubeUrl('<iframe src="https://youtube.com/embed/bN8449nalT8">')).toBeUndefined();
  expect(normalizeYouTubeUrl('https://example.com/bN8449nalT8')).toBeUndefined();
  expect(normalizeYouTubeUrl('http://youtu.be/bN8449nalT8')).toBeUndefined();
});

test('keeps scene output static while AO3 work output contains the real player', () => {
  const project = twitterProject([{
    ...post('video', 'Watch this'),
    twitterVideo: { source: 'youtube', url: 'https://youtu.be/bN8449nalT8', title: '' },
  }]);
  const scene = buildHTML(project, 'static');
  const ao3 = buildHTML(project, 'ao3-work');

  expect(scene).toContain('https://i.ytimg.com/vi/bN8449nalT8/hqdefault.jpg');
  expect(scene).not.toMatch(/<iframe\b/i);
  expect(ao3).toContain('<iframe src="https://www.youtube-nocookie.com/embed/bN8449nalT8"');
  expect(ao3).not.toContain('video-poster-placeholder');
});

test('rounds vote counts to 100 and rejects invalid manual closed percentages', () => {
  const poll = {
    state: 'closed' as const,
    options: [
      { id: 'a', text: 'A', votes: 1 },
      { id: 'b', text: 'B', votes: 1 },
      { id: 'c', text: 'C', votes: 1 },
    ],
  };
  const percentages = calculateTwitterPollPercentages(poll);
  expect(percentages.reduce((sum, value) => sum + value, 0)).toBe(100);
  expect(getTwitterPollError({ ...poll, options: poll.options.map((option, index) => ({ ...option, votes: undefined, percent: index === 0 ? 60 : 10 })) })).toMatch(/total 100/);
});

test('partitions long threads without dropping or duplicating original posts', () => {
  const messages = Array.from({ length: 18 }, (_, index) => post(`post-${index + 1}`, `Post ${index + 1}`, index ? `post-${index}` : undefined));
  const project = twitterProject(messages);
  project.settings.twitterSceneMode = 'thread';
  const partitions = partitionTwitterSceneForExport(project, 15);
  expect(partitions).toHaveLength(2);
  expect(partitions[1].continuation).toMatchObject({ rootMessageId: 'post-1', handle: 'alex' });
  expect(partitions[1].messages[0].parentId).toBeUndefined();
  expect(partitions.flatMap(partition => partition.messages.map(message => message.id))).toEqual(messages.map(message => message.id));
});

test('composes rich post features into one static, skin-off-readable renderer', () => {
  const project = twitterProject([{
    ...post('rich', 'Fallback body'),
    attachments: [1, 2, 3, 4].map(number => ({ type: 'image' as const, url: `https://example.com/${number}.png`, alt: `Image ${number}` })),
    twitterQuote: { characterId: 'casey', text: 'Quoted text' },
    twitterPoll: { state: 'closed', options: [{ id: 'a', text: 'Yes', percent: 60 }, { id: 'b', text: 'No', percent: 40 }], finalLabel: 'Final results' },
    twitterTranslation: { languageLabel: 'French', originalText: 'Bonjour', translatedText: 'Hello', visibleText: 'translated' },
    twitterActivity: { type: 'liked', actorCharacterIds: ['casey'], additionalCount: 2 },
    twitterAccountLabel: 'Parody account',
  }]);
  project.settings.twitterTheme = 'dim';
  const html = buildHTML(project);
  expect(html).toContain('theme-dim');
  expect(html).toContain('media-count-4');
  expect(html).toContain('Quoted post by');
  expect(html).toContain('60%');
  expect(html).toContain('Translated from French');
  expect(html).toContain('Original text: Bonjour');
  expect(html).toContain('Casey and 2 others liked');
  expect(html).toContain('Parody account');
});

test('static video rendering is a linked poster fallback and never instantiates a player', () => {
  const project = twitterProject([{
    ...post('video', 'Watch this'),
    twitterVideo: {
      source: 'youtube',
      url: 'https://youtu.be/bN8449nalT8',
      posterUrl: 'https://example.com/poster.png',
      title: 'A fictional clip',
      description: 'Transcript summary.',
    },
  }]);
  const html = buildHTML(project);
  expect(html).toContain('https://www.youtube.com/watch?v=bN8449nalT8');
  expect(html).toContain('Transcript summary.');
  expect(html).not.toMatch(/<(iframe|video|source|track)\b/i);
});

test('AO3 rendering emits only structured provider or native-media players', () => {
  const youtube = twitterProject([{
    ...post('youtube', 'Watch this'),
    twitterVideo: {
      source: 'youtube', url: 'https://youtu.be/bN8449nalT8?feature=share',
      title: 'A fictional clip', description: 'Transcript summary.',
    },
  }]);
  const youtubeHtml = buildHTML(youtube, 'ao3-work');
  expect(youtubeHtml).toContain('<iframe');
  expect(youtubeHtml).toContain('src="https://www.youtube-nocookie.com/embed/bN8449nalT8"');
  expect(youtubeHtml).not.toContain('feature=share');

  youtube.messages[0].twitterVideo = {
    source: 'direct', url: 'https://media.example.com/story.webm', mimeType: 'video/webm',
    posterUrl: 'https://media.example.com/poster.jpg', title: 'Direct clip',
    description: 'A direct-media description.', captionTrackUrl: 'https://media.example.com/en.vtt',
    captionLanguage: 'en', captionLabel: 'English captions',
  };
  const directHtml = buildHTML(youtube, 'ao3-work');
  expect(directHtml).toContain('<video');
  expect(directHtml).toContain('<source src="https://media.example.com/story.webm" type="video/webm">');
  expect(directHtml).toContain('<track src="https://media.example.com/en.vtt" kind="captions" srclang="en" label="English captions" default="default">');
  expect(directHtml).not.toContain('<iframe');
});

test('automatic tweet metrics are stable, distinct, and ordered like a real footer', () => {
  const first = generateTweetMetrics({ id: 'm1', content: 'okay so I need to tell you all something' });
  const again = generateTweetMetrics({ id: 'm1', content: 'okay so I need to tell you all something' });
  const other = generateTweetMetrics({ id: 'm2', content: 'and I know you are all going to have opinions' });

  // Same post, same numbers — Auto twice must not reshuffle a read scene.
  expect(again).toEqual(first);
  // Different posts must not all show the same figures.
  expect(other.twitterLikes).not.toBe(first.twitterLikes);

  // views > likes > retweets > replies is what makes a fake footer read real.
  expect(first.twitterViews).toBeGreaterThan(first.twitterLikes);
  expect(first.twitterLikes).toBeGreaterThanOrEqual(first.twitterRetweets);
  expect(first.twitterRetweets).toBeGreaterThanOrEqual(first.twitterReplies);
  expect(first.twitterReplies).toBeGreaterThanOrEqual(0);

  // A reply is seen by fewer people than the post that started the thread.
  const reply = generateTweetMetrics({ id: 'm1', content: 'okay so I need to tell you all something', parentId: 'root' });
  expect(reply.twitterViews).toBeLessThan(first.twitterViews);
});
