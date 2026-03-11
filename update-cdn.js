const fs = require('fs');

// Read examples.ts
let content = fs.readFileSync('src/lib/examples.ts', 'utf8');

// Replace avatar paths with template literals
content = content
  .replace(/\/assets\/Alex-Rivers-avatar\.png/g, '${AVATAR_CDN}/alex-rivers.png')
  .replace(/\/assets\/Taylor-Swift-avatar\.png/g, '${AVATAR_CDN}/taylor-swift.png')
  .replace(/\/assets\/Jamie-Chen-avatar\.png/g, '${AVATAR_CDN}/jamie-chen.png')
  .replace(/\/assets\/jordan-avatar\.png/g, '${AVATAR_CDN}/jordan.png')
  .replace(/\/assets\/Riley-avatar\.png/g, '${AVATAR_CDN}/riley.png')
  .replace(/\/assets\/mom-avatar\.png/g, '${AVATAR_CDN}/mom.png')
  .replace(/\/assets\/Casey-avatar\.png/g, '${AVATAR_CDN}/casey.png')
  .replace(/\/assets\/sam-avatar\.png/g, '${AVATAR_CDN}/sam.png')
  .replace(/\/assets\/alex-avatar\.png/g, '${AVATAR_CDN}/alex.png')
  .replace(/'/g, "'")  // Replace single quotes with backticks for template literals
  .replace(/'\/assets\/imessage-header\.png'/g, 'PLATFORM_ASSETS.ios.headerImage')
  .replace(/'\/assets\/imessage-footer\.jpg'/g, 'PLATFORM_ASSETS.ios.footerImage')
  .replace(/'\/assets\/whatapp-header\.png'/g, 'PLATFORM_ASSETS.whatsapp.headerImage')
  .replace(/'\/assets\/whatsapp-footer\.png'/g, 'PLATFORM_ASSETS.whatsapp.footerImage');

// Write back
fs.writeFileSync('src/lib/examples.ts', content);
console.log('✓ Avatar and header/footer paths updated to use CDN and PLATFORM_ASSETS');
