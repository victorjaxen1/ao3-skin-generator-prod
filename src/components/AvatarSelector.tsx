/**
 * Avatar Selector Component
 * Provides a visual picker for the 30 pre-built CHARACTER_BANK avatars
 * Users can select from categories or paste custom URLs
 */

import React, { useState } from 'react';
import Image from 'next/image';
import { CHARACTER_BANK, AVATAR_CATEGORIES } from '../lib/characterBank';
import { normalizeImageUrl, getExpiringUrlWarning, wasNormalized } from '../lib/urlNormalize';

interface Props {
  value?: string; // Current avatar URL
  onChange: (url: string) => void;
  placeholder?: string;
}

export const AvatarSelector: React.FC<Props> = ({ 
  value = '', 
  onChange,
  placeholder = 'Avatar URL or select below'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('modern');
  const [customUrl, setCustomUrl] = useState(value);
  const [expiringWarning, setExpiringWarning] = useState<string | null>(null);
  const [normalizedFrom, setNormalizedFrom] = useState<string | null>(null);

  // Filter characters by active category
  const filteredCharacters = CHARACTER_BANK.filter(
    char => char.category === activeCategory
  );

  const handleSelectAvatar = (url: string) => {
    setCustomUrl(url);
    setExpiringWarning(null);
    setNormalizedFrom(null);
    onChange(url);
    setIsOpen(false);
  };

  const handleCustomUrlChange = (newUrl: string) => {
    const normalized = normalizeImageUrl(newUrl);
    const warning = getExpiringUrlWarning(newUrl);
    const didNormalize = wasNormalized(newUrl, normalized);
    setCustomUrl(normalized);
    setExpiringWarning(warning);
    setNormalizedFrom(didNormalize ? newUrl : null);
    onChange(normalized);
  };

  return (
    <div className="relative">
      {/* Input with avatar preview */}
      <div className="flex gap-2">
        <input 
          type="text"
          className="border border-gray-200 px-2 py-1 rounded flex-1 text-xs focus:ring-2 focus:ring-purple-400" 
          value={customUrl}
          onChange={(e) => handleCustomUrlChange(e.target.value)}
          placeholder={placeholder}
        />
        
        {/* Preview thumbnail */}
        {customUrl && (
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
            <Image 
              src={customUrl} 
              alt="Avatar preview"
              width={32}
              height={32}
              className="object-cover"
              unoptimized={customUrl.startsWith('data:')}
              onError={(e: any) => {
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
              }}
            />
          </div>
        )}
        
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition-colors flex-shrink-0"
          title="Browse 30 preset avatars"
        >
          {isOpen ? '✕ Close' : '🎭 Presets'}
        </button>
      </div>

      {/* Normalized URL feedback */}
      {normalizedFrom && (
        <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
          <span>✅ URL converted to direct image link automatically.</span>
        </p>
      )}

      {/* Expiring URL warning */}
      {expiringWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
          {expiringWarning}
        </p>
      )}

      {/* Character bank dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
            {AVATAR_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-white text-purple-700 border-b-2 border-purple-500'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Character grid */}
          <div className="p-3 overflow-y-auto max-h-80">
            <div className="text-xs text-gray-500 mb-2">
              {AVATAR_CATEGORIES.find(c => c.id === activeCategory)?.description}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {filteredCharacters.map(char => (
                <button
                  key={char.id}
                  type="button"
                  onClick={() => handleSelectAvatar(char.url)}
                  className={`flex flex-col items-center p-2 rounded-lg border-2 transition-all hover:border-purple-400 hover:bg-purple-50 ${
                    customUrl === char.url 
                      ? 'border-purple-500 bg-purple-50' 
                      : 'border-gray-200 bg-white'
                  }`}
                  title={char.description}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-200 mb-1">
                    <Image 
                      src={char.url} 
                      alt={char.name}
                      width={48}
                      height={48}
                      className="object-cover"
                      unoptimized={char.url.startsWith('data:')}
                      onError={(e: any) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3C/svg%3E';
                      }}
                    />
                  </div>
                  <span className="text-xs text-center leading-tight text-gray-700">
                    {char.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom URL hint */}
          <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
            💡 Paste a URL from <strong>Imgur</strong>, <strong>ImgBB</strong>, <strong>Google Drive</strong>, <strong>Dropbox</strong>, or any direct image link. Share-page URLs are converted automatically.
          </div>
        </div>
      )}
    </div>
  );
};
