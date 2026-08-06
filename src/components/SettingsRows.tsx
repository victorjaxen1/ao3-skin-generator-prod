import React, { useState } from 'react';

/**
 * The row primitives shared by every settings surface in the app.
 *
 * Extracted verbatim from SettingsSheet.tsx so the site-skin editor can use the
 * same controls rather than growing a parallel set that drifts. Nothing here
 * knows about SkinSettings or SiteSkinTheme — a row takes a value and a
 * setter, and that is the whole contract.
 *
 * ToggleRow is role="switch" with aria-checked, which is both the accessible
 * thing and what the Playwright specs select on. Keep it that way.
 */

export const ToggleRow: React.FC<{
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, sublabel, checked, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <span className="text-sm font-medium text-stone-900">{label}</span>
      {sublabel && <p className="text-xs text-stone-500 mt-0.5">{sublabel}</p>}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-violet-600' : 'bg-stone-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

export const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="pt-4 pb-1">
    <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">{label}</span>
  </div>
);

export const SelectRow: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between py-3">
    <span className="text-sm font-medium text-stone-900">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="text-sm text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-violet-500"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const TextRow: React.FC<{
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, onChange }) => (
  <div className="flex items-center justify-between py-3 gap-3">
    <span className="text-sm font-medium text-stone-900 shrink-0">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="text-sm text-stone-700 bg-stone-100 border-0 rounded-lg px-3 py-1.5 w-full max-w-[180px] text-right focus:ring-2 focus:ring-violet-500"
    />
  </div>
);

/**
 * Collapsed by default. Everything in here has a sensible default and most
 * people never need to open it — the point is that it stops competing for
 * attention with the settings that are the reason to use the tool.
 */
export const AdvancedSection: React.FC<{ children: React.ReactNode; label?: string }> = ({
  children,
  label = 'Advanced',
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3 text-left"
      >
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
          {label}
        </span>
        <span className={`text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>
      {open && <div className="divide-y divide-stone-100 pb-2">{children}</div>}
    </div>
  );
};
