"use client";

import { useCallback, useEffect, useState } from "react";

export interface IptvLine {
  host: string;
  user: string;
  pass: string;
}

const KEY = "iqraprime:iptv-line";

export function encodeLine(l: IptvLine): string {
  return btoa(JSON.stringify(l));
}

export function readLine(): IptvLine | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const l = JSON.parse(raw) as IptvLine;
    return l.host && l.user && l.pass ? l : null;
  } catch {
    return null;
  }
}

export function saveLine(l: IptvLine | null) {
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new CustomEvent("iqraprime:line-changed"));
  } catch { /* ignore */ }
}

export interface PingResult {
  auth: boolean;
  status?: string | null;
  expiry?: string | null;
  username?: string;
  host?: string;
  error?: string;
}

/** Shared IPTV line state (localStorage-backed) + server reachability ping. */
export function useIptvLine() {
  const [line, setLineState] = useState<IptvLine | null>(null);
  const [ready, setReady] = useState(false);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [checking, setChecking] = useState(false);

  const refresh = useCallback(async () => {
    const l = readLine();
    setLineState(l);
    if (!l) {
      // no user line — maybe env line exists; server ping tells us
      setChecking(true);
      try {
        const r = await fetch("/api/xtream/ping", { cache: "no-store" });
        setPing((await r.json()) as PingResult);
      } catch {
        setPing(null);
      }
      setChecking(false);
      return;
    }
    setChecking(true);
    try {
      const r = await fetch("/api/xtream/ping", {
        headers: { "x-iptv-line": encodeLine(l) },
        cache: "no-store",
      });
      setPing((await r.json()) as PingResult);
    } catch {
      setPing(null);
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

  const connected = Boolean(line || ping?.auth);

  return { line, ready, ping, checking, connected, refresh, saveLine };
}
