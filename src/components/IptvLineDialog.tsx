"use client";

import { useEffect, useState } from "react";
import { encodeLine, saveLine, type IptvLine } from "@/hooks/useIptvLine";

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: IptvLine | null;
  onSaved?: () => void;
}

const DEFAULT_HOST = "stream.playbeat.live:8880";

/** Connect your own IPTV (Xtream Codes) line — stored on this device only. */
export default function IptvLineDialog({ open, onClose, initial, onSaved }: Props) {
  const [host, setHost] = useState(initial?.host || DEFAULT_HOST);
  const [user, setUser] = useState(initial?.user || "");
  const [pass, setPass] = useState(initial?.pass || "");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (open) {
      setHost(initial?.host || DEFAULT_HOST);
      setUser(initial?.user || "");
      setPass(initial?.pass || "");
      setResult(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const r = await fetch("/api/xtream/ping", {
        headers: { "x-iptv-line": encodeLine({ host, user, pass }) },
        cache: "no-store",
      });
      const d = (await r.json()) as { auth?: boolean; status?: string; expiry?: string | null; error?: string };
      if (d.auth) {
        setResult({ ok: true, msg: `Line connected — status ${d.status || "Active"}${d.expiry ? `, valid till ${new Date(d.expiry).toLocaleDateString()}` : ""}` });
      } else {
        setResult({ ok: false, msg: d.error === "provider_error" || !d.error ? "Could not reach provider — check host." : `Line rejected: ${d.error}` });
      }
    } catch {
      setResult({ ok: false, msg: "Network error while contacting provider." });
    }
    setTesting(false);
  };

  const save = () => {
    saveLine({ host, user, pass });
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="line-title" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-gold/30 bg-navy p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="line-title" className="font-display text-xl font-bold text-white">
          Connect <span className="text-gold">IPTV Line</span>
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-mist">
          Enter your Xtream Codes line from your provider panel. Unlocks the full movies & web-series
          library with real playback. Stored on this device only.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-gold">Server / Host</span>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="http://host:port"
              className="mt-1 w-full rounded-lg border border-gold/25 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gold">Username</span>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-gold/25 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-gold">Password</span>
            <input
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              type="password"
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-gold/25 bg-ink px-3 py-2 text-sm text-white outline-none focus:border-gold"
            />
          </label>
        </div>

        {result && (
          <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${result.ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300"}`}>
            {result.msg}
          </p>
        )}

        <div className="mt-5 flex items-center gap-2.5">
          <button onClick={test} disabled={testing || !host || !user || !pass} className="btn-ghost flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            {testing ? "Testing…" : "Test line"}
          </button>
          <button onClick={save} disabled={!host || !user || !pass} className="btn-gold flex-1 rounded-lg px-4 py-2.5 text-sm disabled:opacity-50">
            Save & connect
          </button>
        </div>
        <button onClick={onClose} className="mt-3 w-full text-center text-xs text-mist hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
