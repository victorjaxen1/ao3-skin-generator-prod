export type EmojiMessageSize = 'emoji1' | 'emoji2';

// A complete visible emoji token: keycaps, flags, ordinary pictographs with an
// optional skin tone, and joined sequences such as families/professions. The
// tag suffix covers subdivision flags without accepting tag characters alone.
const EMOJI_TOKEN_SOURCE = String.raw`(?:[#*0-9]\uFE0F?\u20E3|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\p{Emoji_Modifier})?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)`;
const EMOJI_TOKEN = new RegExp(EMOJI_TOKEN_SOURCE, 'gu');

/**
 * Return the native-chat presentation for a message containing only emoji.
 * One emoji is largest; two-to-four use the smaller multi-emoji treatment.
 * Five or more, attachments, ordinary text, and emoji mixed with text retain
 * the normal bubble.
 */
export function emojiMessageSize(content: string, hasAttachment = false): EmojiMessageSize | undefined {
  if (hasAttachment) return undefined;
  const compact = content.replace(/\s/gu, '');
  if (!compact) return undefined;

  const tokens = compact.match(EMOJI_TOKEN);
  if (!tokens || tokens.join('') !== compact) return undefined;
  if (tokens.length === 1) return 'emoji1';
  if (tokens.length <= 4) return 'emoji2';
  return undefined;
}
