import { expect, test } from '@playwright/test';
import {
  activationBaseline,
  authoredMessageCount,
  isProjectActivated,
  isSiteSkinActivated,
  markActivatedOnce,
  messageSignature,
  resetActivationSession,
  siteSkinBaseline,
} from '../src/lib/activation';
import { defaultProject, Message, SkinProject } from '../src/lib/schema';
import { instantiateTemplate, TEMPLATE_EXAMPLES } from '../src/lib/examples';
import { migrateProjectIdentities, updateSceneCharacter } from '../src/lib/identity';
import { migrateTwitterProject } from '../src/lib/twitter';
import { appendChatMessage } from '../src/lib/messageMetadata';
import { cloneTheme, findTemplate, TEMPLATES } from '../src/lib/siteSkin/templates';

/** Exactly what index.tsx installs into state, so the baseline matches production. */
function install(project: SkinProject): SkinProject {
  return migrateTwitterProject(migrateProjectIdentities(project));
}

function loadExample(id: string): SkinProject {
  const example = Object.values(TEMPLATE_EXAMPLES).flat().find(entry => entry.id === id);
  if (!example) throw new Error(`Unknown example: ${id}`);
  return install(instantiateTemplate(example));
}

function chatMessage(id: string, content: string, outgoing = true): Message {
  return { id, sender: outgoing ? 'You' : 'Them', content, outgoing };
}

test.describe('project activation predicate', () => {
  test('a freshly opened blank chat project is not activated', () => {
    const project = install(defaultProject());
    const baseline = activationBaseline(project);
    expect(authoredMessageCount(project, baseline)).toBe(0);
    expect(isProjectActivated(project, baseline)).toBe(false);
  });

  test('chat activates on the second authored message, not the first', () => {
    const project = install(defaultProject());
    const baseline = activationBaseline(project);

    const one = { ...project, messages: [...project.messages, chatMessage('new-1', 'First real line.')] };
    expect(isProjectActivated(one, baseline)).toBe(false);

    const two = { ...one, messages: [...one.messages, chatMessage('new-2', 'Second real line.', false)] };
    expect(isProjectActivated(two, baseline)).toBe(true);
  });

  test('editing two seeded messages counts as authorship', () => {
    const project = install(defaultProject());
    const baseline = activationBaseline(project);
    const edited = {
      ...project,
      messages: project.messages.map(message => ({ ...message, content: `${message.content} Rewritten.` })),
    };
    expect(authoredMessageCount(edited, baseline)).toBe(2);
    expect(isProjectActivated(edited, baseline)).toBe(true);
  });

  /**
   * The regression this exists for: `appendChatMessage` advances an automatic
   * delivery status to 'read' on every earlier outgoing message when a reply
   * arrives. If `status` counted, adding one incoming message would score two
   * and clear the chat threshold on its own.
   */
  test('an automatic read receipt is not authorship', () => {
    const project = install({
      ...defaultProject(),
      messages: [
        { ...chatMessage('seed-1', 'Are you coming?'), status: 'delivered', statusMode: 'auto' },
      ],
    });
    const baseline = activationBaseline(project);
    const withReply = {
      ...project,
      messages: appendChatMessage(project.messages, chatMessage('new-1', 'On my way.', false)),
    };

    expect(withReply.messages[0].status).toBe('read');
    expect(authoredMessageCount(withReply, baseline)).toBe(1);
    expect(isProjectActivated(withReply, baseline)).toBe(false);
  });

  test('reordering the same messages is not authorship', () => {
    const project = install(defaultProject());
    const baseline = activationBaseline(project);
    const reordered = { ...project, messages: [...project.messages].reverse() };
    expect(authoredMessageCount(reordered, baseline)).toBe(0);
  });

  test('key order does not read as an edit', () => {
    const message = chatMessage('m-1', 'Hello.');
    const respread: Message = { content: message.content, outgoing: message.outgoing, id: message.id, sender: message.sender };
    expect(messageSignature(respread)).toBe(messageSignature(message));
  });

  test('structured content counts as a material edit', () => {
    const project = install(defaultProject());
    const baseline = activationBaseline(project);
    const withExtras = {
      ...project,
      messages: project.messages.map((message, index) => index === 0
        ? { ...message, iosTapbacks: [{ emoji: '❤️' }] }
        : { ...message, iosMedia: { kind: 'audio' as const, url: 'https://example.com/a.mp3', mimeType: 'audio/mpeg' as const } }),
    };
    expect(isProjectActivated(withExtras, baseline)).toBe(true);
  });

  test('a blank Twitter project needs a post and a non-placeholder account', () => {
    const blank = install({ ...defaultProject(), template: 'twitter', messages: [] });
    const baseline = activationBaseline(blank);
    expect(isProjectActivated(blank, baseline)).toBe(false);

    const posted = {
      ...blank,
      messages: [chatMessage('t-1', 'The station is empty.')],
    };
    // The migrated primary account is still the 'User' placeholder.
    expect(isProjectActivated(posted, baseline)).toBe(false);

    // Naming the account goes through the one resolver, exactly as the identity
    // panel does. Writing `twitterDisplayName` alone would not be activation,
    // and should not be: the cast is canonical, settings are its fallback.
    const named = updateSceneCharacter(posted, posted.cast!.twitterPrimaryId!, {
      name: 'Alex Rivers',
      twitterHandle: 'alexrivers',
    });
    expect(isProjectActivated(named, baseline)).toBe(true);
  });

  test('Google needs a query and a result, and neither may be the seed', () => {
    const blank = install({ ...defaultProject(), template: 'google', messages: [] });
    const baseline = activationBaseline(blank);
    expect(isProjectActivated(blank, baseline)).toBe(false);

    const queryOnly = { ...blank, settings: { ...blank.settings, googleQuery: 'how to fake a death' } };
    expect(isProjectActivated(queryOnly, baseline)).toBe(false);

    const withResult = { ...queryOnly, messages: [chatMessage('r-1', 'Result title', false)] };
    expect(isProjectActivated(withResult, baseline)).toBe(true);
  });
});

test.describe('seeded example content is not the author’s work', () => {
  /**
   * §5.2: "Do not count seeded example content until the user edits it." This is
   * the case the plan asks to be tested explicitly, and it is the one that
   * would silently inflate activation for every visitor who clicks an example
   * and leaves.
   */
  for (const id of ['ios-rich-group-scene', 'whatsapp-group-chat', 'twitter-long-thread', 'google-news-articles']) {
    test(`${id} is not activated on load`, () => {
      const project = loadExample(id);
      expect(isProjectActivated(project, activationBaseline(project))).toBe(false);
    });
  }

  test('the rich iOS example activates once the author writes into it', () => {
    const project = loadExample('ios-rich-group-scene');
    const baseline = activationBaseline(project);
    const authored = {
      ...project,
      messages: [
        ...project.messages,
        chatMessage('mine-1', 'Wait — who sent that photo?'),
        chatMessage('mine-2', 'Not me.', false),
      ],
    };
    expect(isProjectActivated(authored, baseline)).toBe(true);
  });

  test('editing one post in a seeded Twitter example activates it', () => {
    const project = loadExample('twitter-quote-post');
    const baseline = activationBaseline(project);
    const edited = {
      ...project,
      messages: project.messages.map(message => ({ ...message, content: 'Rewritten by the author.' })),
    };
    // The seeded account is already real, so the authored post is the whole test.
    expect(isProjectActivated(edited, baseline)).toBe(true);
  });
});

test.describe('site skin activation', () => {
  test('a chosen template is not activated until a value changes', () => {
    const theme = cloneTheme(findTemplate('moonlit') || TEMPLATES[0]);
    const baseline = siteSkinBaseline(theme);
    expect(isSiteSkinActivated(theme, baseline)).toBe(false);
    expect(isSiteSkinActivated({ ...theme, colors: { ...theme.colors, accent: '#123456' } }, baseline)).toBe(true);
  });
});

test.describe('activation fires at most once per project', () => {
  test('a second claim on the same key is refused', () => {
    resetActivationSession();
    const store = new Map<string, string>();
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => { store.set(key, value); },
      },
    };
    try {
      expect(markActivatedOnce('project-a')).toBe(true);
      expect(markActivatedOnce('project-a')).toBe(false);
      expect(markActivatedOnce('project-b')).toBe(true);

      // A reload keeps the claim: the session cache is gone, storage is not.
      resetActivationSession();
      expect(markActivatedOnce('project-a')).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
      resetActivationSession();
    }
  });

  test('a refused localStorage still allows one event per session', () => {
    resetActivationSession();
    const originalWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: () => { throw new Error('denied'); },
        setItem: () => { throw new Error('denied'); },
      },
    };
    try {
      expect(markActivatedOnce('project-c')).toBe(true);
      expect(markActivatedOnce('project-c')).toBe(false);
    } finally {
      (globalThis as { window?: unknown }).window = originalWindow;
      resetActivationSession();
    }
  });
});
