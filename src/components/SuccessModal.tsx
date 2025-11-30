import React, { useEffect, useState } from 'react';

interface Props {
  show: boolean;
  onClose: () => void;
  actionType: 'css' | 'html' | 'image';
}

export const SuccessModal: React.FC<Props> = ({ show, onClose, actionType }) => {
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  
  useEffect(() => {
    if (show) {
      // Show share prompt after 2 seconds
      const timer = setTimeout(() => setShowSharePrompt(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowSharePrompt(false);
    }
  }, [show]);

  if (!show) return null;

  const getActionMessage = () => {
    switch (actionType) {
      case 'css':
        return 'CSS copied to clipboard! 🎉';
      case 'html':
        return 'HTML copied to clipboard! 🎉';
      case 'image':
        return 'Image downloaded successfully! 🎉';
      default:
        return 'Success! 🎉';
    }
  };

  const estimatedTimeSaved = actionType === 'image' ? '2-3 hours' : '1-2 hours';

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-40 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Message */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-3">✨</div>
          <h3 className="text-xl font-heading font-bold text-text-dark mb-2">
            {getActionMessage()}
          </h3>
          <p className="text-text-gray text-xs">
            You just saved <strong className="text-primary">{estimatedTimeSaved}</strong> of manual CSS coding
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 my-4"></div>

        {/* Support Section */}
        <div className="bg-primary-bg rounded-material-lg p-5 mb-4 border border-primary-light">
          <div className="text-center mb-4">
            <p className="text-sm text-text-dark mb-3 font-heading">
              <strong>Made by a writer, for writers.</strong><br />
              This tool is 100% free. If it saved you time, consider buying me a coffee! ☕
            </p>
            <a 
              href="https://ko-fi.com/ao3skingen" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-material-sm font-heading font-semibold shadow-material-md hover:shadow-material-lg transition-all transform hover:scale-105"
            >
              <span className="text-xl">☕</span>
              Support on Ko-fi
            </a>
          </div>
          
          <div className="text-center text-xs text-text-gray border-t border-primary-light pt-3 mt-3">
            Tips help me keep this free & add more templates (Discord, Instagram coming soon!)
          </div>
        </div>

        {/* WordFokus Discovery Section */}
        <div className="bg-green-50 rounded-material-lg p-5 mb-4 border border-green-200">
          <div className="flex items-start gap-3">
            <div className="text-3xl">✍️</div>
            <div className="flex-1">
              <h4 className="font-heading font-bold text-text-dark mb-1 flex items-center gap-2">
                Writing your next fic?
                <span className="text-xs bg-secondary text-white px-2 py-0.5 rounded-full">FREE</span>
              </h4>
              <p className="text-xs text-text-dark mb-3">
                Try <strong>WordFokus</strong> — a clean, distraction-free writing tool I built for Google Docs. 
                Focus mode, live word count, and a UI designed to get out of your way so you can write.
              </p>
              <a 
                href="https://workspace.google.com/marketplace/app/wordfokus_free_ui_dark_mode_focus_writer/297087799172?flow_type=2"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-xs bg-secondary hover:bg-green-700 text-white px-4 py-2 rounded-material-sm font-heading font-semibold transition-all"
              >
                <span>🔗</span>
                Get WordFokus (Google Workspace)
              </a>
            </div>
          </div>
        </div>

        {/* Share Section (appears after 2s) */}
        {showSharePrompt && (
          <div className="bg-bg-light rounded-material-lg p-4 border border-border-light animate-fade-in">
            <p className="text-xs text-text-dark text-center mb-3 font-heading">
              <strong>Know other AO3 writers?</strong> Share this tool!
            </p>
            <div className="flex gap-2 justify-center">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Just discovered this free AO3 Skin Generator for social media AUs! No coding required 🎨✨')}&url=${encodeURIComponent('https://ao3-skin-generator.netlify.app')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-primary hover:bg-primary-dark text-white text-xs rounded-material-sm transition-all shadow-material-sm"
              >
                🐦 Tweet
              </a>
              <a
                href={`https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent('https://ao3-skin-generator.netlify.app')}&title=${encodeURIComponent('Free AO3 Skin Generator')}&caption=${encodeURIComponent('Create perfect social media AUs without coding!')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-material-sm transition-all shadow-material-sm"
              >
                📝 Tumblr
              </a>
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-3 bg-bg-light hover:bg-gray-200 text-text-dark rounded-material-sm font-heading font-semibold transition-all shadow-material-sm"
        >
          Close
        </button>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slide-up {
          from { 
            opacity: 0;
            transform: translateY(20px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
