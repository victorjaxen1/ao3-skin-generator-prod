import React, { useEffect, useState } from 'react';
import { recordDonationClick, recordDismissForever } from '../lib/donationPrompt';

interface Props {
  show: boolean;
  onClose: () => void;
  actionType: 'image' | 'ao3code';
}

export const SuccessModal: React.FC<Props> = ({ show, onClose, actionType }) => {
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => setShowSharePrompt(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowSharePrompt(false);
    }
  }, [show]);

  const handleDonationClick = () => {
    recordDonationClick();
  };

  const handleDismissForever = () => {
    recordDismissForever();
    onClose();
  };

  if (!show) return null;

  const actionMessage =
    actionType === 'image' ? 'Image saved!' :
    actionType === 'ao3code' ? 'Code copied!' :
    'Done!';

  const estimatedTimeSaved = actionType === 'image' ? '2–3 hours' : '1–2 hours';

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="text-4xl mb-3">✨</div>
          <h3 className="text-lg font-bold text-stone-900">{actionMessage}</h3>
          <p className="text-xs text-stone-500 mt-1">
            You just saved <strong className="text-violet-600">{estimatedTimeSaved}</strong> of manual CSS coding
          </p>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {/* Ko-fi */}
          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 text-center">
            <p className="text-sm text-stone-700 mb-3 leading-relaxed">
              <strong>Made by a writer, for writers.</strong><br />
              100% free — if it saved you time, a coffee keeps the lights on! ☕
            </p>
            <a
              href="https://ko-fi.com/ao3skingen"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDonationClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow"
            >
              <span>☕</span>
              Support on Ko-fi
            </a>
            <p className="text-[11px] text-stone-400 mt-2.5">
              Tips help me add Discord, Instagram &amp; more
            </p>
          </div>

          {/* WordFokus */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✍️</span>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  Writing your next fic?
                  <span className="text-[10px] bg-green-600 text-white px-1.5 py-0.5 rounded-full font-semibold">FREE</span>
                </h4>
                <p className="text-xs text-stone-600 mt-1 mb-2.5 leading-relaxed">
                  <strong>WordFokus</strong> — distraction-free writing for Google Docs. Focus mode, live word count, stays out of your way.
                </p>
                <a
                  href="https://workspace.google.com/marketplace/app/wordfokus_free_ui_dark_mode_focus_writer/297087799172?flow_type=2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold transition-all"
                >
                  Get WordFokus
                </a>
              </div>
            </div>
          </div>

          {/* Share (appears after 2s) */}
          {showSharePrompt && (
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-center animate-fade-in">
              <p className="text-xs font-semibold text-stone-700 mb-2.5">Know other AO3 writers? Share this!</p>
              <div className="flex gap-2 justify-center">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent('Just discovered this free AO3 Skin Generator for social media AUs! No coding required 🎨✨')}&url=${encodeURIComponent('https://ao3-skin-generator.netlify.app')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-stone-800 hover:bg-stone-900 text-white text-xs rounded-lg font-semibold transition-all"
                >
                  Post on X
                </a>
                <a
                  href={`https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent('https://ao3-skin-generator.netlify.app')}&title=${encodeURIComponent('Free AO3 Skin Generator')}&caption=${encodeURIComponent('Create perfect social media AUs without coding!')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs rounded-lg font-semibold transition-all"
                >
                  Share on Tumblr
                </a>
              </div>
            </div>
          )}

          {/* Close row */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold rounded-xl transition-all"
            >
              Close
            </button>
            <button
              onClick={handleDismissForever}
              className="px-4 py-2.5 text-stone-400 hover:text-stone-600 text-xs transition-colors whitespace-nowrap"
              title="Don't show this prompt again"
            >
              Don't show again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
