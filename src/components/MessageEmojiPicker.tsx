import React from 'react';

export const MESSAGE_EMOJIS = ['😂', '❤️', '😭', '👍', '🔥', '👀', '✨', '🥺', '🎉'] as const;

interface PickerProps {
  id: string;
  onInsert: (emoji: string) => void;
  className?: string;
}

export const MessageEmojiPicker: React.FC<PickerProps> = ({ id, onInsert, className = '' }) => (
  <div id={id} role="group" aria-label="Message emoji picker" className={`grid grid-cols-9 gap-1 ${className}`}>
    {MESSAGE_EMOJIS.map(emoji => (
      <button
        key={emoji}
        type="button"
        onClick={() => onInsert(emoji)}
        aria-label={`Insert ${emoji}`}
        title={`Insert ${emoji}`}
        className="flex aspect-square min-w-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-base leading-none transition-colors hover:border-violet-300 hover:bg-violet-50 focus:ring-2 focus:ring-violet-500"
      >
        {emoji}
      </button>
    ))}
  </div>
);

interface TriggerProps {
  expanded: boolean;
  controlsId: string;
  onToggle: () => void;
}

export const MessageEmojiTrigger: React.FC<TriggerProps> = ({ expanded, controlsId, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label="Add emoji to message"
    title="Add emoji"
    aria-expanded={expanded}
    aria-controls={controlsId}
    className={`absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full text-base leading-none transition-colors ${
      expanded
        ? 'bg-violet-100 text-violet-700'
        : 'text-stone-400 hover:bg-stone-200 hover:text-stone-700'
    }`}
  >
    <span aria-hidden="true">😊</span>
  </button>
);

export default MessageEmojiPicker;
