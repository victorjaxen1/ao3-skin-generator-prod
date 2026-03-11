/**
 * Pro Upgrade Modal
 * Displays upgrade prompt and handles license activation
 */

import React, { useState, useEffect } from 'react';
import { 
  getProStatus, 
  deactivatePro, 
  getProPrice,
  ProStatus 
} from '../lib/proFeatures';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (status: ProStatus) => void;
}

export const ProUpgradeModal: React.FC<Props> = ({ isOpen, onClose, onStatusChange }) => {
  const [proStatus, setProStatus] = useState<ProStatus>({ isPro: false });
  
  const price = getProPrice();

  useEffect(() => {
    if (isOpen) {
      setProStatus(getProStatus());
    }
  }, [isOpen]);

  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  const handleDeactivate = () => {
    deactivatePro();
    const newStatus = getProStatus();
    setProStatus(newStatus);
    onStatusChange?.(newStatus);
    setShowDeactivateConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-violet-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>✦</span>
              <span>AO3SkinGen Pro</span>
            </h2>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {proStatus.isPro ? (
            // Pro Active State
            <div className="text-center">
              <div className="text-4xl mb-3">🎉</div>
              <h3 className="text-lg font-bold text-stone-900 mb-1">You're a Pro!</h3>
              <p className="text-sm text-stone-500 mb-4">
                Thank you for supporting AO3SkinGen. All Pro features are unlocked.
              </p>

              <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-left">
                <div className="text-sm text-green-800">
                  <div className="font-semibold mb-1.5">Active features:</div>
                  <ul className="space-y-1">
                    <li>✓ Watermark-free exports</li>
                    <li>✓ High-resolution exports (up to 4×)</li>
                    <li>✓ Priority updates</li>
                  </ul>
                </div>
              </div>

              {proStatus.activatedAt && (
                <p className="text-xs text-stone-400 mb-4">
                  Activated: {new Date(proStatus.activatedAt).toLocaleDateString()}
                </p>
              )}

              {showDeactivateConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-sm text-red-800 mb-3">Deactivate Pro? You can reactivate anytime with your license key.</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleDeactivate}
                      className="bg-red-600 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-red-700 transition"
                    >
                      Yes, deactivate
                    </button>
                    <button
                      onClick={() => setShowDeactivateConfirm(false)}
                      className="bg-stone-200 text-stone-700 text-sm px-4 py-1.5 rounded-lg hover:bg-stone-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeactivateConfirm(true)}
                  className="text-xs text-stone-400 hover:text-red-600 underline transition-colors"
                >
                  Deactivate Pro
                </button>
              )}
            </div>
          ) : (
            // Upgrade Prompt
            <>
              <div className="text-center mb-5">
                <div className="text-4xl mb-3">🚀</div>
                <h3 className="text-lg font-bold text-stone-900 mb-1">Upgrade to Pro</h3>
                <p className="text-sm text-stone-500">
                  Support the project and unlock premium features.
                </p>
              </div>

              {/* Features */}
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-5">
                <h4 className="text-sm font-semibold text-violet-900 mb-2.5">Pro features:</h4>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2 text-violet-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Watermark-free</strong> image exports</span>
                  </li>
                  <li className="flex items-center gap-2 text-violet-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>High-resolution</strong> exports (2×, 4×)</span>
                  </li>
                  <li className="flex items-center gap-2 text-violet-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Priority support</strong> &amp; feature requests</span>
                  </li>
                  <li className="flex items-center gap-2 text-violet-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Lifetime access</strong> — one-time payment</span>
                  </li>
                </ul>
              </div>

              {/* Price */}
              <div className="text-center mb-5">
                <div className="text-3xl font-bold text-stone-900">
                  {price.formatted}
                  <span className="text-sm font-normal text-stone-400 ml-1">one-time</span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">No subscription. Yours forever.</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-center">
                <p className="text-sm text-amber-800 font-semibold">🚧 Pro purchases coming soon!</p>
                <p className="text-xs text-amber-700 mt-0.5">Support on Ko-fi to keep this tool free in the meantime.</p>
              </div>

              <a
                href="https://ko-fi.com/ao3skingen"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-violet-600 hover:bg-violet-700 text-white text-center py-3 rounded-xl font-semibold text-sm transition-all shadow-sm hover:shadow mb-3"
              >
                ☕ Support on Ko-fi
              </a>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-stone-50 px-6 py-3 border-t border-stone-100">
          <p className="text-xs text-stone-400 text-center">
            Questions? Contact us at support@ao3skingen.com
          </p>
        </div>
      </div>
    </div>
  );
};
