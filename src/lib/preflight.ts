import { SkinProject } from './schema';
import { Violation } from './siteSkin/ao3Css';
import { getExpiringUrlWarning } from './urlNormalize';
import { contrastRatio } from './siteSkin/colors';
import { resolveTwitterTheme } from './twitter';

export interface PreflightItem {
  id: string;
  severity: 'block' | 'warn' | 'info';
  status: 'pass' | 'fail';
  message: string;
}

function compositeHex(foreground: string, opacity: number, background: string): string {
  const channels = (hex: string) => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const fg = channels(foreground);
  const bg = channels(background);
  return `#${fg.map((channel, index) => Math.round(channel * opacity + bg[index] * (1 - opacity)).toString(16).padStart(2, '0')).join('')}`;
}

function sceneContrast(project: SkinProject): number | null {
  if (project.template === 'ios') {
    const dark = project.settings.iosDarkMode === true;
    const sender = project.settings.iosMode === 'sms' ? '#34C759' : '#007AFF';
    return Math.min(
      contrastRatio(sender, '#ffffff'),
      dark ? contrastRatio('#262628', '#ffffff') : contrastRatio('#E9E9EB', '#000000')
    );
  }
  if (project.template === 'android') {
    const dark = project.settings.androidDarkMode === true;
    if (dark) return Math.min(contrastRatio('#005c4b', '#e9edef'), contrastRatio('#1f2c34', '#e9edef'));
    const opacity = Math.max(0, Math.min(1, project.settings.bubbleOpacity));
    const page = '#ece5dd';
    return Math.min(
      contrastRatio(compositeHex(project.settings.senderColor, opacity, page), '#000000'),
      contrastRatio(compositeHex(project.settings.receiverColor, opacity, page), '#000000')
    );
  }
  if (project.template === 'twitter') {
    const theme = resolveTwitterTheme(project.settings);
    if (theme === 'light') return contrastRatio('#ffffff', '#0f1419');
    if (theme === 'dim') return contrastRatio('#15202b', '#f7f9f9');
    return contrastRatio('#000000', '#e7e9ea');
  }
  return null;
}

export function buildWorkSkinPreflight(
  project: SkinProject,
  html: string,
  violations: Violation[],
  hasBackup: boolean
): PreflightItem[] {
  const attachments = project.messages.flatMap(message => [
    ...(message.attachments || []),
    ...(message.twitterQuote?.attachments || []),
  ]);
  const missingAlt = attachments.filter(attachment => !attachment.decorative && !attachment.alt?.trim()).length;
  const expiring = attachments.filter(attachment => !!getExpiringUrlWarning(attachment.url)).length;
  const missingSpeaker = (project.template === 'ios' || project.template === 'android')
    && project.messages.some(message => !message.outgoing && !message.sender.trim() && !message.participantId);
  const longUnbroken = project.messages.some(message => /\S{90,}/.test(message.content));
  const bubbleContrast = sceneContrast(project);
  const videosMissingFallback = project.messages.filter(message => message.twitterVideo
    && !message.twitterVideo.description?.trim()
    && !message.twitterVideo.captionTrackUrl).length;
  const unsafeIframe = /<iframe\b[^>]*src="(?!https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/[A-Za-z0-9_-]{11})/i.test(html);
  const htmlContractOk = /^<div class="(?:chat|tweets)\b/.test(html)
    && !/<(?:script|object|embed)\b/i.test(html)
    && !unsafeIframe;

  return [
    {
      id: 'ao3-css',
      severity: 'block',
      status: violations.length ? 'fail' : 'pass',
      message: violations.length ? 'AO3 CSS validation found blocked rules.' : 'CSS passes the reviewed AO3 compatibility rules.',
    },
    {
      id: 'html-contract',
      severity: 'block',
      status: htmlContractOk ? 'pass' : 'fail',
      message: htmlContractOk ? 'Generated HTML uses the expected scene container.' : 'Generated HTML failed its export contract.',
    },
    {
      id: 'speaker-identity',
      severity: 'block',
      status: missingSpeaker ? 'fail' : 'pass',
      message: missingSpeaker ? 'An incoming message has no speaker, making the fallback ambiguous.' : 'Fallback speaker order is identifiable.',
    },
    {
      id: 'attachment-alt',
      severity: 'warn',
      status: missingAlt ? 'fail' : 'pass',
      message: missingAlt ? `${missingAlt} content image${missingAlt === 1 ? '' : 's'} still need alt text or a decorative mark.` : 'Content images have descriptions or are marked decorative.',
    },
    {
      id: 'image-host',
      severity: 'warn',
      status: expiring ? 'fail' : 'pass',
      message: expiring ? `${expiring} image address${expiring === 1 ? '' : 'es'} may expire.` : 'No known expiring attachment hosts detected.',
    },
    {
      id: 'contrast',
      severity: 'warn',
      status: bubbleContrast === null || bubbleContrast >= 4.5 ? 'pass' : 'fail',
      message: bubbleContrast === null
        ? 'This platform uses its fixed text palette; review the styled preview.'
        : bubbleContrast >= 4.5
        ? `Bubble text contrast is at least ${bubbleContrast.toFixed(1)}:1.`
        : `Bubble text contrast falls to ${bubbleContrast.toFixed(1)}:1; review the colours in the preview.`,
    },
    {
      id: 'video-fallback',
      severity: 'warn',
      status: videosMissingFallback ? 'fail' : 'pass',
      message: videosMissingFallback
        ? `${videosMissingFallback} video ${videosMissingFallback === 1 ? 'post needs' : 'posts need'} a description/transcript or caption track.`
        : 'Video posts retain a description/transcript or caption fallback.',
    },
    {
      id: 'mobile-overflow',
      severity: 'warn',
      status: longUnbroken ? 'fail' : 'pass',
      message: longUnbroken ? 'Very long unbroken text may overflow on narrow screens.' : 'No obvious long unbroken text detected.',
    },
    {
      id: 'project-backup',
      severity: 'warn',
      status: hasBackup ? 'pass' : 'fail',
      message: hasBackup ? 'A local project backup has been downloaded.' : 'No local project backup has been recorded for this project.',
    },
    {
      id: 'fallback',
      severity: 'info',
      status: 'pass',
      message: 'A no-skin reading-order preview and transcript are available below.',
    },
  ];
}
