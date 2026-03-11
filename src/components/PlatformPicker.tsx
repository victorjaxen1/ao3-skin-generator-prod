import React from 'react';
import { SkinProject } from '../lib/schema';
import { TEMPLATE_EXAMPLES } from '../lib/examples';

interface Props {
  onSelectPlatform: (template: 'ios' | 'android' | 'twitter' | 'google') => void;
  onLoadExample: (project: SkinProject) => void;
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

const EXAMPLE_LABELS: Record<string, string> = {
  'twitter-character-thread': 'Character Thread',
  'twitter-verified-account': 'Verified Account',
  'twitter-media-image': 'Media Tweet',
  'ios-two-person-chat': 'Two-Person Chat',
  'ios-contact-avatar': 'Contact with Avatar',
  'ios-typing-indicators': 'Typing Indicators',
  'whatsapp-chat': 'WhatsApp Chat',
  'whatsapp-profile-picture': 'Profile Picture',
  'whatsapp-timestamps-receipts': 'Timestamps & Receipts',
  'whatsapp-group-chat': 'Group Chat',
  'google-search-history': 'Search History',
  'google-research-montage': 'Research Montage',
  'google-news-articles': 'News Articles',
};

export const PlatformPicker: React.FC<Props> = ({ onSelectPlatform, onLoadExample }) => {
  const allExamples = Object.entries(TEMPLATE_EXAMPLES).flatMap(([, examples]) => examples);

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo & Title */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600 mb-4 shadow-lg">
          <span className="text-2xl">✦</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-stone-900 tracking-tight">
          AO3 SkinGen
        </h1>
        <p className="text-stone-500 mt-2 text-sm sm:text-base max-w-xs mx-auto leading-relaxed">
          Fake screenshots for your fanfics
        </p>
      </div>

      {/* Platform Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 w-full max-w-lg">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.id}
            onClick={() => onSelectPlatform(platform.id)}
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

      {/* Quick Start Templates */}
      {allExamples.length > 0 && (
        <div className="mt-10 w-full max-w-lg">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-3 text-center">
            Or start from a template
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {allExamples.map((example) => (
              <button
                key={example.id}
                onClick={() => onLoadExample(example)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-full hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition-all"
              >
                {EXAMPLE_LABELS[example.id] || example.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center space-y-1">
        <p className="text-xs text-stone-400">Free &amp; open source · No account needed</p>
        <p className="text-xs text-stone-300">
          <a href="/privacy-policy.html" className="hover:text-stone-500 transition-colors">Privacy</a>
          {' · '}
          <a href="/terms-of-service.html" className="hover:text-stone-500 transition-colors">Terms</a>
        </p>
      </div>
    </div>
  );
};

export default PlatformPicker;
