import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { UniversalCharacter } from '../lib/schema';
import { CHARACTER_BANK, CharacterAvatar } from '../lib/characterBank';

interface Props {
  characters: UniversalCharacter[];
  currentTemplate: 'ios' | 'android' | 'twitter' | 'google';
  onAddCharacter: (character: UniversalCharacter) => void;
  onUpdateCharacter: (id: string, updates: Partial<UniversalCharacter>) => void;
  onDeleteCharacter: (id: string) => void;
  onQuickApply?: (character: UniversalCharacter) => void;
}

type CategoryFilter = 'all' | 'modern' | 'diversity' | 'fantasy' | 'neutral' | 'age-varied';
type ViewMode = 'presets' | 'saved';

export const CharacterLibrary: React.FC<Props> = ({
  characters,
  currentTemplate,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onQuickApply
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('presets');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleLoadFromBank = (bankChar: CharacterAvatar) => {
    // Check if already saved
    const alreadySaved = characters.some(c => c.avatarUrl === bankChar.url);
    if (alreadySaved) return;
    
    const character: UniversalCharacter = {
      id: crypto.randomUUID(),
      name: bankChar.name,
      avatarUrl: bankChar.url,
      category: bankChar.category,
      usageCount: 0,
      lastUsed: new Date().toISOString()
    };
    
    onAddCharacter(character);
  };

  const handleQuickApply = (character: UniversalCharacter) => {
    // Update usage stats
    onUpdateCharacter(character.id, {
      usageCount: (character.usageCount || 0) + 1,
      lastUsed: new Date().toISOString()
    });
    
    if (onQuickApply) {
      onQuickApply(character);
    }
    
    // Close panel on mobile after applying
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  // Filter presets by category and search
  const filteredPresets = useMemo(() => {
    let filtered = CHARACTER_BANK;
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(c => c.category === categoryFilter);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) || 
        c.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [categoryFilter, searchQuery]);

  // Sort saved characters by last used
  const sortedSavedCharacters = useMemo(() => {
    return [...characters].sort((a, b) => {
      const aTime = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bTime = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bTime - aTime;
    });
  }, [characters]);

  // Check if preset is already saved
  const isPresetSaved = (bankChar: CharacterAvatar) => {
    return characters.some(c => c.avatarUrl === bankChar.url);
  };

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: CHARACTER_BANK.length,
      modern: CHARACTER_BANK.filter(c => c.category === 'modern').length,
      diversity: CHARACTER_BANK.filter(c => c.category === 'diversity').length,
      fantasy: CHARACTER_BANK.filter(c => c.category === 'fantasy').length,
      neutral: CHARACTER_BANK.filter(c => c.category === 'neutral').length,
      'age-varied': CHARACTER_BANK.filter(c => c.category === 'age-varied').length,
    };
    return counts;
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg transition-all font-medium text-sm shadow-md hover:shadow-lg"
      >
        <span>📚</span>
        <span className="hidden sm:inline">Character Presets</span>
        {characters.length > 0 && (
          <span className="bg-white/30 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
            {characters.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm animate-fadeIn"
        onClick={() => setIsOpen(false)}
      />

      {/* Slide-out Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full sm:max-w-2xl bg-white shadow-2xl z-[70] overflow-hidden animate-slideInRight flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 text-white p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📚</span>
              <div>
                <h2 className="font-bold text-xl">Character Library</h2>
                <p className="text-xs text-purple-100">
                  Browse {CHARACTER_BANK.length} presets • {characters.length} saved
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 text-2xl transition-all"
              aria-label="Close character library"
            >
              ×
            </button>
          </div>

          {/* View Mode Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('presets')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                viewMode === 'presets'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              🎭 Browse Presets ({CHARACTER_BANK.length})
            </button>
            <button
              onClick={() => setViewMode('saved')}
              className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                viewMode === 'saved'
                  ? 'bg-white text-purple-600 shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              ⭐ My Characters ({characters.length})
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === 'presets' ? (
            <div className="p-5 pb-24 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search presets... (e.g., 'elf', 'business', 'teen')"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Filters */}
              <div className="flex gap-2 overflow-x-auto pb-2 pr-4 snap-x snap-mandatory">
                {[
                  { value: 'all' as const, label: 'All', icon: '🌟' },
                  { value: 'modern' as const, label: 'Modern', icon: '👔' },
                  { value: 'diversity' as const, label: 'Diversity', icon: '🌍' },
                  { value: 'fantasy' as const, label: 'Fantasy', icon: '⚔️' },
                  { value: 'age-varied' as const, label: 'Age-Varied', icon: '👨‍👩‍👧' },
                  { value: 'neutral' as const, label: 'Non-Binary', icon: '🌈' },
                ].map(cat => (
                  <button
                    key={cat.value}
                    onClick={() => setCategoryFilter(cat.value)}
                    className={`px-3 py-2 rounded-lg font-medium text-xs whitespace-nowrap transition-all snap-start flex-shrink-0 ${
                      categoryFilter === cat.value
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat.icon} {cat.label} ({categoryCounts[cat.value]})
                  </button>
                ))}
              </div>

              {/* Info Banner */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="text-sm">
                    <p className="font-semibold text-purple-900 mb-1">How to use Character Presets</p>
                    <p className="text-purple-700 text-xs leading-relaxed">
                      Click <strong>+ Add to Library</strong> to save a preset for reuse. 
                      Saved characters appear in <strong>My Characters</strong> tab and can be loaded 
                      into participants with one click. No need to manually create characters!
                    </p>
                  </div>
                </div>
              </div>

              {/* Presets Grid */}
              {filteredPresets.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-6xl mb-4">🔍</div>
                  <p className="font-medium text-lg">No presets found</p>
                  <p className="text-sm mt-2">Try a different search or category</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                    <span className="font-medium">
                      {filteredPresets.length} preset{filteredPresets.length !== 1 ? 's' : ''} found
                    </span>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredPresets.map((preset) => {
                      const saved = isPresetSaved(preset);
                      return (
                        <div
                          key={preset.id}
                          className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all group"
                        >
                          {/* Avatar */}
                          <div className="relative w-full h-24 bg-gradient-to-br from-purple-100 to-pink-100">
                            <Image
                              src={preset.url}
                              alt={preset.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            {saved && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-bold shadow-md">
                                ✓ Saved
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2 space-y-1.5">
                            <div>
                              <h3 className="font-bold text-xs text-gray-900 truncate">
                                {preset.name}
                              </h3>
                              {preset.description && (
                                <p className="text-[10px] text-gray-600 line-clamp-1 mt-0.5">
                                  {preset.description}
                                </p>
                              )}
                            </div>

                            <button
                              onClick={() => handleLoadFromBank(preset)}
                              disabled={saved}
                              className={`w-full px-2 py-1.5 rounded-lg font-semibold text-[10px] transition-all ${
                                saved
                                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-sm hover:shadow-md'
                              }`}
                            >
                              {saved ? '✓ In Library' : '+ Add to Library'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            // Saved Characters View
            <div className="p-5 pb-24 space-y-4">
              {sortedSavedCharacters.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-6xl mb-4">⭐</div>
                  <p className="font-medium text-lg">No saved characters yet</p>
                  <p className="text-sm mt-2 mb-6">Browse presets to add characters to your library</p>
                  <button
                    onClick={() => setViewMode('presets')}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    🎭 Browse Presets
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">🎯</span>
                      <div className="text-sm">
                        <p className="font-semibold text-blue-900 mb-1">Quick Actions</p>
                        <p className="text-blue-700 text-xs">
                          Click <strong>Use</strong> to apply character to current message. 
                          Click <strong>Delete</strong> to remove from library.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {sortedSavedCharacters.map((char) => (
                      <div
                        key={char.id}
                        className="bg-white border-2 border-gray-200 hover:border-purple-400 rounded-xl p-4 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          {/* Avatar */}
                          {char.avatarUrl ? (
                            <div className="relative w-14 h-14 flex-shrink-0">
                              <Image
                                src={char.avatarUrl}
                                alt={char.name}
                                fill
                                className="rounded-full object-cover border-2 border-purple-400"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 shadow-md">
                              {char.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base text-gray-900 truncate flex items-center gap-2">
                              <span>{char.name}</span>
                              {char.verified && <span className="text-blue-500">✓</span>}
                            </div>
                            {char.twitterHandle && (
                              <div className="text-sm text-gray-600 truncate">
                                @{char.twitterHandle.replace('@', '')}
                              </div>
                            )}
                            {char.usageCount > 0 && (
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <span>📊</span>
                                Used {char.usageCount} time{char.usageCount !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleQuickApply(char)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                              title="Apply to current message"
                            >
                              Use
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove "${char.name}" from library?`)) {
                                  onDeleteCharacter(char.id);
                                }
                              }}
                              className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
                              title="Delete character"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideInRight {
          animation: slideInRight 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
