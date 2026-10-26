"use client";

import { useCallback, useEffect, useState } from "react";
import { activeLine, checkAuth, normalizeLine, type AuthInfo, type IptvLine } from "@/lib/iptv-client";

const KEY = "iqraprime:iptv-line";

export function readLine(): IptvLine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return activeLine();
    const l = normalizeLine(JSON.parse(raw) as Partial<IptvLine>);
    return l || activeLine();
  } catch {
    return activeLine();
  }
}

export function readSavedLine(): IptvLine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalizeLine(JSON.parse(raw) as Partial<IptvLine>);
  } catch {
    return null;
  }
}

export function saveLine(l: IptvLine) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
    window.dispatchEvent(new CustomEvent("iqraprime:line-changed"));
  } catch { /* ignore */ }
}

export function resetLine() {
  try {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("iqraprime:line-changed"));
  } catch { /* ignore */ }
}

export type { IptvLine };
export type { AuthInfo };

export interface PingResult extends AuthInfo {
  host?: string;
  error?: string;
}

/** IPTV line state: default line is built into the app; users may override per device. */
export function useIptvLine() {
  const [line, setLineState] = useState<IptvLine | null>(null);
  const [ready, setReady] = useState(false);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    const l = readLine();
    setLineState(l);
    if (!l) {
      setPing(null);
      return;
    }
    setChecking(true);
    try {
      const info = await checkAuth(l);
      setPing(info.auth ? { ...info, host: l.host } : { auth: false, error: "rejected", host: l.host });
    } catch (e) {
      setPing({ auth: false, error: (e as Error & { code?: string })?.code || "error", host: l.host });
    }
    setChecking(false);
  }, []);

  useEffect(() => {
    setLineState(readLine());
    setReady(true);
    void refresh();
    const onChange = () => void refresh();
    window.addEventListener("iqraprime:line-changed", onChange);
    return () => window.removeEventListener("iqraprime:line-changed", onChange);
  }, [refresh]);

  const connected = Boolean(line && ping?.auth);
  // "connected" stays true while checking on first paint so the UI doesn't flicker;
  // strict gating happens in views that actually need data.
  const connectedSoft = Boolean(line) && (ping === null || checking || ping.auth);

  return { line, ready, ping, checking, connected, connectedSoft, refresh, saveLine, resetLine };
}
