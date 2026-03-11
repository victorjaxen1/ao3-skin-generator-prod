import React, { useState } from 'react';
import { SkinProject } from '../lib/schema';
import { TEMPLATE_EXAMPLES } from '../lib/examples';

interface Props {
  show: boolean;
  onClose: () => void;
  onSelectTemplate: (template: 'ios' | 'android' | 'twitter' | 'google') => void;
  onLoadExample: (project: SkinProject) => void;
}

export const WelcomeModal: React.FC<Props> = ({ show, onClose, onSelectTemplate, onLoadExample }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!show) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      localStorage.setItem('ao3skin_welcome_seen', 'true');
    }
    onClose();
  };

  const handleTemplateSelect = (template: 'ios' | 'android' | 'twitter' | 'google') => {
    handleClose();
    onSelectTemplate(template);
  };

  const handleExampleSelect = (exampleId: string) => {
    const allExamples = Object.values(TEMPLATE_EXAMPLES).flat();
    const example = allExamples.find(ex => ex.id === exampleId);
    if (example) {
      handleClose();
      onLoadExample(example);
    }
  };

  const popularExamples = [
    { id: 'twitter-character-thread', title: '🐦 Twitter Thread', desc: 'Multi-tweet conversation' },
    { id: 'ios-imessage-conversation', title: '📱 iMessage Chat', desc: 'iOS conversation with bubbles' },
    { id: 'android-whatsapp-chat', title: '💚 WhatsApp Chat', desc: 'Android messaging' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slideUp">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">✨</span>
              <div>
                <h2 className="text-2xl font-bold">Welcome to AO3 Skin Generator!</h2>
                <p className="text-blue-100 text-sm mt-1">Create authentic social media scenes for your fanfiction</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white text-2xl transition-colors"
              aria-label="Close welcome modal"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Choose Template Section */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>🎨</span>
              Choose Your Template
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => handleTemplateSelect('ios')}
                className="group bg-white border-2 border-gray-200 hover:border-blue-500 rounded-xl p-4 transition-all hover:shadow-lg transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-2">📱</div>
                <div className="font-semibold text-sm text-gray-800 group-hover:text-blue-600">iOS</div>
                <div className="text-xs text-gray-500">iMessage</div>
              </button>

              <button
                onClick={() => handleTemplateSelect('android')}
                className="group bg-white border-2 border-gray-200 hover:border-green-500 rounded-xl p-4 transition-all hover:shadow-lg transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-2">💚</div>
                <div className="font-semibold text-sm text-gray-800 group-hover:text-green-600">Android</div>
                <div className="text-xs text-gray-500">WhatsApp</div>
              </button>

              <button
                onClick={() => handleTemplateSelect('twitter')}
                className="group bg-white border-2 border-gray-200 hover:border-sky-500 rounded-xl p-4 transition-all hover:shadow-lg transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-2">🐦</div>
                <div className="font-semibold text-sm text-gray-800 group-hover:text-sky-600">Twitter</div>
                <div className="text-xs text-gray-500">Tweets</div>
              </button>

              <button
                onClick={() => handleTemplateSelect('google')}
                className="group bg-white border-2 border-gray-200 hover:border-blue-600 rounded-xl p-4 transition-all hover:shadow-lg transform hover:-translate-y-1"
              >
                <div className="text-4xl mb-2">🔍</div>
                <div className="font-semibold text-sm text-gray-800 group-hover:text-blue-600">Google</div>
                <div className="text-xs text-gray-500">Search</div>
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-sm text-gray-500 font-medium">OR</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>

          {/* Load Example Section */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <span>💡</span>
              Start with an Example
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">Popular</span>
            </h3>
            <div className="space-y-2">
              {popularExamples.map((example) => (
                <button
                  key={example.id}
                  onClick={() => handleExampleSelect(example.id)}
                  className="w-full bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-3 text-left transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm text-gray-800 group-hover:text-blue-600">{example.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{example.desc}</div>
                    </div>
                    <span className="text-gray-400 group-hover:text-blue-500 transition-colors">→</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Features Highlight */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-sm text-gray-800 mb-2 flex items-center gap-2">
              <span>✨</span>
              What you'll get:
            </h4>
            <ul className="text-xs text-gray-700 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span><strong>Live Preview</strong> - See exactly what your readers will see</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span><strong>Auto-Save</strong> - Never lose your work</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span><strong>Mobile-Friendly</strong> - Works perfectly on phones</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">✓</span>
                <span><strong>AO3-Safe Code</strong> - No scripts, works perfectly on Archive</span>
              </li>
            </ul>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
              />
              <span>Don't show this again</span>
            </label>

            <button
              onClick={handleClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
            >
              Skip to blank editor
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
