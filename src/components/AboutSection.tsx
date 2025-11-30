import React, { useState } from 'react';

export const AboutSection: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="max-w-4xl mx-auto mb-4 sm:mb-8">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-white border border-border-light rounded-material-lg shadow-material-sm hover:shadow-material-md transition-all p-3 sm:p-4 flex items-center justify-between group"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">💡</span>
          <span className="font-heading font-semibold text-sm sm:text-base text-text-dark">About This Tool</span>
        </div>
        <span className={`text-gray-400 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {isExpanded && (
        <div className="bg-white border border-t-0 border-border-light rounded-b-material-lg shadow-material-sm p-6 space-y-6 animate-expand">
          {/* Origin Story */}
          <div>
            <h3 className="font-heading font-bold text-text-dark mb-2 flex items-center gap-2">
              <span>📖</span>
              Why I Built This
            </h3>
            <p className="text-sm text-text-dark leading-relaxed">
              As a fanfiction writer and developer, I was frustrated by how difficult it was to create 
              authentic-looking social media scenes for AO3. Every tutorial required hours of CSS knowledge, 
              and most skins broke on mobile. I believe in building tools that <strong>just work</strong> — 
              clean, focused, and built for real writers. No coding, no hassle, just pure storytelling.
            </p>
          </div>

          {/* Features Highlight */}
          <div className="bg-primary-bg rounded-material-md p-4 border border-primary-light">
            <h4 className="font-heading font-bold text-text-dark mb-3 text-sm">✨ What Makes This Different:</h4>
            <ul className="text-xs text-text-dark space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Mobile-First:</strong> Tested on phones where most AO3 readers are</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>No Media Queries:</strong> Uses AO3-safe CSS that won't get stripped</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Live Preview:</strong> See exactly what your readers will see</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>Auto-Save:</strong> Never lose your work again</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-bold">✓</span>
                <span><strong>100% Free:</strong> No paywalls, no ads, just tools for writers</span>
              </li>
            </ul>
          </div>

          {/* WordFokus Section */}
          <div className="bg-green-50 rounded-material-lg p-5 border border-green-200">
            <div className="flex items-start gap-3">
              <div className="text-3xl">✍️</div>
              <div className="flex-1">
                <h4 className="font-heading font-bold text-text-dark mb-2 flex items-center gap-2">
                  My Other Tool for Writers
                  <span className="text-xs bg-secondary text-white px-2 py-0.5 rounded-full">FREE</span>
                </h4>
                <p className="text-sm text-text-dark mb-3 leading-relaxed">
                  After building this, I realized writers needed better writing environments too. 
                  That's why I created <strong>WordFokus</strong> — a Google Docs add-on built on the same philosophy:
                </p>
                <ul className="text-xs text-text-dark space-y-1.5 mb-4 ml-4">
                  <li>• <strong>Focus Mode</strong> to hide distractions (no more procrastinating!)</li>
                  <li>• <strong>Live Word Count</strong> in the sidebar for tracking progress</li>
                  <li>• <strong>Clean, Distraction-Free UI</strong> that gets out of your way</li>
                  <li>• <strong>One-Click Tools</strong> optimized for serious long-form writing</li>
                </ul>
                <p className="text-xs text-text-gray mb-3 italic">
                  The same "just works" approach — perfect for drafting your next 50k slowburn before bringing it to AO3 ✨
                </p>
                <a 
                  href="https://workspace.google.com/marketplace/app/wordfokus_free_ui_dark_mode_focus_writer/297087799172?flow_type=2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm bg-secondary hover:bg-green-700 text-white px-5 py-2.5 rounded-material-sm font-heading font-semibold shadow-material-md hover:shadow-material-lg transition-all transform hover:scale-105"
                >
                  <span>📥</span>
                  Install WordFokus (Google Workspace)
                </a>
              </div>
            </div>
          </div>

          {/* Support Section */}
          <div className="bg-primary-bg rounded-material-lg p-5 border border-primary-light">
            <h4 className="font-heading font-bold text-text-dark mb-2 flex items-center gap-2">
              <span>☕</span>
              Support Development
            </h4>
            <p className="text-sm text-text-dark mb-3 leading-relaxed">
              This tool is <strong>completely free</strong> and will always stay that way. No ads, no premium tiers, 
              no BS. If it saved you hours of frustration and you want to support future updates 
              (Discord, Instagram, and Email templates are next!), consider buying me a coffee.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://ko-fi.com/ao3skingen" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-material-sm font-heading font-semibold shadow-material-md hover:shadow-material-lg transition-all transform hover:scale-105"
              >
                <span className="text-lg">☕</span>
                Buy Me a Coffee
              </a>
              <span className="text-xs text-text-gray">
                Every tip helps keep the servers running!
              </span>
            </div>
          </div>

          {/* Community */}
          <div className="text-center text-xs text-gray-600 border-t border-gray-200 pt-4">
            <p className="mb-2">
              Have feedback? Want a specific template? Found a bug?
            </p>
            <p>
              <a 
                href="https://github.com/victorjaxen1/ao3-skin-generator-prod/issues" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Open an issue on GitHub
              </a>
              {' or share on '}
              <a 
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Hey @victorjaxen1, I have feedback about the AO3 Skin Generator:')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 font-semibold underline"
              >
                Twitter
              </a>
            </p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes expand {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 2000px;
          }
        }
        .animate-expand {
          animation: expand 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
