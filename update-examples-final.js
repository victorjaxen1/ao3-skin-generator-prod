const fs = require('fs');

let content = fs.readFileSync('src/lib/examples.ts', 'utf8');

// Replace all remaining /assets/ avatar references with CDN template literals
content = content
  .replace(/\'\/assets\/Taylor-Swift-avatar\.png\'/g, '`${AVATAR_CDN}/taylor-swift.png`')
  .replace(/\'\/assets\/Jamie-Chen-avatar\.png\'/g, '`${AVATAR_CDN}/jamie-chen.png`')
  .replace(/\'\/assets\/jordan-avatar\.png\'/g, '`${AVATAR_CDN}/jordan.png`')
  .replace(/\'\/assets\/Riley-avatar\.png\'/g, '`${AVATAR_CDN}/riley.png`')
  .replace(/\'\/assets\/mom-avatar\.png\'/g, '`${AVATAR_CDN}/mom.png`')
  .replace(/\'\/assets\/Casey-avatar\.png\'/g, '`${AVATAR_CDN}/casey.png`')
  .replace(/\'\/assets\/sam-avatar\.png\'/g, '`${AVATAR_CDN}/sam.png`')
  .replace(/\'\/assets\/alex-avatar\.png\'/g, '`${AVATAR_CDN}/alex.png`')
  .replace(/\'\/assets\/Alex-Rivers-avatar\.png\'/g, '`${AVATAR_CDN}/alex-rivers.png`')
  // Replace header/footer paths with PLATFORM_ASSETS references
  .replace(/\'\/assets\/imessage-header\.png\'/g, 'PLATFORM_ASSETS.ios.headerImage')
  .replace(/\'\/assets\/imessage-footer\.jpg\'/g, 'PLATFORM_ASSETS.ios.footerImage')
  .replace(/\'\/assets\/whatapp-header\.png\'/g, 'PLATFORM_ASSETS.whatsapp.headerImage')
  .replace(/\'\/assets\/whatsapp-footer\.png\'/g, 'PLATFORM_ASSETS.whatsapp.footerImage');

fs.writeFileSync('src/lib/examples.ts', content);
console.log('✓ Updated all avatar and asset paths');
