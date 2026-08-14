import { SkinProject } from './schema';
import { Violation } from './siteSkin/ao3Css';
import { getExpiringUrlWarning } from './urlNormalize';
import { contrastRatio } from './siteSkin/colors';
import { resolveTwitterTheme } from './twitter';
import { validateWhatsAppMessage } from './whatsapp';
import { validateIOSMessage } from './ios';

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
    ...(message.whatsappLinkPreview?.image ? [message.whatsappLinkPreview.image] : []),
    ...(message.iosLinkPreview?.image ? [message.iosLinkPreview.image] : []),
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
    && !unsafeIframe
    && !/\sstyle=/i.test(html);
  const whatsappErrors = project.template === 'android'
    ? project.messages.flatMap((message, index) => validateWhatsAppMessage(project, message, index))
    : [];
  const whatsAppMissingFallback = project.template === 'android'
    ? project.messages.filter(message => message.whatsappMedia?.kind === 'audio'
      ? !message.whatsappMedia.transcript?.trim()
      : message.whatsappMedia?.kind === 'video'
        ? !message.whatsappMedia.description?.trim() && (message.whatsappMedia.source === 'youtube' || !message.whatsappMedia.captionTrackUrl)
        : false).length
    : 0;
  const whatsAppMediaUrls = project.template === 'android'
    ? project.messages.flatMap(message => {
        const media = message.whatsappMedia;
        return media ? [media.url, ...(media.kind === 'video' ? [media.posterUrl, ...(media.source === 'direct' ? [media.captionTrackUrl] : [])] : [])].filter((value): value is string => !!value) : [];
      })
    : [];
  const whatsAppExpiring = whatsAppMediaUrls.filter(url => !!getExpiringUrlWarning(url)).length;
  const whatsAppVideosMissingPoster = project.template === 'android'
    ? project.messages.filter(message => message.whatsappMedia?.kind === 'video' && message.whatsappMedia.source === 'direct' && !message.whatsappMedia.posterUrl).length
    : 0;
  const whatsAppPersistentImages = project.template === 'android'
    ? [project.settings.androidWallpaperUrl, project.settings.androidHeaderImageUrl, project.settings.androidFooterImageUrl]
        .filter((value): value is string => !!value)
    : [];
  const whatsAppPersistentExpiring = whatsAppPersistentImages.filter(url => !!getExpiringUrlWarning(url)).length;

  const isIOS = project.template === 'ios';
  const iosErrors = isIOS
    ? project.messages.flatMap((message, index) => validateIOSMessage(project, message, index))
    : [];
  const iosMissingFallback = isIOS
    ? project.messages.filter(message => message.iosMedia?.kind === 'audio'
      ? !message.iosMedia.transcript?.trim()
      : message.iosMedia?.kind === 'video'
        ? !message.iosMedia.description?.trim() && (message.iosMedia.source === 'youtube' || !message.iosMedia.captionTrackUrl)
        : false).length
    : 0;
  const iosMediaUrls = isIOS
    ? project.messages.flatMap(message => {
        const media = message.iosMedia;
        return media ? [media.url, ...(media.kind === 'video' ? [media.posterUrl, ...(media.source === 'direct' ? [media.captionTrackUrl] : [])] : [])].filter((value): value is string => !!value) : [];
      })
    : [];
  const iosExpiring = iosMediaUrls.filter(url => !!getExpiringUrlWarning(url)).length;
  const iosVideosMissingPoster = isIOS
    ? project.messages.filter(message => message.iosMedia?.kind === 'video' && message.iosMedia.source === 'direct' && !message.iosMedia.posterUrl).length
    : 0;
  // External hosts are a standing dependency, not a one-off upload: the app can
  // check the syntax and load a preview, and can promise nothing about whether
  // the host is up or allows AO3 playback a year from now (§9.5).
  const iosMediaHosts = new Set(iosMediaUrls.flatMap(url => {
    try { return [new URL(url).host]; } catch { return []; }
  })).size;
  // Scrolling is a live/Work Text affordance; the raster path flattens it and
  // captures the whole conversation, which is a surprise worth stating rather
  // than a defect (§11.3).
  const iosScrollFlattened = isIOS && project.settings.iosFrameMode === 'phone' && project.settings.iosScrollable === true;

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
      id: 'whatsapp-model',
      severity: 'block',
      status: whatsappErrors.length ? 'fail' : 'pass',
      message: whatsappErrors.length ? `WhatsApp has ${whatsappErrors.length} blocking content issue${whatsappErrors.length === 1 ? '' : 's'}: ${whatsappErrors[0]}` : 'WhatsApp replies, links, media, events, and reactions are valid.',
    },
    {
      id: 'ios-model',
      severity: 'block',
      status: iosErrors.length ? 'fail' : 'pass',
      message: iosErrors.length ? `iMessage has ${iosErrors.length} blocking content issue${iosErrors.length === 1 ? '' : 's'}: ${iosErrors[0]}` : 'iMessage replies, links, media, events, and Tapbacks are valid.',
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
      id: 'whatsapp-media-fallback',
      severity: 'warn',
      status: whatsAppMissingFallback ? 'fail' : 'pass',
      message: whatsAppMissingFallback ? `${whatsAppMissingFallback} WhatsApp media item${whatsAppMissingFallback === 1 ? ' needs' : 's need'} a transcript, description, or caption track.` : 'WhatsApp media has readable fallback context.',
    },
    {
      id: 'whatsapp-video-poster',
      severity: 'warn',
      status: whatsAppVideosMissingPoster ? 'fail' : 'pass',
      message: whatsAppVideosMissingPoster ? `${whatsAppVideosMissingPoster} WhatsApp video${whatsAppVideosMissingPoster === 1 ? ' needs' : 's need'} a poster image for the static preview and PNG.` : 'WhatsApp videos have static poster images.',
    },
    {
      id: 'whatsapp-media-host',
      severity: 'warn',
      status: whatsAppExpiring ? 'fail' : 'pass',
      message: whatsAppExpiring ? `${whatsAppExpiring} WhatsApp media address${whatsAppExpiring === 1 ? '' : 'es'} may expire.` : 'No known expiring WhatsApp media hosts detected.',
    },
    {
      id: 'whatsapp-persistent-image-host',
      severity: 'warn',
      status: whatsAppPersistentExpiring ? 'fail' : 'pass',
      message: whatsAppPersistentExpiring ? `${whatsAppPersistentExpiring} WhatsApp frame or wallpaper image address${whatsAppPersistentExpiring === 1 ? '' : 'es'} may expire.` : 'No known expiring WhatsApp frame or wallpaper hosts detected.',
    },
    {
      id: 'ios-media-fallback',
      severity: 'warn',
      status: iosMissingFallback ? 'fail' : 'pass',
      message: iosMissingFallback ? `${iosMissingFallback} iMessage media item${iosMissingFallback === 1 ? ' needs' : 's need'} a transcript, description, or caption track.` : 'iMessage media has readable fallback context.',
    },
    {
      id: 'ios-video-poster',
      severity: 'warn',
      status: iosVideosMissingPoster ? 'fail' : 'pass',
      message: iosVideosMissingPoster ? `${iosVideosMissingPoster} iMessage video${iosVideosMissingPoster === 1 ? ' needs' : 's need'} a poster image for the static preview and PNG.` : 'iMessage videos have static poster images.',
    },
    {
      id: 'ios-media-host',
      severity: 'warn',
      status: iosExpiring ? 'fail' : 'pass',
      message: iosExpiring ? `${iosExpiring} iMessage media address${iosExpiring === 1 ? '' : 'es'} may expire.` : 'No known expiring iMessage media hosts detected.',
    },
    {
      id: 'ios-media-host-dependence',
      severity: 'warn',
      status: iosMediaHosts ? 'fail' : 'pass',
      message: iosMediaHosts
        ? `Playback depends on ${iosMediaHosts} external host${iosMediaHosts === 1 ? '' : 's'} staying online and allowing anonymous cross-origin requests. This app never copies the media file.`
        : 'This scene depends on no external audio or video host.',
    },
    {
      id: 'ios-scroll-flattened',
      severity: 'warn',
      status: iosScrollFlattened ? 'fail' : 'pass',
      message: iosScrollFlattened
        ? 'The scrollable phone frame is flattened in PNG and hosted-image exports, which capture the whole conversation instead.'
        : 'No scrollable iMessage frame needs flattening for image export.',
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
