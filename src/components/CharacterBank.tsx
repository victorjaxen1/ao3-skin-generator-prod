/**
 * Character Bank Component
 * Allows users to save, load, and manage character presets across projects
 * Characters are stored in localStorage for persistence
 */

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { TwitterCharacter } from '../lib/schema';

const CHARACTER_BANK_KEY = 'ao3_character_bank';
const BANK_VERSION = 1;

interface CharacterBankData {
  version: number;
  characters: TwitterCharacter[];
  lastUpdated: string;
}

// Load saved characters from bank
function loadCharacterBank(): TwitterCharacter[] {
  try {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(CHARACTER_BANK_KEY);
    if (!saved) return [];
    
    const data: CharacterBankData = JSON.parse(saved);
    if (data.version !== BANK_VERSION) {
      localStorage.removeItem(CHARACTER_BANK_KEY);
      return [];
    }
    return data.characters || [];
  } catch {
    return [];
  }
}

// Save characters to bank
function saveCharacterBank(characters: TwitterCharacter[]): void {
  try {
    const data: CharacterBankData = {
      version: BANK_VERSION,
      characters,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(CHARACTER_BANK_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save character bank:', error);
  }
}

interface Props {
  onLoadCharacter: (character: TwitterCharacter) => void;
  currentCharacters?: TwitterCharacter[]; // Characters from current project to save
  onSaveToBank?: (character: TwitterCharacter) => void;
}

export const CharacterBank: React.FC<Props> = ({ 
  onLoadCharacter, 
  currentCharacters = [],
}) => {
  const [bankCharacters, setBankCharacters] = useState<TwitterCharacter[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'load' | 'save'>('load');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null); // characterId to delete

  // Load bank on mount
  useEffect(() => {
    setBankCharacters(loadCharacterBank());
  }, []);

  // Filter characters based on search
  const filteredCharacters = bankCharacters.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Save a character to the bank
  const handleSaveToBank = (character: TwitterCharacter) => {
    const existingIndex = bankCharacters.findIndex(c => 
      c.name.toLowerCase() === character.name.toLowerCase() && 
      c.handle.toLowerCase() === character.handle.toLowerCase()
    );

    let newBank: TwitterCharacter[];
    if (existingIndex >= 0) {
      // Update existing
      newBank = [...bankCharacters];
      newBank[existingIndex] = { ...character, id: bankCharacters[existingIndex].id };
    } else {
      // Add new with fresh ID
      newBank = [...bankCharacters, { ...character, id: crypto.randomUUID() }];
    }

    setBankCharacters(newBank);
    saveCharacterBank(newBank);
  };

  // Delete a character from the bank
  const handleDeleteFromBank = (characterId: string) => {
    const newBank = bankCharacters.filter(c => c.id !== characterId);
    setBankCharacters(newBank);
    saveCharacterBank(newBank);
    setDeleteConfirm(null);
  };

  // Load a character into the current project
  const handleLoadCharacter = (character: TwitterCharacter) => {
    onLoadCharacter({ ...character, id: crypto.randomUUID() });
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 text-xs bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition font-medium"
        title="Open Character Bank - Save and load character presets"
      >
        <span>🏦</span>
        <span>Character Bank</span>
        {bankCharacters.length > 0 && (
          <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {bankCharacters.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
          <h3 className="font-bold flex items-center gap-2">
            <span>🏦</span>
            <span>Character Bank</span>
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-indigo-200 text-xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('load')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              activeTab === 'load'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            📥 Load Character ({bankCharacters.length})
          </button>
          <button
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-2 text-sm font-medium transition ${
              activeTab === 'save'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            💾 Save to Bank
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'load' ? (
            <>
              {/* Search */}
              <input
                type="text"
                placeholder="🔍 Search saved characters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />

              {filteredCharacters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="font-medium">No saved characters</p>
                  <p className="text-xs mt-1">
                    {bankCharacters.length === 0 
                      ? 'Save characters from your projects to reuse them later'
                      : 'No characters match your search'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCharacters.map((char) => (
                    <div
                      key={char.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition group"
                    >
                      {/* Avatar */}
                      {char.avatarUrl ? (
                        <Image
                          src={char.avatarUrl}
                          alt={char.name}
                          width={40}
                          height={40}
                          className="rounded-full object-cover border-2 border-gray-200"
                          unoptimized={char.avatarUrl.startsWith('data:')}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                          {char.name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          {char.name}
                          {char.verified && (
                            <span className="text-blue-500 text-xs">✓</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          @{char.handle}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {deleteConfirm === char.id ? (
                          <>
                            <span className="text-xs text-gray-500 mr-1">Delete?</span>
                            <button
                              onClick={() => handleDeleteFromBank(char.id)}
                              className="bg-red-600 text-white text-xs px-2 py-1 rounded hover:bg-red-700 transition"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded hover:bg-gray-300 transition"
                            >
                              No
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleLoadCharacter(char)}
                              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded hover:bg-indigo-700 transition"
                            >
                              Load
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(char.id)}
                              className="text-red-500 hover:text-red-700 text-lg px-1"
                              title="Delete from bank"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              {currentCharacters.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">👥</div>
                  <p className="font-medium">No characters in current project</p>
                  <p className="text-xs mt-1">Add characters to your project first</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 mb-3">
                    Select characters from your current project to save to the bank:
                  </p>
                  {currentCharacters.map((char) => {
                    const isAlreadySaved = bankCharacters.some(
                      bc => bc.name.toLowerCase() === char.name.toLowerCase() &&
                            bc.handle.toLowerCase() === char.handle.toLowerCase()
                    );
                    
                    return (
                      <div
                        key={char.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                      >
                        {/* Avatar */}
                        {char.avatarUrl ? (
                          <Image
                            src={char.avatarUrl}
                            alt={char.name}
                            width={40}
                            height={40}
                            className="rounded-full object-cover border-2 border-gray-200"
                            unoptimized={char.avatarUrl.startsWith('data:')}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                            {char.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {char.name}
                            {char.verified && (
                              <span className="text-blue-500 text-xs">✓</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            @{char.handle}
                          </div>
                        </div>

                        {/* Save Button */}
                        <button
                          onClick={() => handleSaveToBank(char)}
                          className={`text-xs px-3 py-1.5 rounded transition ${
                            isAlreadySaved
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-indigo-600 text-white hover:bg-indigo-700'
                          }`}
                        >
                          {isAlreadySaved ? '✓ Saved' : '💾 Save'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            💡 Characters are saved in your browser's local storage
          </p>
        </div>
      </div>
    </div>
  );
};
