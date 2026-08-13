import { expect, test } from '@playwright/test';
import {
  appendChatMessage,
  automaticDeliveryStatus,
  nextChatTimestamp,
  nextChatTimestampFromHistory,
} from '../src/lib/messageMetadata';
import { Message } from '../src/lib/schema';

const message = (id: string, outgoing: boolean, timestamp?: string): Message => ({
  id,
  sender: outgoing ? 'You' : 'Sam',
  content: id,
  outgoing,
  timestamp,
});

test.describe('automatic chat metadata', () => {
  test('advances the latest valid timestamp and preserves its clock format', () => {
    expect(nextChatTimestampFromHistory([message('a', true, '11:59 PM')])).toBe('12:00 AM');
    expect(nextChatTimestampFromHistory([message('a', true, '23:59')])).toBe('00:00');
    expect(nextChatTimestampFromHistory([message('a', true, '9:07')])).toBe('9:08');
    expect(nextChatTimestampFromHistory([
      message('a', true, '2:40 PM'),
      message('b', false, 'Later that night'),
    ])).toBe('2:41 PM');
  });

  test('uses the current local time when the conversation has no usable time', () => {
    expect(nextChatTimestamp([], new Date(2026, 7, 13, 7, 5))).toBe('7:05 AM');
  });

  test('starts outgoing messages delivered and strips delivery state from incoming messages', () => {
    const outgoing = appendChatMessage([], message('out', true));
    expect(outgoing[0]).toMatchObject({ status: 'delivered', statusMode: 'auto' });

    const incomingWithBadState = {
      ...message('in', false),
      status: 'read' as const,
      statusMode: 'manual' as const,
    };
    const result = appendChatMessage([], incomingWithBadState);
    expect(result[0].status).toBeUndefined();
    expect(result[0].statusMode).toBeUndefined();
  });

  test('a reply reads the preceding automatic run without overriding manual choices', () => {
    const messages: Message[] = [
      { ...message('auto', true), status: 'delivered', statusMode: 'auto' },
      { ...message('manual', true), status: 'sent', statusMode: 'manual' },
    ];
    const result = appendChatMessage(messages, message('reply', false));

    expect(result[0].status).toBe('read');
    expect(result[1].status).toBe('sent');
    expect(result[2].status).toBeUndefined();
    expect(automaticDeliveryStatus(result, 0)).toBe('read');
    expect(automaticDeliveryStatus(result, 1)).toBe('read');
  });

  test('an earlier incoming message stops reply promotion at the conversation boundary', () => {
    const messages: Message[] = [
      { ...message('old', true), status: 'delivered', statusMode: 'auto' },
      message('boundary', false),
      { ...message('recent', true), status: 'delivered', statusMode: 'auto' },
    ];
    const result = appendChatMessage(messages, message('reply', false));

    expect(result[0].status).toBe('delivered');
    expect(result[2].status).toBe('read');
  });
});
