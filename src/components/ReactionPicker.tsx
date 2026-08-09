import React, { useState } from 'react';

/**
 * The reaction picker, for the two platforms that have reactions.
 *
 * It replaces a 56px `<input placeholder="❤️">` that appeared in two places —
 * the compose tray and the per-message editor — and asked the author to know an
 * emoji by heart and type it. What it produced was also invisible until 8 Aug
 * 2026: the iOS branch emitted the span outside the bubble, so the only rule
 * that styles it (`#workskin dd.bubble .reaction`, a descendant selector)
 * matched nothing, and WhatsApp dropped the reaction entirely on any message
 * carrying an image. Both are fixed in generator.ts; this is the control that
 * makes the feature findable.
 *
 * **The sets are per platform, not shared.** This codebase does not have one
 * generic answer for a per-platform question — see the comment on PLATFORM_LOOK
 * in generator.ts, which exists for exactly this reason. An iMessage screenshot
 * with a 🙏 tapback is wrong in a way readers notice, and a WhatsApp one with
 * ‼️ is too.
 */
const SETS: Record<'ios' | 'android', string[]> = {
  // The six iMessage Tapbacks, in Apple's order.
  ios: ['❤️', '👍', '👎', '😂', '‼️', '❓'],
  // WhatsApp's six default reactions, in WhatsApp's order.
  android: ['👍', '❤️', '😂', '😮', '😢', '🙏'],
};

interface Props {
  /**
   * Narrowed deliberately rather than taking the four-template union: Twitter
   * and Google have no reaction rendering path at all — the shared builder
   * gates on `(template === 'ios' || template === 'android')` and both return
   * before reaching it anyway. Letting the compiler enforce that beats a
   * call-site guard someone can forget. If you find yourself writing
   * `as 'ios' | 'android'`, the picker is in the wrong place.
   */
  template: 'ios' | 'android';
  /** '' = no reaction. */
  value: string;
  onChange: (v: string) => void;
  /** Distinguishes many pickers on one screen — the timeline renders one per row. */
  idPrefix?: string;
}

export const ReactionPicker: React.FC<Props> = ({ template, value, onChange, idPrefix = '' }) => {
  const set = SETS[template];
  // Reopen the custom field for a project that already carries an off-set
  // emoji, or editing one would silently look like it had no reaction.
  const [showCustom, setShowCustom] = useState(() => Boolean(value) && !set.includes(value));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wide mr-0.5">React</span>
        {set.map(emoji => {
          const active = value === emoji;
          return (
            <button
              key={emoji}
              type="button"
              aria-pressed={active}
              aria-label={`React with ${emoji}`}
              title={active ? 'Tap again to remove' : `React with ${emoji}`}
              // Tapping the active chip clears it. There is no other way to
              // remove a reaction, and a delete button beside six chips is one
              // control too many in a tray that already competes with a fixed
              // export bar for vertical space.
              onClick={() => onChange(active ? '' : emoji)}
              className={`w-7 h-7 flex items-center justify-center rounded-full text-sm leading-none transition-all ${
                active
                  ? 'bg-violet-100 ring-2 ring-violet-500'
                  : 'bg-white border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {emoji}
            </button>
          );
        })}
        <button
          type="button"
          aria-expanded={showCustom}
          aria-label="Use a different emoji"
          title="Use a different emoji"
          onClick={() => setShowCustom(v => !v)}
          className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-colors ${
            showCustom
              ? 'bg-violet-100 text-violet-700'
              : 'bg-white border border-stone-200 text-stone-400 hover:bg-stone-100'
          }`}
        >
          +
        </button>
      </div>

      {showCustom && (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Any emoji"
          aria-label="Reaction emoji"
          id={idPrefix ? `${idPrefix}-reaction` : undefined}
          className="w-24 text-xs bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-violet-500"
        />
      )}
    </div>
  );
};

export default ReactionPicker;
