import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { UniversalCharacter } from '../lib/schema';
import { CHARACTER_BANK, CharacterAvatar } from '../lib/characterBank';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  characters: UniversalCharacter[];
  currentTemplate: 'ios' | 'android' | 'twitter' | 'google';
  onAddCharacter: (character: UniversalCharacter) => void;
  onUpdateCharacter: (id: string, updates: Partial<UniversalCharacter>) => void;
  onDeleteCharacter: (id: string) => void;
  onSetAsContact: (name: string, avatarUrl: string) => void;
}

type CategoryFilter = 'all' | 'modern' | 'diversity' | 'fantasy' | 'neutral' | 'age-varied';
type ViewMode = 'saved' | 'presets';

export const CharacterLibrary: React.FC<Props> = ({
  isOpen,
  onClose,
  characters,
  currentTemplate,
  onAddCharacter,
  onUpdateCharacter,
  onDeleteCharacter,
  onSetAsContact,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('saved');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleSaveFromBank = (bankChar: CharacterAvatar) => {
    if (characters.some(c => c.avatarUrl === bankChar.url)) return;
    onAddCharacter({
      id: crypto.randomUUID(),
      name: bankChar.name,
      avatarUrl: bankChar.url,
      category: bankChar.category,
      usageCount: 0,
      lastUsed: new Date().toISOString(),
    });
  };

  const handleSetAsContact = (char: UniversalCharacter) => {
    onSetAsContact(char.name, char.avatarUrl || '');
    onUpdateCharacter(char.id, {
      usageCount: (char.usageCount || 0) + 1,
      lastUsed: new Date().toISOString(),
    });
    onClose();
  };

  const handleSaveEdit = (id: string) => {
    const trimmed = editName.trim();
    if (trimmed) onUpdateCharacter(id, { name: trimmed });
    setEditingId(null);
  };

  const filteredPresets = useMemo(() => {
    let f = CHARACTER_BANK;
    if (categoryFilter !== 'all') f = f.filter(c => c.category === categoryFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      f = f.filter(c => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
    }
    return f;
  }, [categoryFilter, searchQuery]);

  const sortedSaved = useMemo(() =>
    [...characters].sort((a, b) => {
      const at = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const bt = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return bt - at;
    }),
  [characters]);

  const isPresetSaved = (bankChar: CharacterAvatar) =>
    characters.some(c => c.avatarUrl === bankChar.url);

  if (!isOpen) return null;

  const setLabel = currentTemplate === 'twitter' ? 'Set as tweeter' : 'Set as contact';

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-50 animate-fade-overlay"
        onClick={onClose}
      />
      <div
        className="fixed right-0 top-0 bottom-0 w-full sm:max-w-md bg-white shadow-2xl z-50 flex flex-col"
        style={{ animation: 'slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Characters</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              {characters.length} saved &middot; {CHARACTER_BANK.length} presets available
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors text-sm"
          >
            &times;
          </button>
        </div>

        <div className="flex border-b border-stone-200 flex-shrink-0">
          {(['saved', 'presets'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setViewMode(tab)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                viewMode === tab
                  ? 'text-violet-600 border-violet-600'
                  : 'text-stone-500 border-transparent hover:text-stone-800'
              }`}
            >
              {tab === 'saved' ? `My Library (${characters.length})` : `Browse (${CHARACTER_BANK.length})`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {viewMode === 'saved' ? (
            <div className="px-4 py-4 space-y-2">
              {sortedSaved.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-stone-500 text-sm font-medium">No saved characters yet</p>
                  <p className="text-stone-400 text-xs mt-1 mb-5">Browse presets to build your library</p>
                  <button
                    onClick={() => setViewMode('presets')}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 transition-colors"
                  >
                    Browse presets
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-stone-400 pb-1">
                    Tap a name to rename it. Tap &ldquo;Set as contact&rdquo; to apply them to this conversation.
                  </p>
                  {sortedSaved.map((char) => (
                    <div key={char.id} className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl p-3 hover:border-stone-300 transition-colors">
                      {char.avatarUrl ? (
                        <div className="relative w-11 h-11 flex-shrink-0">
                          <Image src={char.avatarUrl} alt={char.name} fill className="rounded-full object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-sm flex-shrink-0">
                          {char.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {editingId === char.id ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={() => handleSaveEdit(char.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(char.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full text-sm bg-stone-100 rounded px-2 py-0.5 outline-none focus:ring-2 focus:ring-violet-500"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingId(char.id); setEditName(char.name); }}
                            className="text-sm font-medium text-stone-900 truncate block w-full text-left hover:text-violet-700 transition-colors"
                            title="Tap to rename"
                          >
                            {char.name}
                          </button>
                        )}
                        {(char.usageCount ?? 0) > 0 && (
                          <p className="text-[11px] text-stone-400">Used {char.usageCount}&times;</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleSetAsContact(char)}
                          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                        >
                          {setLabel}
                        </button>
                        <button
                          onClick={() => { if (window.confirm(`Remove "${char.name}" from library?`)) onDeleteCharacter(char.id); }}
                          className="w-7 h-7 flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          ) : (
            <div className="px-4 py-4 space-y-3">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search avatars..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-2.5 bg-stone-100 border-0 rounded-xl text-sm placeholder-stone-400 outline-none focus:ring-2 focus:ring-violet-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">&times;</button>
                )}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {(['all', 'modern', 'diversity', 'fantasy', 'age-varied', 'neutral'] as CategoryFilter[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                      categoryFilter === cat ? 'bg-violet-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {cat === 'all' ? 'All' : cat === 'age-varied' ? 'Age-Varied' : cat === 'neutral' ? 'Non-Binary' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              {filteredPresets.length === 0 ? (
                <div className="text-center py-12 text-stone-400">
                  <p className="text-sm">No presets found</p>
                  <button onClick={() => { setSearchQuery(''); setCategoryFilter('all'); }} className="text-xs text-violet-600 underline mt-1">Clear filters</button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {filteredPresets.map((preset) => {
                    const saved = isPresetSaved(preset);
                    return (
                      <div key={preset.id} className="bg-stone-50 border border-stone-200 rounded-xl overflow-hidden">
                        <div className="relative w-full aspect-square bg-stone-100">
                          <Image src={preset.url} alt={preset.name} fill className="object-cover" unoptimized />
                          {saved && (
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                              <span className="text-white font-bold text-lg">&#10003;</span>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="text-[11px] font-medium text-stone-700 truncate mb-1.5">{preset.name}</p>
                          <button
                            onClick={() => handleSaveFromBank(preset)}
                            disabled={saved}
                            className={`w-full py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                              saved ? 'bg-stone-100 text-stone-400 cursor-not-allowed' : 'bg-violet-600 text-white hover:bg-violet-700'
                            }`}
                          >
                            {saved ? 'Saved' : 'Save to library'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};

export default CharacterLibrary;