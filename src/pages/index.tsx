import React, { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { ProductHead } from '../components/ProductHead';
import { defaultProject, SkinProject, UniversalCharacter, Message } from '../lib/schema';
import { loadStoredProject, persistProject, hasStoredProject } from '../lib/storage';
import { PLATFORM_LOOK } from '../lib/generator';
import { instantiateTemplate, TEMPLATE_EXAMPLES } from '../lib/examples';
import {
  IdentityTarget,
  migrateProjectIdentities,
  normalizeTwitterHandle,
  updateSceneCharacter,
} from '../lib/identity';
import { parseBlankPlatform } from '../lib/deepLinks';
import { trackAnalytics } from '../lib/analytics';
import { ActivationBaseline, activationBaseline, isProjectActivated, markActivatedOnce } from '../lib/activation';
import { loadCharacterLibrary, persistCharacterLibrary } from '../lib/characterStorage';
import { serializeProjectFile, PROJECT_FILE_SCHEMA_VERSION } from '../lib/projectFile';
import { downloadTextFile, safeFilenamePart } from '../lib/download';
import { markProjectBackedUp } from '../lib/backupStatus';
import { appendChatMessage } from '../lib/messageMetadata';
import { migrateTwitterProject, resolveTwitterTheme } from '../lib/twitter';
import { PlatformPicker } from '../components/PlatformPicker';
import { WorkspaceHeader } from '../components/WorkspaceHeader';
import { SettingsSheet } from '../components/SettingsSheet';
import { CastPanel, IdentityPanelMode } from '../components/CastPanel';
import { ComposeBar } from '../components/ComposeBar';
import { MessageTimeline } from '../components/MessageTimeline';
import { ProjectBackupDialog } from '../components/ProjectBackupDialog';
import { ModalDialog } from '../components/ModalDialog';
import { WorkspaceStatusBar } from '../components/WorkspaceStatusBar';
import { isTextEditingTarget, projectStateSnapshot } from '../lib/projectState';

// Lazy load heavy components
const ExportPanel = dynamic(() => import('../components/ExportPanel').then(mod => ({ default: mod.ExportPanel })), {
  ssr: false,
});
const PreviewPane = dynamic(() => import('../components/PreviewPane').then(mod => ({ default: mod.PreviewPane })), {
  ssr: false,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getDarkMode(project: SkinProject): boolean {
  switch (project.template) {
    case 'ios': return !!project.settings.iosDarkMode;
    case 'android': return !!project.settings.androidDarkMode;
    case 'twitter': return resolveTwitterTheme(project.settings) !== 'light';
    default: return false;
  }
}

/**
 * Does every reply still sit after the message it answers?
 *
 * Parameterised over the reply pointer rather than copied per platform. iOS and
 * WhatsApp keep separate reply fields on purpose (§0.1 of the iOS plan), but
 * "a reply comes after its target" is one rule and two copies of it drift.
 */
function replyOrderIsValid(messages: Message[], replyTargetId: (message: Message) => string | undefined): boolean {
  const positions = new Map(messages.map((message, index) => [message.id, index]));
  return messages.every((message, index) => {
    const pointer = replyTargetId(message);
    return !pointer || (positions.get(pointer) ?? index) < index;
  });
}

const whatsappReplyTarget = (message: Message) => message.whatsappReply?.messageId;
const iosReplyTarget = (message: Message) => message.iosReply?.messageId;

/** Would this reordering strand a reply ahead of its target, on any platform? */
function moveKeepsRepliesValid(template: SkinProject['template'], messages: Message[]): boolean {
  if (template === 'android') return replyOrderIsValid(messages, whatsappReplyTarget);
  if (template === 'ios') return replyOrderIsValid(messages, iosReplyTarget);
  return true;
}

export default function HomePage() {
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────────────────────
  const [project, setProject] = useState<SkinProject>(defaultProject());
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPicker, setShowPicker] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'failed'>('saved');
  const [saveError, setSaveError] = useState('');
  const [showCast, setShowCast] = useState(false);
  const [identityPanelMode, setIdentityPanelMode] = useState<IdentityPanelMode>({ kind: 'overview' });
  const [showMobilePreview, setShowMobilePreview] = useState(true);
  const [showBackup, setShowBackup] = useState(false);
  const [pendingTwitterDelete, setPendingTwitterDelete] = useState<string | null>(null);
  const [pendingWhatsAppDelete, setPendingWhatsAppDelete] = useState<string | null>(null);
  const [pendingIOSDelete, setPendingIOSDelete] = useState<string | null>(null);
  // True when the picker was reached from the workspace, i.e. there is work
  // a selection would discard. On a first visit there is nothing to lose.
  const [cameFromWorkspace, setCameFromWorkspace] = useState(false);
  const [protectPickerProject, setProtectPickerProject] = useState(false);

  // Characters
  const [universalCharacters, setUniversalCharacters] = useState<UniversalCharacter[]>([]);

  // Focus / click-to-edit
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  // Undo / redo
  const [history, setHistory] = useState<SkinProject[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const maxHistory = 50;

  // What this project contained when it was handed over, so seeded example
  // content is never counted as the author's work (§5.2). A ref rather than
  // state: it must not trigger a render, and it is read inside the debounce.
  const activationRef = useRef<ActivationBaseline | null>(null);
  const replacementBaselineRef = useRef<string | null>(null);
  const protectUnchangedBaselineRef = useRef(false);

  // Derived
  const dark = getDarkMode(project);
  const pendingDeletedPost = pendingTwitterDelete
    ? project.messages.find(message => message.id === pendingTwitterDelete)
    : undefined;
  const pendingReplyCount = pendingTwitterDelete
    ? project.messages.filter(message => message.parentId === pendingTwitterDelete).length
    : 0;
  const pendingWhatsAppReplyCount = pendingWhatsAppDelete
    ? project.messages.filter(message => message.whatsappReply?.messageId === pendingWhatsAppDelete).length
    : 0;
  const pendingIOSReplyCount = pendingIOSDelete
    ? project.messages.filter(message => message.iosReply?.messageId === pendingIOSDelete).length
    : 0;

  // ── Mount: load characters ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setUniversalCharacters(loadCharacterLibrary());
    // Remember whether the mobile preview was collapsed.
    if (localStorage.getItem('ao3skin_mobile_preview') === 'collapsed') {
      setShowMobilePreview(false);
    }
  }, []);

  // Keep the newest message in view as it's added, or the preview stops being
  // a feedback loop — you type and your message lands below the fold.
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = mobilePreviewRef.current;
    if (!root || !showMobilePreview) return;
    // PreviewPane scrolls in its own inner container, so find whichever
    // element actually overflows rather than assuming it's the wrapper.
    const scroller =
      [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))].find(
        el => el.scrollHeight > el.clientHeight + 1
      ) ?? root;
    scroller.scrollTop = scroller.scrollHeight;
  }, [project.messages.length, showMobilePreview]);

  const toggleMobilePreview = useCallback(() => {
    setShowMobilePreview(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('ao3skin_mobile_preview', next ? 'expanded' : 'collapsed');
      }
      return next;
    });
  }, []);

  // ── Mount: load project from storage or URL ─────────────────────────────
  useEffect(() => {
    if (!router.isReady) return;

    let initial: SkinProject = defaultProject();
    let fromDeepLink = false;
    let returning = false;

    // Check URL for template param
    let templateId = router.query.template as string;
    if (!templateId && typeof window !== 'undefined') {
      templateId = new URLSearchParams(window.location.search).get('template') || '';
    }

    if (templateId) {
      const all = Object.values(TEMPLATE_EXAMPLES).flat();
      const found = all.find(ex => ex.id === templateId);
      if (found) { initial = instantiateTemplate(found); fromDeepLink = true; }
    } else {
      const platform = parseBlankPlatform(router.query.platform);
      if (platform) {
        initial.template = platform;
        if (platform === 'twitter') initial.messages = [];
        Object.assign(initial.settings, PLATFORM_LOOK[platform]);
        fromDeepLink = true;
      } else {
        returning = hasStoredProject();
        initial = loadStoredProject(defaultProject);
      }
    }

    initial = migrateTwitterProject(migrateProjectIdentities(initial));
    // Taken after migration, or the stamped characterIds read as authorship.
    // For a *returning* visitor this baseline is their own saved work, which is
    // correct: activation already happened, and `markActivatedOnce` remembers it.
    activationRef.current = activationBaseline(initial);
    replacementBaselineRef.current = projectStateSnapshot(initial);
    protectUnchangedBaselineRef.current = returning;
    setProject(initial);
    setHistory([initial]);
    setHistoryIndex(0);
    setIsLoaded(true);

    // Skip the picker only for a template link or genuinely saved work.
    // defaultProject() ships with seed messages, so a length check alone would
    // hide the picker from every first-time visitor.
    if (fromDeepLink || returning) {
      setShowPicker(false);
    }

    if (router.query.view === 'export') setShowCodeModal(true);
  }, [router.isReady, router.query]);

  // ── Persist + history ───────────────────────────────────────────────────
  const saveProjectNow = useCallback((candidate: SkinProject) => {
    const result = persistProject(candidate);
    setSaveStatus(result.ok ? 'saved' : 'failed');
    setSaveError(result.ok ? '' : result.message || 'This project could not be saved.');
    return result;
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveProjectNow(project);
      // Activation rides the debounce that already runs on every project
      // change, so there is no second listener to keep in step. Only the
      // platform id is sent; the local UUID never leaves the browser.
      const baseline = activationRef.current;
      if (baseline && isProjectActivated(project, baseline) && markActivatedOnce(project.id)) {
        trackAnalytics({ name: 'project_activated', templateId: project.template });
      }
      if (historyIndex === -1 || JSON.stringify(project) !== JSON.stringify(history[historyIndex])) {
        const next = history.slice(0, historyIndex + 1);
        next.push(project);
        if (next.length > maxHistory) next.shift();
        else setHistoryIndex(historyIndex + 1);
        setHistory(next);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [project, isLoaded, saveProjectNow]);

  const undoProject = useCallback(() => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setProject(history[nextIndex]);
  }, [history, historyIndex]);

  const redoProject = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setProject(history[nextIndex]);
  }, [history, historyIndex]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveProjectNow(project);
      }
      if (isTextEditingTarget(e.target)) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoProject();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        redoProject();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [project, redoProject, saveProjectNow, undoProject]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleSelectPlatform = useCallback((template: 'ios' | 'android' | 'twitter' | 'google') => {
    // Each platform opens wearing its own look, from the one table that holds
    // those values — `PLATFORM_LOOK` in generator.ts, which the master skin uses
    // for the same purpose.
    //
    // This switch used to be a third opinion on the subject, and a wrong one:
    // WhatsApp was `#00A884` on `#1F2C34`, its **dark-theme** colours, applied
    // to a light card — so picking WhatsApp gave a teal bubble on white while
    // the WhatsApp examples used `#dcf8c6` green. One table, one answer.
    let p = defaultProject();
    p.template = template;
    if (template === 'twitter') p.messages = [];
    Object.assign(p.settings, PLATFORM_LOOK[template]);
    p = migrateTwitterProject(migrateProjectIdentities(p));
    activationRef.current = activationBaseline(p);
    replacementBaselineRef.current = projectStateSnapshot(p);
    protectUnchangedBaselineRef.current = false;
    setProject(p);
    setHistory([p]);
    setHistoryIndex(0);
    setShowPicker(false);
    setCameFromWorkspace(false);
    setProtectPickerProject(false);
    trackAnalytics({ name: 'template_selected', templateId: template });
  }, []);

  const handleLoadExample = useCallback((example: SkinProject) => {
    const instantiated = migrateTwitterProject(migrateProjectIdentities(instantiateTemplate(example)));
    // Everything this example ships with is seeded, so none of it is activation.
    activationRef.current = activationBaseline(instantiated);
    replacementBaselineRef.current = projectStateSnapshot(instantiated);
    protectUnchangedBaselineRef.current = false;
    setProject(instantiated);
    setHistory([instantiated]);
    setHistoryIndex(0);
    setShowPicker(false);
    setCameFromWorkspace(false);
    setProtectPickerProject(false);
    trackAnalytics({ name: 'template_selected', templateId: example.id });
  }, []);

  const handleMessageClick = useCallback((messageId: string) => {
    setFocusedMessageId(null);
    requestAnimationFrame(() => {
      setFocusedMessageId(messageId);
      setFocusTrigger(prev => prev + 1);
    });
    setTimeout(() => setFocusedMessageId(null), 3500);
  }, []);

  const MAX_MESSAGES = 100;

  const handleAddMessage = useCallback((msg: Message) => {
    setProject(prev => {
      if (prev.messages.length >= MAX_MESSAGES) return prev;
      const messages = prev.template === 'ios' || prev.template === 'android'
        ? appendChatMessage(prev.messages, msg)
        : [...prev.messages, msg];
      return { ...prev, messages };
    });
  }, []);

  const handleUpdateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setProject(prev => ({
      ...prev,
      messages: prev.messages.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  }, []);

  const deleteMessageWithReplyChoice = useCallback((id: string, choice: 'promote' | 'reparent') => {
    setProject(prev => {
      const deleted = prev.messages.find(message => message.id === id);
      const replacementParentId = choice === 'reparent' ? deleted?.parentId : undefined;
      return {
        ...prev,
        messages: prev.messages
          .filter(message => message.id !== id)
          .map(message => message.parentId === id
            ? {
                ...message,
                parentId: replacementParentId,
                replyToHandles: undefined,
                twitterReplyHandlesMode: replacementParentId ? 'auto' : undefined,
              }
            : message),
      };
    });
    setPendingTwitterDelete(null);
  }, []);

  const handleDeleteMessage = useCallback((id: string) => {
    const replyCount = project.messages.filter(message => message.parentId === id).length;
    if (project.template === 'twitter' && replyCount > 0) {
      setPendingTwitterDelete(id);
      return;
    }
    const whatsappReplyCount = project.messages.filter(message => message.whatsappReply?.messageId === id).length;
    if (project.template === 'android' && whatsappReplyCount > 0) {
      setPendingWhatsAppDelete(id);
      return;
    }
    const iosReplyCount = project.messages.filter(message => message.iosReply?.messageId === id).length;
    if (project.template === 'ios' && iosReplyCount > 0) {
      setPendingIOSDelete(id);
      return;
    }
    deleteMessageWithReplyChoice(id, 'promote');
  }, [deleteMessageWithReplyChoice, project.messages, project.template]);

  const deleteWhatsAppMessageAndReplies = useCallback((id: string) => {
    setProject(previous => ({
      ...previous,
      messages: previous.messages
        .filter(message => message.id !== id)
        .map(message => message.whatsappReply?.messageId === id ? { ...message, whatsappReply: undefined } : message),
    }));
    setPendingWhatsAppDelete(null);
  }, []);

  const deleteIOSMessageAndReplies = useCallback((id: string) => {
    setProject(previous => ({
      ...previous,
      messages: previous.messages
        .filter(message => message.id !== id)
        // Clearing the dependants in the SAME update is the point. Leaving them
        // pointing at a deleted id renders "Original message unavailable" and
        // fails preflight, so a delete would quietly break the export.
        .map(message => message.iosReply?.messageId === id ? { ...message, iosReply: undefined } : message),
    }));
    setPendingIOSDelete(null);
  }, []);

  const handleDuplicateMessage = useCallback((msg: Message) => {
    setProject(prev => {
      const idx = prev.messages.findIndex(m => m.id === msg.id);
      // A duplicate is a new message, so it gets a new id — otherwise two
      // messages share one, and a reply pointing at that id is ambiguous.
      const clone: Message = { ...msg, id: crypto.randomUUID() };
      const msgs = [...prev.messages];
      msgs.splice(idx + 1, 0, clone);
      // The copy sits directly after the original, so its own reply is still
      // valid whenever the original's was — unless the original replied to
      // something that is no longer earlier, which this re-checks rather than
      // assumes.
      if (!moveKeepsRepliesValid(prev.template, msgs)) {
        msgs[idx + 1] = { ...clone, iosReply: undefined, whatsappReply: undefined };
      }
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    setProject(prev => {
      const msgs = [...prev.messages];
      [msgs[index - 1], msgs[index]] = [msgs[index], msgs[index - 1]];
      if (!moveKeepsRepliesValid(prev.template, msgs)) return prev;
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setProject(prev => {
      if (index >= prev.messages.length - 1) return prev;
      const msgs = [...prev.messages];
      [msgs[index], msgs[index + 1]] = [msgs[index + 1], msgs[index]];
      if (!moveKeepsRepliesValid(prev.template, msgs)) return prev;
      return { ...prev, messages: msgs };
    });
  }, []);

  const handleUpdateSettings = useCallback(<K extends keyof typeof project.settings>(key: K, value: typeof project.settings[K]) => {
    setProject(prev => {
      const withSetting = { ...prev, settings: { ...prev.settings, [key]: value } };
      const identityUpdate =
        key === 'chatYourName' ? { id: prev.cast?.selfId, updates: { name: String(value || '') } }
        : key === 'iosContactName' || key === 'androidContactName'
          ? { id: prev.cast?.contactId, updates: { name: String(value || '') } }
        : key === 'iosAvatarUrl' || key === 'androidAvatarUrl'
          ? { id: prev.cast?.contactId, updates: { avatarUrl: String(value || '') } }
        : key === 'twitterDisplayName'
          ? { id: prev.cast?.twitterPrimaryId, updates: { name: String(value || '') } }
        : key === 'twitterHandle'
          ? { id: prev.cast?.twitterPrimaryId, updates: { twitterHandle: normalizeTwitterHandle(String(value || '')) } }
        : key === 'twitterAvatarUrl'
          ? { id: prev.cast?.twitterPrimaryId, updates: { avatarUrl: String(value || '') } }
        : key === 'twitterVerified'
          ? { id: prev.cast?.twitterPrimaryId, updates: { verified: Boolean(value) } }
        : undefined;
      return identityUpdate?.id
        ? updateSceneCharacter(withSetting, identityUpdate.id, identityUpdate.updates)
        : withSetting;
    });
  }, []);

  const openIdentityOverview = useCallback(() => {
    if (project.template === 'google') return;
    setIdentityPanelMode({ kind: 'overview' });
    setShowCast(true);
  }, [project.template]);

  const openIdentityEditor = useCallback((target: IdentityTarget) => {
    if (project.template === 'google') return;
    setIdentityPanelMode({ kind: 'edit', target });
    setShowCast(true);
  }, [project.template]);

  const openIdentityCreate = useCallback(() => {
    if (project.template === 'google') return;
    const isGroup = project.template === 'ios'
      ? !!project.settings.iosGroupMode
      : project.template === 'android'
        ? !!project.settings.androidGroupMode
        : false;
    setIdentityPanelMode({
      kind: 'create',
      suggestedRole: project.template === 'twitter' ? 'account' : isGroup ? 'participant' : 'contact',
    });
    setShowCast(true);
  }, [project.template, project.settings.iosGroupMode, project.settings.androidGroupMode]);

  // ── Character handlers ──────────────────────────────────────────────────
  const saveChars = (chars: UniversalCharacter[]) => {
    persistCharacterLibrary(chars);
  };
  const handleAddCharacter = (c: UniversalCharacter) => {
    const u = [...universalCharacters, c]; setUniversalCharacters(u); saveChars(u);
  };
  const handleUpdateCharacter = (id: string, updates: Partial<UniversalCharacter>) => {
    const u = universalCharacters.map(c => c.id === id ? { ...c, ...updates } : c);
    setUniversalCharacters(u); saveChars(u);
  };
  const handleDeleteCharacter = (id: string) => {
    const u = universalCharacters.filter(c => c.id !== id);
    setUniversalCharacters(u); saveChars(u);
  };

  const handleDownloadProjectBackup = useCallback((suffix = ''): boolean => {
    const stamp = new Date().toISOString().slice(0, 10);
    const projectLabel = project.template === 'ios'
      ? (project.settings.iosGroupMode ? project.settings.iosGroupName : project.settings.iosContactName)
      : project.template === 'android'
      ? (project.settings.androidGroupMode ? project.settings.androidGroupName : project.settings.androidContactName)
      : project.template === 'twitter'
      ? project.settings.twitterDisplayName
      : project.settings.googleQuery;
    const label = safeFilenamePart(projectLabel || project.template);
    const filename = `ao3skingen-${label}-${stamp}${suffix ? `-${safeFilenamePart(suffix)}` : ''}.json`;
    const ok = downloadTextFile(serializeProjectFile(project, universalCharacters), filename);
    if (ok) {
      markProjectBackedUp(project);
      trackAnalytics({ name: 'project_backup_exported', schemaVersion: PROJECT_FILE_SCHEMA_VERSION });
    }
    return ok;
  }, [project, universalCharacters]);

  const handleReplaceFromBackup = useCallback((nextProject: SkinProject, characters: UniversalCharacter[]) => {
    // An imported backup is finished work, not a seed. Baselining it means the
    // import alone does not fire activation; the next real edit does.
    activationRef.current = activationBaseline(nextProject);
    replacementBaselineRef.current = projectStateSnapshot(nextProject);
    protectUnchangedBaselineRef.current = true;
    setProject(nextProject);
    setHistory([nextProject]);
    setHistoryIndex(0);
    setUniversalCharacters(characters);
    persistCharacterLibrary(characters);
    setShowPicker(false);
    setCameFromWorkspace(false);
  }, []);

  /**
   * Renaming the other person rewrites the messages they have already sent.
   *
   * Their name is stamped onto each incoming message at send time (ComposeBar),
   * and it is what a reader sees with the skin off or in a downloaded ebook.
   * Changing the setting alone would leave every existing bubble labelled with
   * the old name — the header would say Steve and the work would still read
   * "Bucky: …".
   *
   * Only *untouched* messages are rewritten. Anything explicitly assigned to a
   * group participant belongs to that participant, and anything already bearing
   * a different name was deliberately set to it.
   */
  const handleRenameContact = useCallback((name: string) => {
    setProject(prev => {
      const key = prev.template === 'ios' ? 'iosContactName' : 'androidContactName';
      const previous =
        (prev.settings as any)[key] || prev.settings.chatContactName || 'Them';
      const legacyUpdated = {
        ...prev,
        settings: { ...prev.settings, [key]: name },
        messages: prev.messages.map(m =>
          !m.outgoing && !m.participantId && (!m.sender || m.sender === previous)
            ? { ...m, sender: name }
            : m
        ),
      };
      return prev.cast?.contactId
        ? updateSceneCharacter(legacyUpdated, prev.cast.contactId, { name })
        : legacyUpdated;
    });
  }, []);

  // The compose roster is project-scoped. Library characters appear only after
  // an explicit copy into this scene, and IDs keep duplicate names distinct.
  const twitterCharacters = React.useMemo(() => {
    if (project.template !== 'twitter') return [];
    return (project.cast?.characters || [])
      .filter(character => character.id !== project.cast?.twitterPrimaryId && !character.archived)
      .map(character => ({
        id: character.id,
        name: character.name,
        handle: normalizeTwitterHandle(character.twitterHandle) || character.name.toLowerCase().replace(/\s+/g, ''),
        avatarUrl: character.avatarUrl,
        verified: character.verified,
      }));
  }, [project.template, project.cast]);

  // ── Render ───────────────────────────────────────────────────────────────
  // Derive the contact name from the correct per-template settings field
  // The header title edits one field per template — the one that names the
  // thing on screen. Twitter uses the display name rather than the handle:
  // the handle is still in Settings, and a tweet leads with the name.
  //
  // In group mode the header renders the GROUP's name, not the contact's — so
  // this used to edit a field nothing on screen was showing. Turn group chat on
  // and the title control silently stopped matching the preview.
  const isGroupChat =
    (project.template === 'ios' && !!project.settings.iosGroupMode) ||
    (project.template === 'android' && !!project.settings.androidGroupMode);

  const contactNameKey =
    project.template === 'ios'
      ? (project.settings.iosGroupMode ? 'iosGroupName' : 'iosContactName')
      : project.template === 'android'
      ? (project.settings.androidGroupMode ? 'androidGroupName' : 'androidContactName')
      : project.template === 'twitter' ? 'twitterDisplayName'
      : 'googleQuery';
  const displayContactName = (project.settings as any)[contactNameKey] || '';

  // The header can't see settings, so the label that describes what the title
  // is currently editing has to be computed here.
  const headerFieldLabel = isGroupChat
    ? 'Group name'
    : project.template === 'ios' || project.template === 'android'
    ? 'Contact name'
    : project.template === 'twitter' ? 'Display name'
    : 'Search query';
  const headerFieldPlaceholder = isGroupChat
    ? (project.template === 'ios' ? 'Family Chat' : 'Work Team')
    : undefined;

  /**
   * The workspace is exactly one viewport tall and scrolls internally, so the
   * document must not scroll. When it does, the whole app slides up and leaves
   * a blank strip under it — the header stays put (sticky) and the export bar
   * stays put (fixed), so all a reader sees is the editor scrolling away into
   * nothing. Worst on Google, whose scene is the tallest relative to its
   * preview column.
   *
   * Locking the document rather than the shell is deliberate: the overflow
   * that starts it is not always inside our tree. Next's route announcer and
   * the dev error-overlay portal are siblings of #__next, and a few pixels of
   * either are enough to arm the page scroll. `overflow: hidden` on the shell
   * cannot clip a sibling; only the document can.
   *
   * The lock lives on <html>, not <body>, because BottomSheet already owns
   * body.overflow while a sheet is open and clears it on close — sharing one
   * property would have the sheet unlock the page every time it shut.
   *
   * Scoped to the workspace: the platform picker returns before this runs its
   * course, and it is a legitimately tall, scrolling page.
   */
  useEffect(() => {
    if (!isLoaded || showPicker) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => { root.style.overflow = previous; };
  }, [isLoaded, showPicker]);

  const head = (
    <ProductHead
      title="AO3 Work Skin & Fake Screenshot Generator — AO3 SkinGen"
      description="Create fictional social-media scenes, download images, or copy AO3-compatible work-skin HTML and CSS. Free, unofficial, and no signup required."
    />
  );

  // Hold the first paint until storage has been read, so returning visitors
  // don't see the picker flash past before it's dismissed.
  if (!isLoaded) {
    return <>{head}<div className="min-h-screen bg-stone-50" aria-busy="true"><h1 className="sr-only">AO3 SkinGen</h1></div></>;
  }

  if (showPicker) {
    return <>{head}<PlatformPicker
      onSelectPlatform={handleSelectPlatform}
      onLoadExample={handleLoadExample}
      canReturnToProject={cameFromWorkspace}
      protectCurrentProject={cameFromWorkspace && protectPickerProject}
      onCancel={() => { setCameFromWorkspace(false); setProtectPickerProject(false); setShowPicker(false); }}
    /></>;
  }

  return (
    <>
    {head}
    <div className="flex h-screen h-[100dvh] flex-col bg-stone-50 font-sans">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <WorkspaceHeader
        contactName={displayContactName}
        onContactNameChange={(name) =>
          // Only the 1-on-1 chat case rewrites existing messages. A group name
          // labels nobody, and Twitter/Google are plain settings writes.
          (project.template === 'ios' || project.template === 'android') && !isGroupChat
            ? handleRenameContact(name)
            : handleUpdateSettings(contactNameKey as any, name)
        }
        onBack={() => {
          const currentChanged = replacementBaselineRef.current !== projectStateSnapshot(project);
          setProtectPickerProject(protectUnchangedBaselineRef.current || currentChanged);
          setCameFromWorkspace(true);
          setShowPicker(true);
        }}
        onSettingsOpen={() => setShowSettings(true)}
        onCastOpen={openIdentityOverview}
        onIdentityOpen={() => {
          if (project.template === 'twitter') openIdentityEditor({ kind: 'twitter-primary' });
          else if (project.template === 'ios' || project.template === 'android') {
            if (isGroupChat) openIdentityOverview();
            else openIdentityEditor({ kind: 'contact' });
          }
        }}
        onBackupOpen={() => setShowBackup(true)}
        template={project.template}
        messageCount={project.messages.length}
        fieldLabel={headerFieldLabel}
        fieldPlaceholder={headerFieldPlaceholder}
      />

      {/* A refused save means this work disappears on reload, so it is worth
          interrupting for rather than logging to a console nobody opens. */}
      {saveStatus === 'failed' && saveError && (
        <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-2">
          <p className="text-xs text-amber-900 max-w-screen-xl mx-auto">{saveError}</p>
        </div>
      )}

      {/* ─── Main content ───────────────────────────────────────────── */}
      {/* Bottom padding reserves room for the fixed export bar, which would
          otherwise cover the compose input. ExportPanel publishes its own
          measured height as --export-bar-h. */}
      <div
        className="flex-1 min-h-0 flex overflow-hidden"
        style={{ paddingBottom: 'calc(var(--export-bar-h, 0px) + var(--analytics-consent-h, 0px))' }}
      >
        {/* Left / mobile-full: compose area */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0">
          <WorkspaceStatusBar
            saveStatus={saveStatus}
            canUndo={historyIndex > 0}
            canRedo={historyIndex < history.length - 1}
            onUndo={undoProject}
            onRedo={redoProject}
          />
          <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3 pb-4">
            {/* The query is the one thing on a Google scene that is not a
                message, and its only control used to be the header title —
                which reads "Google" until you have typed something, so it
                looked like the platform's name rather than an editable field.
                It belongs above the results for the same reason it sits above
                them on screen. */}
            {project.template === 'google' && (
              <div className="mb-3 rounded-xl border border-stone-200 bg-white p-3">
                <label
                  htmlFor="google-search-query"
                  className="block text-[10px] font-medium uppercase tracking-wide text-stone-500"
                >
                  Search query
                </label>
                <input
                  id="google-search-query"
                  value={project.settings.googleQuery || ''}
                  onChange={(e) => handleUpdateSettings('googleQuery', e.target.value)}
                  placeholder="What was searched for"
                  className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                />
                <p className="mt-1.5 text-[11px] text-stone-400">
                  Shown in the search box — and what the &ldquo;About N results&rdquo; line is derived from.
                </p>
              </div>
            )}
            <MessageTimeline
              messages={project.messages}
              template={project.template}
              settings={project.settings}
              project={project}
              onIdentityClick={openIdentityEditor}
              focusedMessageId={focusedMessageId}
              focusTrigger={focusTrigger}
              onUpdateMessage={handleUpdateMessage}
              onDeleteMessage={handleDeleteMessage}
              onDuplicateMessage={handleDuplicateMessage}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>

          {/* ─── Mobile live preview (desktop uses the column on the right) ── */}
          <div className="md:hidden flex min-h-0 flex-col flex-shrink border-t border-stone-200 bg-white">
            <button
              type="button"
              onClick={toggleMobilePreview}
              aria-expanded={showMobilePreview}
              aria-controls="mobile-preview-body"
              className="flex items-center justify-between px-4 py-2 text-left"
            >
              <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                Preview
              </span>
              <span className="flex items-center gap-2">
                {project.messages.length > 0 && (
                  <span className="text-xs text-violet-600 font-medium">
                    {project.messages.length} messages
                  </span>
                )}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-stone-400 transition-transform ${showMobilePreview ? '' : 'rotate-180'}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            {showMobilePreview && (
              <div
                id="mobile-preview-body"
                ref={mobilePreviewRef}
                className="h-[38vh] min-h-[160px] overflow-y-auto border-t border-stone-100"
              >
                <PreviewPane
                  project={project}
                  mobile={true}
                  dark={dark}
                  onMessageClick={handleMessageClick}
                  onIdentityClick={(target) => target ? openIdentityEditor(target) : openIdentityOverview()}
                  editModeEnabled={true}
                />
              </div>
            )}
          </div>

          {/* Compose bar */}
          <ComposeBar
            template={project.template}
            settings={project.settings}
            messages={project.messages}
            project={project}
            cast={project.cast}
            onAddMessage={handleAddMessage}
            twitterCharacters={twitterCharacters}
            onAddIdentity={openIdentityCreate}
            onEditActiveIdentity={(target) => {
              if (target.kind === 'character' && target.id) openIdentityEditor({ kind: 'character', id: target.id });
              else if (target.kind === 'twitter-primary') openIdentityEditor({ kind: 'twitter-primary' });
              else if (target.kind === 'self') openIdentityEditor({ kind: 'self' });
              else if (target.kind === 'contact') openIdentityEditor({ kind: 'contact' });
            }}
          />
        </div>

        {/* Right: preview (desktop only, ≥768px) */}
        <div className="hidden md:flex flex-col w-[420px] border-l border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-2 border-b border-stone-100">
            <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">Preview</span>
            {project.messages.length > 0 && (
              <span className="text-xs text-violet-600 font-medium">
                {project.messages.length} messages
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <PreviewPane
              project={project}
              mobile={true}
              dark={dark}
              onMessageClick={handleMessageClick}
              onIdentityClick={(target) => target ? openIdentityEditor(target) : openIdentityOverview()}
              editModeEnabled={true}
            />
          </div>
        </div>
      </div>

      {/* ─── Hidden preview for mobile export capture ───────────────────
          Only needed when the visible mobile preview is collapsed — export
          measures #workskin, and rendering both would duplicate the work. */}
      {!showMobilePreview && (
        <div className="md:hidden fixed -left-[9999px] top-0" aria-hidden="true">
          <PreviewPane
            project={project}
            mobile={true}
            dark={dark}
          />
        </div>
      )}

      {/* ─── Character Library ────────────────────────────────────── */}
      {/* ─── People / Cast panel ────────────────────────────────────── */}
      {/* Google never opens this — its header button still goes to the
          Character Library, which is the only place that feature is reachable
          from and is genuinely useful there. */}
      <CastPanel
        isOpen={showCast}
        onClose={() => setShowCast(false)}
        project={project}
        mode={identityPanelMode}
        onModeChange={setIdentityPanelMode}
        onChangeProject={(updater) => setProject(previous => updater(previous))}
        characters={universalCharacters}
        onAddLibraryCharacter={handleAddCharacter}
        onUpdateLibraryCharacter={handleUpdateCharacter}
        onDeleteLibraryCharacter={handleDeleteCharacter}
      />

      {/* ─── Settings sheet ─────────────────────────────────────────── */}
      <SettingsSheet
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        template={project.template}
        settings={project.settings}
        messageCount={project.messages.length}
        onUpdateSettings={handleUpdateSettings}
      />

      {pendingTwitterDelete && pendingDeletedPost && (
        <ModalDialog isOpen={true} onClose={() => setPendingTwitterDelete(null)} labelledBy="delete-twitter-title" maxWidthClass="max-w-md">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-twitter-title" className="text-base font-semibold text-stone-900">Delete a post with replies?</h2>
            <p className="mt-2 text-sm text-stone-600">This post has {pendingReplyCount} direct {pendingReplyCount === 1 ? 'reply' : 'replies'}. Choose what happens to them; deeper reply relationships are preserved.</p>
            <div className="mt-4 space-y-2">
              {pendingDeletedPost.parentId && (
                <button type="button" onClick={() => deleteMessageWithReplyChoice(pendingTwitterDelete, 'reparent')} className="w-full rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-left text-sm font-medium text-violet-800">
                  Reparent replies to the deleted post’s parent
                </button>
              )}
              <button type="button" onClick={() => deleteMessageWithReplyChoice(pendingTwitterDelete, 'promote')} className="w-full rounded-lg border border-stone-200 px-4 py-3 text-left text-sm font-medium text-stone-800">
                Promote replies to top-level posts
              </button>
            </div>
            <button type="button" data-autofocus onClick={() => setPendingTwitterDelete(null)} className="mt-4 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Cancel</button>
          </div>
        </ModalDialog>
      )}

      {pendingWhatsAppDelete && (
        <ModalDialog isOpen={true} onClose={() => setPendingWhatsAppDelete(null)} labelledBy="delete-whatsapp-title" maxWidthClass="max-w-md">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-whatsapp-title" className="text-base font-semibold text-stone-900">Delete a replied-to message?</h2>
            <p className="mt-2 text-sm text-stone-600">{pendingWhatsAppReplyCount} later {pendingWhatsAppReplyCount === 1 ? 'message replies' : 'messages reply'} to it. Deleting it will remove those reply previews, but keep the later messages.</p>
            <button type="button" onClick={() => deleteWhatsAppMessageAndReplies(pendingWhatsAppDelete)} className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">Delete and remove reply previews</button>
            <button type="button" data-autofocus onClick={() => setPendingWhatsAppDelete(null)} className="mt-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Cancel</button>
          </div>
        </ModalDialog>
      )}

      {pendingIOSDelete && (
        <ModalDialog isOpen={true} onClose={() => setPendingIOSDelete(null)} labelledBy="delete-ios-title" maxWidthClass="max-w-md">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 id="delete-ios-title" className="text-base font-semibold text-stone-900">Delete a replied-to message?</h2>
            <p className="mt-2 text-sm text-stone-600">{pendingIOSReplyCount} later {pendingIOSReplyCount === 1 ? 'message replies' : 'messages reply'} to it. Deleting it will remove those reply previews, but keep the later messages.</p>
            <button type="button" onClick={() => deleteIOSMessageAndReplies(pendingIOSDelete)} className="mt-4 w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-800">Delete and remove reply previews</button>
            <button type="button" data-autofocus onClick={() => setPendingIOSDelete(null)} className="mt-3 rounded-lg px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">Cancel</button>
          </div>
        </ModalDialog>
      )}

      {/* ─── Export bar (sticky bottom) ─────────────────────────────── */}
      <ExportPanel
        project={project}
        showCodeModal={showCodeModal}
        setShowCodeModal={setShowCodeModal}
        onBackupProject={handleDownloadProjectBackup}
      />

      <ProjectBackupDialog
        isOpen={showBackup}
        onClose={() => setShowBackup(false)}
        onDownloadCurrent={handleDownloadProjectBackup}
        onReplace={handleReplaceFromBackup}
      />

    </div>
    </>
  );
}
