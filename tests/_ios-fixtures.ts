import { defaultProject, Message, SkinProject } from '../src/lib/schema';

/**
 * The iOS scenes the characterization golden is taken from.
 *
 * Phase 0 of `docs/IOS-IMESSAGE-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md`:
 * record what the shipped renderer emits *before* extracting it, so the
 * extraction can be proven to move code rather than change output. Every
 * scenario §13 Phase 0 names is here — blue and green bubbles, status
 * bar/header/footer, typing, group identity, one image, one Tapback, delivery
 * status, and both tail treatments.
 *
 * Shared with the model and renderer suites so a scene is described once.
 */

function baseIOS(): SkinProject {
  const project = defaultProject();
  project.template = 'ios';
  project.messages = [];
  return project;
}

export function iosPlainScene(): SkinProject {
  const project = baseIOS();
  project.settings.iosContactName = 'Sam';
  project.messages = [
    { id: 'm1', sender: 'Sam', content: 'hey', outgoing: false, timestamp: '10:23' },
    { id: 'm2', sender: 'Sam', content: 'you free tonight?', outgoing: false, timestamp: '10:23' },
    { id: 'm3', sender: 'You', content: 'after eight, yes', outgoing: true, timestamp: '10:24', status: 'read' },
  ];
  return project;
}

export function iosGreenScene(): SkinProject {
  const project = iosPlainScene();
  project.settings.iosMode = 'sms';
  return project;
}

export function iosChromeScene(): SkinProject {
  const project = iosPlainScene();
  project.settings.iosShowStatusBar = true;
  project.settings.iosShowInputBar = true;
  project.settings.iosFooterImageUrl = '';
  project.settings.chatShowTyping = true;
  project.settings.chatTypingName = 'Sam';
  return project;
}

export function iosExtrasScene(): SkinProject {
  const project = baseIOS();
  project.settings.iosContactName = 'Sam';
  project.messages = [
    { id: 'e1', sender: 'Sam', content: 'look at this', outgoing: false, timestamp: '11:00', attachments: [{ type: 'image', url: 'https://example.com/one.png', alt: 'A blue door' }] },
    { id: 'e2', sender: 'You', content: 'nice', outgoing: true, timestamp: '11:01', reaction: '❤️' },
    { id: 'e3', sender: 'Sam', content: '', outgoing: false, isTyping: true },
    { id: 'e4', sender: 'You', content: 'still there?', outgoing: true, timestamp: '11:20', showTimeBreak: true, timeBreakText: 'Twenty minutes later', status: 'delivered' },
  ];
  return project;
}

export function iosGroupScene(): SkinProject {
  const project = baseIOS();
  project.settings.iosGroupMode = true;
  project.settings.iosGroupName = 'Road Trip';
  project.settings.iosGroupParticipants = [
    { id: 'alex', name: 'Alex', color: '#b3261e', iosTone: 'red' },
    { id: 'bea', name: 'Bea', color: '#1769aa', iosTone: 'indigo' },
  ];
  project.messages = [
    { id: 'g1', sender: 'Alex', participantId: 'alex', content: 'leaving now', outgoing: false, timestamp: '08:00' },
    { id: 'g2', sender: 'Bea', participantId: 'bea', content: 'same', outgoing: false, timestamp: '08:01' },
    { id: 'g3', sender: 'You', content: 'see you at the services', outgoing: true, timestamp: '08:02', status: 'read' },
  ];
  return project;
}

export function iosDarkScene(): SkinProject {
  const project = iosPlainScene();
  project.settings.iosDarkMode = true;
  return project;
}

export const IOS_CHARACTERIZATION_SCENES: ReadonlyArray<{ name: string; project: () => SkinProject }> = [
  { name: 'plain-light', project: iosPlainScene },
  { name: 'plain-dark', project: iosDarkScene },
  { name: 'sms-green', project: iosGreenScene },
  { name: 'chrome-and-typing', project: iosChromeScene },
  { name: 'image-reaction-typing-timebreak', project: iosExtrasScene },
  { name: 'group', project: iosGroupScene },
];

export type IOSMessageSeed = Message;
