import { Message } from './schema';

const TWELVE_HOUR_TIME = /^(\d{1,2}):(\d{2})\s*([ap]m)$/i;
const TWENTY_FOUR_HOUR_TIME = /^(\d{1,2}):(\d{2})$/;

function incrementClock(value: string): string | undefined {
  const twelveHour = value.match(TWELVE_HOUR_TIME);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    if (hour < 1 || hour > 12 || minute > 59) return undefined;

    const isPm = twelveHour[3].toLowerCase() === 'pm';
    const total = ((hour % 12) + (isPm ? 12 : 0)) * 60 + minute + 1;
    const nextHour24 = Math.floor((total % 1440) / 60);
    const nextMinute = total % 60;
    const nextHour12 = nextHour24 % 12 || 12;
    return `${nextHour12}:${String(nextMinute).padStart(2, '0')} ${nextHour24 >= 12 ? 'PM' : 'AM'}`;
  }

  const twentyFourHour = value.match(TWENTY_FOUR_HOUR_TIME);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);
    if (hour > 23 || minute > 59) return undefined;

    const total = (hour * 60 + minute + 1) % 1440;
    const nextHour = Math.floor(total / 60);
    const hourText = twentyFourHour[1].length === 2
      ? String(nextHour).padStart(2, '0')
      : String(nextHour);
    return `${hourText}:${String(total % 60).padStart(2, '0')}`;
  }

  return undefined;
}

function currentTwelveHourTime(now: Date): string {
  const hour24 = now.getHours();
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(now.getMinutes()).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
}

/** Derive a next story time from history without consulting the current clock. */
export function nextChatTimestampFromHistory(messages: Message[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const previous = messages[index].timestamp?.trim();
    if (!previous) continue;
    const incremented = incrementClock(previous);
    if (incremented) return incremented;
  }
  return undefined;
}

/** Suggest the next story time, preserving history or falling back to the user's clock. */
export function nextChatTimestamp(messages: Message[], now = new Date()): string {
  return nextChatTimestampFromHistory(messages) || currentTwelveHourTime(now);
}

/** Auto status for an outgoing message at this point in a conversation. */
export function automaticDeliveryStatus(messages: Message[], index: number): 'delivered' | 'read' {
  return messages.slice(index + 1).some(message => !message.outgoing) ? 'read' : 'delivered';
}

/**
 * Add a chat message and advance only automatically managed delivery states.
 * A reply proves the contiguous outgoing run before it has been read; manual
 * status choices remain untouched.
 */
export function appendChatMessage(messages: Message[], message: Message): Message[] {
  const nextMessage: Message = message.outgoing
    ? {
        ...message,
        status: message.status || 'delivered',
        statusMode: message.statusMode || 'auto',
      }
    : {
        ...message,
        status: undefined,
        statusMode: undefined,
      };

  if (message.outgoing) return [...messages, nextMessage];

  const updated = [...messages];
  for (let index = updated.length - 1; index >= 0; index -= 1) {
    const previous = updated[index];
    if (!previous.outgoing) break;
    if (previous.statusMode === 'auto') updated[index] = { ...previous, status: 'read' };
  }
  return [...updated, nextMessage];
}
