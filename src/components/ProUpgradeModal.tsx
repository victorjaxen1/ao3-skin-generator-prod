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
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span>✨</span>
              <span>AO3SkinGen Pro</span>
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-purple-200 text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {proStatus.isPro ? (
            // Pro Active State
            <div className="text-center">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You're a Pro!</h3>
              <p className="text-gray-600 mb-4">
                Thank you for supporting AO3SkinGen. You have access to all Pro features.
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="text-sm text-green-800">
                  <div className="font-medium mb-1">Active Features:</div>
                  <ul className="text-left space-y-1">
                    <li>✓ Watermark-free exports</li>
                    <li>✓ High-resolution exports (up to 4x)</li>
                    <li>✓ Priority updates</li>
                  </ul>
                </div>
              </div>

              {proStatus.activatedAt && (
                <p className="text-xs text-gray-500 mb-4">
                  Activated: {new Date(proStatus.activatedAt).toLocaleDateString()}
                </p>
              )}

              {showDeactivateConfirm ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 mb-3">Are you sure you want to deactivate Pro? You can reactivate anytime with your license key.</p>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={handleDeactivate}
                      className="bg-red-600 text-white text-sm px-4 py-1.5 rounded hover:bg-red-700 transition"
                    >
                      Yes, Deactivate
                    </button>
                    <button
                      onClick={() => setShowDeactivateConfirm(false)}
                      className="bg-gray-200 text-gray-700 text-sm px-4 py-1.5 rounded hover:bg-gray-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeactivateConfirm(true)}
                  className="text-sm text-gray-500 hover:text-red-600 underline"
                >
                  Deactivate Pro
                </button>
              )}
            </div>
          ) : (
            // Upgrade Prompt
            <>
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">🚀</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Upgrade to Pro</h3>
                <p className="text-gray-600">
                  Support the project and unlock premium features!
                </p>
              </div>

              {/* Features List */}
              <div className="bg-purple-50 rounded-xl p-4 mb-6">
                <h4 className="font-semibold text-purple-900 mb-3">Pro Features:</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2 text-purple-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Watermark-free</strong> image exports</span>
                  </li>
                  <li className="flex items-center gap-2 text-purple-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>High-resolution</strong> exports (2x, 4x scale)</span>
                  </li>
                  <li className="flex items-center gap-2 text-purple-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Priority support</strong> & feature requests</span>
                  </li>
                  <li className="flex items-center gap-2 text-purple-800">
                    <span className="text-green-600">✓</span>
                    <span><strong>Lifetime access</strong> - one-time payment</span>
                  </li>
                </ul>
              </div>

              {/* Price & Purchase */}
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {price.formatted}
                  <span className="text-sm font-normal text-gray-500 ml-1">one-time</span>
                </div>
                <p className="text-xs text-gray-500">No subscription. Yours forever.</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-center">
                <p className="text-sm text-yellow-800 font-medium">🚧 Pro purchases coming soon!</p>
                <p className="text-xs text-yellow-700 mt-1">In the meantime, support the project on Ko-fi to keep this tool free.</p>
              </div>

              <a
                href="https://ko-fi.com/ao3skingen"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-gradient-to-r from-pink-500 to-red-500 text-white text-center py-3 rounded-lg font-bold hover:from-pink-600 hover:to-red-600 transition shadow-lg mb-4"
              >
                ☕ Support on Ko-fi
              </a>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Questions? Contact us at support@ao3skingen.com
          </p>
        </div>
      </div>
    </div>
  );
};
