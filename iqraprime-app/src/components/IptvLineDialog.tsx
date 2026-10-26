"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LINE, checkAuth, normalizeLine } from "@/lib/iptv-client";
import { readSavedLine, resetLine, saveLine, type IptvLine } from "@/hooks/useIptvLine";

interface Props {
  open: boolean;
  onClose: () => void;
  initial?: IptvLine | null;
  onSaved?: () => void;
}

/** Connect / manage the IPTV (Xtream Codes) line. App ships with a built-in default line. */
export default function IptvLineDialog({ open, onClose, initial, onSaved }: Props) {
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    if (open) {
      const l = initial || readSavedLine();
      setHost(l?.host || DEFAULT_LINE.host);
      setUser(l?.user || DEFAULT_LINE.user);
      setPass(l?.pass || DEFAULT_LINE.pass);
      setHasSaved(Boolean(readSavedLine()));
      setResult(null);
    }
  }, [open, initial]);

  if (!open) return null;

  const test = async () => {
    setTesting(true);
    setResult(null);
    const l = normalizeLine({ host, user, pass });
    if (!l) {
      setResult({ ok: false, msg: "Host, username and password are all required." });
      setTesting(false);
      return;
    }
    try {
      const d = await checkAuth(l);
      if (d.auth) {
        setResult({
          ok: true,
          msg: `Line connected — status ${d.status || "Active"}${d.expiry ? `, valid till ${new Date(d.expiry).toLocaleDateString()}` : ""}`,
        });
      } else {
        setResult({ ok: false, msg: "Line rejected by the provider — check username & password." });
      }
    } catch (e) {
      const code = (e as Error & { code?: string }).code || "error";
      setResult({
        ok: false,
        msg:
          code === "unreachable"
            ? (e as Error).message
            : code === "timeout"
              ? "Provider did not respond — server may be offline."
              : `Could not connect (${code}). Check the server address.`,
      });
    }
    setTesting(false);
  };

  const save = () => {
    const l = normalizeLine({ host, user, pass });
    if (!l) return;
    saveLine(l);
    onSaved?.();
    onClose();
  };

  const useDefault = () => {
    resetLine();
    setHost(DEFAULT_LINE.host);
    setUser(DEFAULT_LINE.user);
    setPass(DEFAULT_LINE.pass);
    setHasSaved(false);
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="line-title" onClick={onClose}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-gold/30 bg-navy p-6 fade-up" onClick={(e) => e.stopPropagation()}>
        <h2 id="line-title" className="font-display text-xl font-bold text-white">
          IPTV <span className="text-gold">Line</span>
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-mist">
          IQRAPRIME ships with a built-in PlayBeat line — it connects automatically. You can point the
          app to any other Xtream Codes line here. Stored on this device only.
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
        {hasSaved && (
          <button onClick={useDefault} className="mt-3 w-full text-center text-xs text-gold hover:text-gold-soft">
            Reset to the built-in IQRAPRIME line
          </button>
        )}
        <button onClick={onClose} className="mt-3 w-full text-center text-xs text-mist hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
}
