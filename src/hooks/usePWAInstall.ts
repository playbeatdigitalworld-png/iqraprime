import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 * `beforeinstallprompt` fires at most once per page load. Components that
 * remount later (e.g. HomePage / DashboardPage after tab switches) previously
 * missed the event and silently lost their install button. The prompt is now
 * cached at module level and shared by every hook instance, so the install
 * button is available wherever it mounts. Public hook API is unchanged.
 */
let cachedPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

function setCachedPrompt(e: BeforeInstallPromptEvent | null) {
  cachedPrompt = e;
  subscribers.forEach((notify) => notify());
}

export function usePWAInstall() {
  const [promptVersion, setPromptVersion] = useState(0);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setCachedPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setCachedPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Sync with any event captured before this instance mounted
    const notify = () => setPromptVersion((v) => v + 1);
    subscribers.add(notify);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      subscribers.delete(notify);
    };
  }, []);

  const install = async () => {
    if (!cachedPrompt) return false;
    const prompt = cachedPrompt;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCachedPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!cachedPrompt,
    // promptVersion participates in render so late event capture re-renders
    // every mounted instance (referenced to keep the linter honest).
    promptVersion,
    isInstalled,
    isIOS,
    install,
  };
}
