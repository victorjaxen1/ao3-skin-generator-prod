/**
 * Character Avatar Bank
 * 
 * Universal character system for all templates (iOS, Android, Twitter, Google).
 * All hosted on Publit.io CDN for reliability.
 * Users can also enter custom URLs for their own avatars.
 */

const PUBLIT_CDN = 'https://media.publit.io/file/AO3-Skins-App';

function avatarUrl(filename: string): string {
  return `${PUBLIT_CDN}/avatars/${filename}`;
}

export interface CharacterAvatar {
  id: string;
  name: string;
  url: string;
  category: 'modern' | 'diversity' | 'fantasy' | 'neutral' | 'age-varied';
  description?: string;
}

/**
 * Universal Character - Works across all templates
 */
export interface UniversalCharacter {
  id: string;
  name: string;                 // Display name (used in all templates)
  avatarUrl?: string;           // Profile picture URL
  
  // Platform-specific handles
  twitterHandle?: string;       // @username for Twitter
  phoneNumber?: string;         // For SMS/WhatsApp (optional)
  email?: string;              // For email templates (future)
  
  // Metadata
  verified?: boolean;           // Verified badge (Twitter, Instagram)
  bio?: string;                // Short description
  category: CharacterAvatar['category'];
  
  // Usage tracking
  lastUsed?: string;           // ISO timestamp
  usageCount: number;          // Analytics
}

/**
 * Pre-defined character avatars - optimized for AO3 fic writing needs
 * Based on 80/20 rule: covers 80% of common character archetypes
 */
export const CHARACTER_BANK: CharacterAvatar[] = [
  // Modern/Romance - Most common in contemporary AUs (10)
  { id: 'm1', name: 'Casual Young Man', url: avatarUrl('casual-young-man.png'), category: 'modern', description: 'Age 18-25, everyday protagonist' },
  { id: 'm2', name: 'Casual Young Woman', url: avatarUrl('casual-young-woman.png'), category: 'modern', description: 'Age 18-25, everyday protagonist' },
  { id: 'm3', name: 'Business Man', url: avatarUrl('business-man.png'), category: 'modern', description: 'Professional in suit, corporate AUs' },
  { id: 'm4', name: 'Business Woman', url: avatarUrl('business-woman.png'), category: 'modern', description: 'Professional attire, boss dynamics' },
  { id: 'm5', name: 'Teen Boy', url: avatarUrl('teen-boy.png'), category: 'modern', description: 'Age 15-17, high school AUs' },
  { id: 'm6', name: 'Teen Girl', url: avatarUrl('teen-girl.png'), category: 'modern', description: 'Age 15-17, YA fiction' },
  { id: 'm7', name: 'Soft Boy', url: avatarUrl('soft-boy.png'), category: 'modern', description: 'E-boy aesthetic, modern internet culture' },
  { id: 'm8', name: 'Alternative Girl', url: avatarUrl('alt-girl.png'), category: 'modern', description: 'Goth/punk style, subculture rep' },
  { id: 'm9', name: 'Athletic Jock', url: avatarUrl('jock.png'), category: 'modern', description: 'Sports AUs, college settings' },
  { id: 'm10', name: 'Hipster Guy', url: avatarUrl('hipster.png'), category: 'modern', description: 'Beard, glasses, coffee shop AUs' },

  // Age-Varied - Parent figures & age gaps (4)
  { id: 'a1', name: 'Dad Figure', url: avatarUrl('dad.png'), category: 'age-varied', description: 'Age 40s-50s, found family trope' },
  { id: 'a2', name: 'Mom Figure', url: avatarUrl('mom.png'), category: 'age-varied', description: 'Age 40s-50s, parental support' },
  { id: 'a3', name: 'Silver Fox', url: avatarUrl('older-man.png'), category: 'age-varied', description: 'Distinguished older man, age gap romance' },
  { id: 'a4', name: 'Mature Woman', url: avatarUrl('older-woman.png'), category: 'age-varied', description: 'Elegant older woman, mentor figure' },

  // Diversity - Critical representation (6)
  { id: 'd1', name: 'Asian Man', url: avatarUrl('asian-man.png'), category: 'diversity', description: 'East Asian rep, K-pop AUs' },
  { id: 'd2', name: 'Asian Woman', url: avatarUrl('asian-woman.png'), category: 'diversity', description: 'East Asian rep, diverse casting' },
  { id: 'd3', name: 'Black Man', url: avatarUrl('black-man.png'), category: 'diversity', description: 'Black representation, diverse casting' },
  { id: 'd4', name: 'Black Woman', url: avatarUrl('black-woman.png'), category: 'diversity', description: 'Black representation, diverse casting' },
  { id: 'd5', name: 'Hijabi Woman', url: avatarUrl('hijabi.png'), category: 'diversity', description: 'Religious/cultural representation' },
  { id: 'd6', name: 'Plus-Size Character', url: avatarUrl('plus-size.png'), category: 'diversity', description: 'Body diversity, size representation' },

  // Neutral/NB - Gender-diverse characters (4)
  { id: 'n1', name: 'Androgynous Masc', url: avatarUrl('androgynous-masc.png'), category: 'neutral', description: 'Masculine-presenting NB' },
  { id: 'n2', name: 'Androgynous Femme', url: avatarUrl('androgynous-femme.png'), category: 'neutral', description: 'Feminine-presenting NB' },
  { id: 'n3', name: 'Quinn', url: avatarUrl('quinn.png'), category: 'neutral', description: 'Gender-neutral style' },
  { id: 'n4', name: 'River', url: avatarUrl('river.png'), category: 'neutral', description: 'Alternative NB aesthetic' },

  // Fantasy/Genre - Supernatural & period (6)
  { id: 'f1', name: 'Elf Warrior', url: avatarUrl('elf.png'), category: 'fantasy', description: 'Fantasy/D&D settings' },
  { id: 'f2', name: 'Knight', url: avatarUrl('knight.png'), category: 'fantasy', description: 'Medieval/historical combat' },
  { id: 'f3', name: 'Mage', url: avatarUrl('mage.png'), category: 'fantasy', description: 'Wizard/magic user' },
  { id: 'f4', name: 'Vampire', url: avatarUrl('vampire.png'), category: 'fantasy', description: 'Supernatural romance, gothic' },
  { id: 'f5', name: 'Royalty', url: avatarUrl('royalty.png'), category: 'fantasy', description: 'Regency, historical romance' },
  { id: 'f6', name: 'Cyberpunk', url: avatarUrl('cyberpunk.png'), category: 'fantasy', description: 'Sci-fi, futuristic settings' },
];

/**
 * Get avatar by ID
 */
export function getAvatarById(id: string): CharacterAvatar | undefined {
  return CHARACTER_BANK.find(a => a.id === id);
}

/**
 * Get avatars by category
 */
export function getAvatarsByCategory(category: CharacterAvatar['category']): CharacterAvatar[] {
  return CHARACTER_BANK.filter(a => a.category === category);
}

/**
 * Get avatar URL by ID, or return custom URL if provided
 */
export function resolveAvatarUrl(avatarIdOrUrl: string): string {
  // If it looks like a URL, return as-is
  if (avatarIdOrUrl.startsWith('http') || avatarIdOrUrl.startsWith('/')) {
    return avatarIdOrUrl;
  }
  // Otherwise, look up in bank
  const avatar = getAvatarById(avatarIdOrUrl);
  return avatar?.url || '';
}

/**
 * Categories for UI display - optimized for AO3 fic writing
 */
export const AVATAR_CATEGORIES = [
  { id: 'modern', label: 'Modern/Romance', emoji: '💕', description: 'Contemporary AUs, everyday characters' },
  { id: 'age-varied', label: 'Age Varied', emoji: '👨‍👩‍👧', description: 'Parent figures, age gap romance' },
  { id: 'diversity', label: 'Diversity', emoji: '🌍', description: 'Cultural & body representation' },
  { id: 'neutral', label: 'Non-Binary', emoji: '🧑', description: 'Gender-diverse characters' },
  { id: 'fantasy', label: 'Fantasy/Genre', emoji: '🧝', description: 'Supernatural, historical, sci-fi' },
] as const;
