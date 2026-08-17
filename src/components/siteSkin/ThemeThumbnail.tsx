import React from 'react';
import { SiteSkinTheme } from '../../lib/siteSkin/theme';
import { derive } from '../../lib/siteSkin/compile';

/**
 * A small illustration of a theme, not a preview.
 *
 * The honest, compiled-CSS rendering is one click away in the editor; twelve
 * live iframes on a gallery screen would be neither fast nor more truthful at
 * 200 pixels wide. What it does share with the compiler is `derive()` — so the
 * header foreground and card borders here are the same derived colours the
 * export uses, and a card can never advertise a legible header that the real
 * skin does not produce.
 *
 * Lifted out of `TemplateGallery` unchanged when the Magic Picker needed to show
 * its two extracted polarities. That reuse is the point rather than a
 * convenience: an extracted theme is illustrated by the same component as every
 * shipped template, so the picker cannot flatter its own output.
 */
export const ThemeThumbnail: React.FC<{ theme: SiteSkinTheme }> = ({ theme }) => {
  const d = derive(theme);
  return (
    <div
      className="h-32 overflow-hidden flex flex-col"
      style={{ backgroundColor: d.background }}
      aria-hidden="true"
    >
      <div
        className="flex items-center gap-1.5 px-2.5 h-8 flex-shrink-0 text-[10px] font-bold"
        style={{
          backgroundColor: d.accent,
          // The same layer the compiler emits, from the same derived string —
          // ten of the sixteen ship one, and a card showing a flat accent
          // where the editor shows a fade is the drift this thumbnail sharing
          // `derive()` exists to prevent.
          backgroundImage: d.headerGradient || undefined,
          color: d.headerFg,
          fontFamily: theme.typography.headingFont,
          borderBottom: `2px solid ${d.headerDeep}`,
        }}
      >
        <span>Archive</span>
        <span className="ml-auto flex gap-1">
          {[0, 1, 2].map(i => (
            <i
              key={i}
              className="block w-4 h-1 rounded-full"
              style={{ backgroundColor: d.headerFg, opacity: 0.6 }}
            />
          ))}
        </span>
      </div>
      <div className="p-2.5 flex-1">
        <div
          className="p-2 h-full"
          style={{
            backgroundColor: d.surface,
            border: `1px solid ${d.border}`,
            borderRadius: theme.shape.cardRadius,
          }}
        >
          <div
            className="text-[10px] font-semibold truncate"
            style={{ color: d.accent, fontFamily: theme.typography.headingFont }}
          >
            A Study in Lamplight
          </div>
          <div
            className="h-1 rounded mt-1.5"
            style={{ backgroundColor: theme.colors.text, opacity: 0.35, width: '90%' }}
          />
          <div
            className="h-1 rounded mt-1"
            style={{ backgroundColor: theme.colors.text, opacity: 0.35, width: '60%' }}
          />
          <div className="flex gap-1 mt-2">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="block h-3 w-8"
                style={{
                  backgroundColor: d.surface,
                  border: `1px solid ${d.tagBorder}`,
                  borderRadius:
                    theme.shape.tagStyle === 'pill'
                      ? '999px'
                      : theme.shape.tagStyle === 'label'
                      ? '3px'
                      : '0px',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThemeThumbnail;
