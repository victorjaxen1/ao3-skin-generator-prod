/**
 * PWA Install Prompt Component
 * Shows a banner encouraging users to install the app for offline access
 */

import React, { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only show in production and if not already installed
    if (process.env.NODE_ENV !== 'production') return;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return; // Already installed
    }

    // Listen for beforeinstallprompt event
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Don't show immediately - wait for user to engage with the app
      setTimeout(() => {
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
          setShowPrompt(true);
        }
      }, 30000); // Show after 30 seconds of use
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted installation');
    } else {
      console.log('[PWA] User dismissed installation');
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  if (!showPrompt || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-blue-600 text-white rounded-lg shadow-2xl p-4 z-50 animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 text-2xl">📱</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Install AO3 Skin Generator</h3>
          <p className="text-sm text-blue-100 mb-3">
            Install this app for offline access and faster loading. Create AO3 skins anytime, anywhere!
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstall}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg font-medium text-sm hover:bg-blue-800 transition"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-blue-100 hover:text-white transition"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
