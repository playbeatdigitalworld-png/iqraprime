"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const BIP_KEY = "iqraprime:deferred-bip";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true
  );
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOSDevice = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
  return iOSDevice;
}

/**
 * Shared PWA install logic for IQRAPRIME.
 * - Captures beforeinstallprompt and defers it
 * - Exposes install() that triggers the native prompt
 * - On iOS Safari (no beforeinstallprompt), opens the guided modal
 * - Detects already-installed via display-mode / navigator.standalone
 * - Listens for appinstalled
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [iosGuided, setIosGuided] = useState(false);
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | null>(null);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBip = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      (window as unknown as { [k: string]: unknown })[BIP_KEY] = bip;
      setDeferred(bip);
      setAvailable(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setAvailable(false);
      setDeferred(null);
      setOutcome("accepted");
    };

    const onDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onDisplayChange);
    };
  }, []);

  const install = useCallback(async () => {
    if (installed) return;
    const bip =
      deferred ||
      ((window as unknown as { [k: string]: unknown })[BIP_KEY] as BeforeInstallPromptEvent | undefined) ||
      null;
    if (bip) {
      try {
        await bip.prompt();
        const choice = await bip.userChoice;
        setOutcome(choice.outcome as "accepted" | "dismissed");
        if (choice.outcome === "accepted") setInstalled(true);
        setDeferred(null);
        setAvailable(false);
        (window as unknown as { [k: string]: unknown })[BIP_KEY] = null;
        return;
      } catch {
        /* fall through to iOS guidance */
      }
    }
    if (isIOS()) {
      setIosGuided(true);
      return;
    }
    // Desktop browsers without BIP: open gentle guidance modal too
    setIosGuided(true);
  }, [deferred, installed]);

  const dismissGuided = useCallback(() => setIosGuided(false), []);

  return { available, installed, iosGuided, outcome, install, dismissGuided, isIOS };
}
