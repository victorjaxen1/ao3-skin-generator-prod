import React, { useState } from 'react';
import Link from 'next/link';
import { SkinProject } from '../lib/schema';
import { TEMPLATE_EXAMPLES } from '../lib/examples';
import { openPrivacyChoices } from '../lib/analytics';
import { MoreTools } from './MoreTools';
import { ModalDialog } from './ModalDialog';

interface Props {
  onSelectPlatform: (template: 'ios' | 'android' | 'twitter' | 'google') => void;
  onLoadExample: (project: SkinProject) => void;
  /** Show the return action independently from whether replacement needs confirmation. */
  canReturnToProject?: boolean;
  /** True when the current full project state is recoverable user work. */
  protectCurrentProject?: boolean;
  /** Return to the workspace without changing anything. */
  onCancel?: () => void;
}

const PLATFORMS = [
  {
    id: 'ios' as const,
    name: 'iMessage',
    description: 'iPhone texts',
    emoji: '💬',
    color: 'bg-blue-50 border-blue-200 hover:border-blue-400',
    iconColor: 'text-blue-500',
  },
  {
    id: 'android' as const,
    name: 'WhatsApp',
    description: 'WhatsApp chat',
    emoji: '📱',
    color: 'bg-green-50 border-green-200 hover:border-green-400',
    iconColor: 'text-green-500',
  },
  {
    id: 'twitter' as const,
    name: 'X / Twitter',
    description: 'Tweet or thread',
    emoji: '𝕏',
    color: 'bg-stone-100 border-stone-200 hover:border-stone-400',
    iconColor: 'text-stone-800',
  },
  {
    id: 'google' as const,
    name: 'Google',
    description: 'Search results',
    emoji: '🔍',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    iconColor: 'text-amber-500',
  },
] as const;

/**
 * The button text for every starter example.
 *
 * A missing entry falls back to the raw id, which is why five of the newest and
 * richest examples were offering visitors a button labelled
 * `ios-rich-group-scene`. The fallback is kept because rendering *something* is
 * better than rendering nothing, but it is a last resort and not a plan:
 * `examples-catalog.unit.spec.ts` fails when an example has no label here, in
 * the same test that checks it has an analytics id.
 *
 * **Adding an example means adding it in three places** — `examples.ts`, this
 * map, and `TEMPLATE_IDS` in `analytics.ts` — and the test covers the last two.
 */
const EXAMPLE_LABELS: Record<string, string> = {
  'twitter-character-thread': 'Character Thread',
  'twitter-verified-account': 'Verified Account',
  'twitter-media-image': 'Media Tweet',
  'twitter-quote-post': 'Quote Post',
  'twitter-four-image-post': 'Four-Image Grid',
  'twitter-video-post': 'Video Poster',
  'twitter-long-thread': 'Long Thread',
  'ios-two-person-chat': 'Two-Person Chat',
  'ios-contact-avatar': 'Contact with Avatar',
  'ios-typing-indicators': 'Typing Indicators',
  'ios-rich-group-scene': 'Rich Group Scene',
  'whatsapp-chat': 'WhatsApp Chat',
  'whatsapp-profile-picture': 'Profile Picture',
  'whatsapp-timestamps-receipts': 'Timestamps & Receipts',
  'whatsapp-group-chat': 'Group Chat',
  'google-search-history': 'Search History',
  'google-research-montage': 'Research Montage',
  'google-news-articles': 'News Articles',
};

/** Display name for the platform a template belongs to. */
const PLATFORM_NAME: Record<string, string> = {
  ios: 'iMessage',
  android: 'WhatsApp',
  twitter: 'X / Twitter',
  google: 'Google',
};

type PlatformTemplate = SkinProject['template'];
type PendingProjectChoice =
  | { kind: 'platform'; template: PlatformTemplate; label: string }
  | { kind: 'example'; project: SkinProject; label: string };

const BLANK_LABELS: Record<PlatformTemplate, string> = {
  ios: 'a blank iMessage conversation',
  android: 'a blank WhatsApp chat',
  twitter: 'a blank X / Twitter thread',
  google: 'a blank Google search',
};

export const PlatformPicker: React.FC<Props> = ({
  onSelectPlatform,
  onLoadExample,
  canReturnToProject = false,
  protectCurrentProject = false,
  onCancel,
}) => {
  const [pendingChoice, setPendingChoice] = useState<PendingProjectChoice | null>(null);

  const applyChoice = (choice: PendingProjectChoice) => {
    setPendingChoice(null);
    if (choice.kind === 'platform') onSelectPlatform(choice.template);
    else onLoadExample(choice.project);
  };

  const requestChoice = (choice: PendingProjectChoice) => {
    if (protectCurrentProject) setPendingChoice(choice);
    else applyChoice(choice);
  };

  const handlePlatform = (id: PlatformTemplate) => {
    requestChoice({ kind: 'platform', template: id, label: BLANK_LABELS[id] });
  };

  const handleExample = (example: SkinProject) => {
    const exampleLabel = EXAMPLE_LABELS[example.id] || example.id;
    requestChoice({ kind: 'example', project: example, label: `the ${exampleLabel} example` });
  };

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Every choice below replaces the current project, so when there is work
          to lose give an explicit way back to it. */}
      {canReturnToProject && onCancel && (
        <button
          onClick={onCancel}
          className="mb-6 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-full hover:bg-violet-100 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Keep editing my project
        </button>
      )}

      {/* Logo & Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 mb-4 shadow-lg">
          <span className="text-2xl">✦</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
          AO3 SkinGen
        </h1>
        <p className="text-stone-500 mt-2 text-sm sm:text-base max-w-xs mx-auto leading-relaxed">
          Social-media scenes for AO3 — export as an image or accessible real text.
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-lg">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            onClick={() => handlePlatform(platform.id)}
            aria-label={`Start a blank ${platform.name} conversation`}
            className={`group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] ${platform.color}`}
          >
            <span className={`text-3xl sm:text-4xl mb-3 ${platform.iconColor}`}>
              {platform.emoji}
            </span>
            <span className="text-sm sm:text-base font-semibold text-stone-900">
              {platform.name}
            </span>
            <span className="text-xs text-stone-500 mt-1 text-center leading-snug">
              {platform.description}
            </span>
          </button>
        ))}
      </div>

      {/* A second product, not a fifth platform. It emits CSS you paste into
          AO3's preferences rather than an image you paste into a chapter, so
          it sits apart from the four conversation cards rather than among
          them — picking it by mistake would be a confusing detour. */}
      <div className="mt-4 w-full max-w-lg">
        <Link
          href="/site-skin"
          className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-violet-200 bg-violet-50 hover:border-violet-400 hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <span className="text-3xl flex-shrink-0">🎨</span>
          <span className="min-w-0">
            <span className="block text-sm sm:text-base font-semibold text-stone-900">
              Site skin
            </span>
            <span className="block text-xs text-stone-500 mt-0.5 leading-snug">
              Restyle AO3 itself — colours, fonts and cards, for your own browsing
            </span>
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ml-auto flex-shrink-0 text-violet-400 group-hover:text-violet-600 transition-colors"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      </div>

      {/* Quick Start Templates — grouped, so a chip's platform is never a surprise */}
      {Object.keys(TEMPLATE_EXAMPLES).length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-4 text-center">
            Or start from a template
          </p>
          <div className="space-y-3">
            {Object.entries(TEMPLATE_EXAMPLES).map(([platform, examples]) =>
              examples.length === 0 ? null : (
                <div key={platform}>
                  <p className="text-[11px] font-semibold text-stone-400 mb-1.5 text-center">
                    {PLATFORM_NAME[platform] || platform}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {examples.map((example) => (
                      <button
                        key={example.id}
                        onClick={() => handleExample(example)}
                        aria-label={`${EXAMPLE_LABELS[example.id] || example.id} — ${PLATFORM_NAME[platform] || platform} template`}
                        className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-full hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-all"
                      >
                        {EXAMPLE_LABELS[example.id] || example.id}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>

          {/* The gallery's only entry point from inside the application.
              Until now it was reachable from three page footers and from
              nowhere in the tool. This is the screen where someone is already
              choosing an example, and it is a full-page entry screen with no
              composer to occlude — the same reasoning that put MoreTools below.
              A quiet link, deliberately not a card. */}
          <p className="mt-5 text-center">
            <a
              href="https://ao3skingen.wordfokus.com/examples-gallery"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-stone-500 underline underline-offset-2 hover:text-violet-700"
            >
              Browse every example with screenshots →
            </a>
          </p>
        </div>
      )}

      {/* Section 11.6 Tier 2. Placed above the legal footer and below every
          tool choice, so it is findable and never in the way. */}
      <MoreTools placement="platform_picker" />

      {/* Footer */}
      <div className="mt-12 text-center space-y-1">
        <p className="text-xs text-stone-400">No account required. Editable text and settings stay in this browser.</p>
        <p className="text-xs text-stone-400">Hosted image features upload only when you choose them.</p>
        <p className="text-xs text-stone-300">
          <button type="button" onClick={openPrivacyChoices} className="hover:text-stone-500 transition-colors">Privacy choices</button>
          {' · '}
          <a href="/privacy-policy.html" className="hover:text-stone-500 transition-colors">Privacy policy</a>
          {' · '}
          <a href="/terms-of-service.html" className="hover:text-stone-500 transition-colors">Terms</a>
        </p>
      </div>

      <ModalDialog
        isOpen={pendingChoice !== null}
        onClose={() => setPendingChoice(null)}
        labelledBy="replace-project-title"
        maxWidthClass="max-w-md"
      >
        <div className="p-5">
          <h2 id="replace-project-title" className="text-lg font-semibold text-stone-900">Replace your current project?</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Starting {pendingChoice?.label} replaces the one project stored in this browser. Choose Keep editing current project if you want to download a backup first.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => pendingChoice && applyChoice(pendingChoice)}
              className="rounded-xl bg-red-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-800"
            >
              Replace with {pendingChoice?.label}
            </button>
            <button
              type="button"
              data-autofocus
              onClick={() => setPendingChoice(null)}
              className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            >
              Keep editing current project
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};

export default PlatformPicker;
