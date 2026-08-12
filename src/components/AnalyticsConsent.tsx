import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AnalyticsConsent as ConsentValue,
  getAnalyticsConsent,
  loadAnalytics,
  OPEN_PRIVACY_CHOICES_EVENT,
  setAnalyticsConsent,
  trackAnalytics,
  trackPageView,
} from '../lib/analytics';

export function AnalyticsConsent() {
  const router = useRouter();
  const [consent, setConsent] = useState<ConsentValue | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const firstChoiceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const stored = getAnalyticsConsent();
    setConsent(stored);
    setOpen(stored === null);
  }, []);

  useEffect(() => {
    const handleOpenPrivacyChoices = () => setOpen(true);
    window.addEventListener(OPEN_PRIVACY_CHOICES_EVENT, handleOpenPrivacyChoices);
    return () => window.removeEventListener(OPEN_PRIVACY_CHOICES_EVENT, handleOpenPrivacyChoices);
  }, []);

  useEffect(() => {
    if (consent !== 'granted' || !loadAnalytics()) return;
    const recordRoute = (path: string) => {
      trackPageView(path);
      trackAnalytics({ name: 'tool_viewed', tool: path.startsWith('/site-skin') ? 'site_skin' : 'scene_builder' });
    };
    recordRoute(router.asPath);
    router.events.on('routeChangeComplete', recordRoute);
    return () => router.events.off('routeChangeComplete', recordRoute);
  }, [consent, router]);

  useEffect(() => {
    const element = firstChoiceRef.current;
    if (!element || !open || consent !== null) {
      document.documentElement.style.removeProperty('--analytics-consent-h');
      return;
    }
    const publish = () => document.documentElement.style.setProperty(
      '--analytics-consent-h',
      `${Math.ceil(element.getBoundingClientRect().height) + 24}px`
    );
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--analytics-consent-h');
    };
  }, [consent, open]);

  if (consent === undefined) return null;

  const choose = (value: ConsentValue) => {
    setAnalyticsConsent(value);
    setConsent(value);
    setOpen(false);
  };

  const choicePanel = (
    <div className="w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
      <h2 id="analytics-consent-title" className="text-base font-semibold text-stone-900">Optional analytics</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">
        If you accept, Google Analytics counts content-free actions such as choosing a tool or completing an export. We never send story text, names, image addresses, uploaded files, or generated code.
      </p>
      <p className="mt-2 text-xs text-stone-500">
        Analytics stays off unless you choose “Allow analytics.” You can change this later from the Privacy button.
      </p>
      <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <button type="button" onClick={() => choose('denied')} className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          Don’t allow
        </button>
        <button type="button" onClick={() => choose('granted')} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          Allow analytics
        </button>
      </div>
      {consent !== null && (
        <button type="button" onClick={() => setOpen(false)} className="mt-3 w-full text-center text-xs text-stone-500 hover:text-stone-700">Close without changing</button>
      )}
      <a href="/privacy-policy.html" className="mt-3 block text-center text-xs text-violet-700 hover:underline">Read the privacy policy</a>
    </div>
  );

  return (
    <>
      {open && consent === null && (
        <aside ref={firstChoiceRef} className="fixed inset-x-3 bottom-3 z-[40] flex justify-center" aria-labelledby="analytics-consent-title">
          <div className="w-full max-w-4xl rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl sm:flex sm:items-center sm:gap-5">
            <div className="min-w-0 flex-1">
              <h2 id="analytics-consent-title" className="text-sm font-semibold text-stone-900">Optional analytics</h2>
              <p className="mt-1 text-xs leading-relaxed text-stone-600">
                Optional Google Analytics counts content-free actions. It never receives story text, names, image addresses, uploaded files, or generated code. Analytics stays off unless you allow it.
              </p>
              <a href="/privacy-policy.html" className="mt-1 inline-block text-xs text-violet-700 hover:underline">Privacy details</a>
            </div>
            <div className="mt-3 flex flex-shrink-0 gap-2 sm:mt-0">
              <button type="button" onClick={() => choose('denied')} className="flex-1 rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50 sm:flex-none">
                Don’t allow
              </button>
              <button type="button" onClick={() => choose('granted')} className="flex-1 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 sm:flex-none">
                Allow analytics
              </button>
            </div>
          </div>
        </aside>
      )}
      {open && consent !== null && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/30 p-3" role="dialog" aria-modal="true" aria-labelledby="analytics-consent-title">
          {choicePanel}
        </div>
      )}
    </>
  );
}
