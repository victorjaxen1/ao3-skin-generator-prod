/**
 * Character Cache System
 * Stores Twitter characters in localStorage to persist across sessions
 * Saves avatars and all character data to prevent re-uploading
 */

import type { TwitterCharacter } from './schema';

const CACHE_KEY = 'ao3_twitter_characters_cache';
const CACHE_VERSION = 1;

interface CharacterCache {
  version: number;
  characters: TwitterCharacter[];
  lastUpdated: string;
}

/**
 * Load cached characters from localStorage
 */
export function loadCachedCharacters(): TwitterCharacter[] {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return [];
    
    const data: CharacterCache = JSON.parse(cached);
    
    // Version check - clear cache if version mismatch
    if (data.version !== CACHE_VERSION) {
      clearCharacterCache();
      return [];
    }
    
    return data.characters || [];
  } catch (error) {
    console.error('Failed to load character cache:', error);
    return [];
  }
}

/**
 * Save characters to localStorage cache
 */
export function saveCachedCharacters(characters: TwitterCharacter[]): void {
  try {
    const data: CharacterCache = {
      version: CACHE_VERSION,
      characters,
      lastUpdated: new Date().toISOString(),
    };
    
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save character cache:', error);
    // Handle quota exceeded error gracefully
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded. Character cache not saved.');
    }
  }
}

/**
 * Add a new character to the cache
 */
export function addCharacterToCache(character: TwitterCharacter): void {
  const characters = loadCachedCharacters();
  
  // Check if character already exists (by name, case-insensitive)
  const existingIndex = characters.findIndex(
    c => c.name.toLowerCase() === character.name.toLowerCase()
  );
  
  if (existingIndex >= 0) {
    // Update existing character
    characters[existingIndex] = character;
  } else {
    // Add new character
    characters.push(character);
  }
  
  saveCachedCharacters(characters);
}

/**
 * Remove a character from the cache
 */
export function removeCharacterFromCache(characterId: string): void {
  const characters = loadCachedCharacters();
  const filtered = characters.filter(c => c.id !== characterId);
  saveCachedCharacters(filtered);
}

/**
 * Update a character in the cache
 */
export function updateCharacterInCache(characterId: string, updates: Partial<TwitterCharacter>): void {
  const characters = loadCachedCharacters();
  const index = characters.findIndex(c => c.id === characterId);
  
  if (index >= 0) {
    characters[index] = { ...characters[index], ...updates };
    saveCachedCharacters(characters);
  }
}

/**
 * Clear all cached characters
 */
export function clearCharacterCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Failed to clear character cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; lastUpdated: string | null; sizeKB: number } {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return { count: 0, lastUpdated: null, sizeKB: 0 };
    }
    
    const data: CharacterCache = JSON.parse(cached);
    const sizeKB = Math.round((cached.length * 2) / 1024); // Rough estimate (2 bytes per char in UTF-16)
    
    return {
      count: data.characters.length,
      lastUpdated: data.lastUpdated,
      sizeKB,
    };
  } catch (error) {
    return { count: 0, lastUpdated: null, sizeKB: 0 };
  }
}
