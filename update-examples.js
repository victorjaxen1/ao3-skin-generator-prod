const fs = require('fs');

let content = fs.readFileSync('src/lib/examples.ts', 'utf8');

// Replace avatar URLs with CDN paths
const avatarReplacements = [
  ['/assets/Alex-Rivers-avatar.png', '`${AVATAR_CDN}/alex-rivers.png`'],
  ['/assets/Taylor-Swift-avatar.png', '`${AVATAR_CDN}/taylor-swift.png`'],
  ['/assets/Jamie-Chen-avatar.png', '`${AVATAR_CDN}/jamie-chen.png`'],
  ['/assets/jordan-avatar.png', '`${AVATAR_CDN}/jordan.png`'],
  ['/assets/Riley-avatar.png', '`${AVATAR_CDN}/riley.png`'],
  ['/assets/mom-avatar.png', '`${AVATAR_CDN}/mom.png`'],
  ['/assets/Casey-avatar.png', '`${AVATAR_CDN}/casey.png`'],
  ['/assets/sam-avatar.png', '`${AVATAR_CDN}/sam.png`'],
  ['/assets/alex-avatar.png', '`${AVATAR_CDN}/alex.png`'],
  ['/assets/sunset-scene.png', '`${AVATAR_CDN}/sunset-scene.png`'],
];

// Replace header/footer URLs with PLATFORM_ASSETS references
const platformReplacements = [
  ["'/assets/imessage-header.png'", 'PLATFORM_ASSETS.ios.headerImage'],
  ["'/assets/imessage-footer.jpg'", 'PLATFORM_ASSETS.ios.footerImage'],
  ["'/assets/whatapp-header.png'", 'PLATFORM_ASSETS.whatsapp.headerImage'],
  ["'/assets/whatsapp-footer.png'", 'PLATFORM_ASSETS.whatsapp.footerImage'],
];

// Apply avatar replacements
for (const [from, to] of avatarReplacements) {
  const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, to);
}

// Apply platform asset replacements
for (const [from, to] of platformReplacements) {
  const regex = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, to);
}

fs.writeFileSync('src/lib/examples.ts', content);
console.log('examples.ts updated successfully!');
