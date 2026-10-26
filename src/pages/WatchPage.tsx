import React, { useCallback, useEffect, useState } from 'react';
import {
  Play,
  Tv,
  Film,
  Layers,
  Link2,
  LogIn,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Server,
  KeyRound,
  Clock,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { MemberIptvLineMasked } from '../types/index.js';

interface WatchPageProps {
  onNavigate: (tab: string) => void;
}

type ConnectMode = 'xtream' | 'm3u';

/**
 * Watch — the one-tap watching flow (open access).
 *
 * 1. Not signed in  → watch instantly: the full catalog (14K+ live channels,
 *                     220K+ movies, 17K+ series) is open to everyone.
 *                     Optional sign-in for members who want more.
 * 2. Signed in      → your assigned Star IPTV line is detected automatically;
 *                     otherwise connect your OWN credentials (Xtream
 *                     username/password OR just paste the m3u_plus link).
 * 3. Connected      → playback runs on your own line, credentials stay
 *                     encrypted server-side and are never exposed.
 */
export const WatchPage: React.FC<WatchPageProps> = ({ onNavigate }) => {
  const { user, login, isAdmin } = useAuth();

  const [checking, setChecking] = useState(false);
  const [line, setLine] = useState<MemberIptvLineMasked | null>(null);
  const [selfManaged, setSelfManaged] = useState(false);

  // Sign-in form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Connect-line form
  const [mode, setMode] = useState<ConnectMode>('xtream');
  const [serverUrl, setServerUrl] = useState('');
  const [lineUsername, setLineUsername] = useState('');
  const [linePassword, setLinePassword] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState<string | null>(null);

  const loadLine = useCallback(async () => {
    if (!user) {
      setLine(null);
      return;
    }
    setChecking(true);
    try {
      const res = await api.getMyLine();
      setLine(res.line);
      setSelfManaged(res.selfManaged);
    } catch {
      setLine(null);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    void loadLine();
  }, [loadLine]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setSignInError('Enter your email and password.');
      return;
    }
    setSigningIn(true);
    setSignInError(null);
    const ok = await login(email.trim(), password);
    if (!ok) setSignInError('Sign-in failed — check your credentials.');
    setSigningIn(false);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectError(null);
    setConnectOk(null);
    setConnecting(true);
    try {
      const payload =
        mode === 'm3u'
          ? { m3uUrl: m3uUrl.trim() }
          : { serverUrl: serverUrl.trim(), username: lineUsername.trim(), password: linePassword };
      const res = await api.connectMyLine(payload);
      setConnectOk(res.message || 'Line connected.');
      setLine(res.line);
      setLinePassword('');
    } catch (err: any) {
      setConnectError(err.message || 'Could not verify that line.');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect your IPTV line from StreamPlay?')) return;
    try {
      await api.disconnectMyLine();
      setLine(null);
      setSelfManaged(false);
      setConnectOk(null);
    } catch (err: any) {
      setConnectError(err.message || 'Failed to disconnect.');
    }
  };

  // ------------------------------------------------------------------
  // STEP 1 — open-access landing (playbeat.live model): watching needs
  // NO account. Sign-in is an optional extra for members who want their
  // own IPTV line, dashboard and synced watchlist.
  // ------------------------------------------------------------------
  const [showSignIn, setShowSignIn] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Open-access hero */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#19C77A]/12 border border-[#19C77A]/25 text-[#5FE0A8] text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
              <Play className="w-3 h-3" fill="currentColor" />
              Free · No account required
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Start watching — right now.
            </h1>
            <p className="text-sm text-[#8993A3] mt-2.5 max-w-xl mx-auto leading-relaxed">
              The full StreamPlay catalog is open to everyone — 14,000+ live channels,
              220,000+ movies and 17,000+ series. No sign-up, no credit card, no paywall.
            </p>
          </div>

          {/* Instant-watch CTAs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => onNavigate('live-tv')}
              className="group p-6 rounded-2xl bg-gradient-to-br from-[#0D1520] to-[#111A27] border border-white/[0.07] hover:border-[#E5093A]/40 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#E5093A]/15 border border-[#E5093A]/25 flex items-center justify-center mb-3">
                <Tv className="w-5 h-5 text-[#FF2E55]" />
              </div>
              <p className="text-sm font-bold text-white">Watch Live TV</p>
              <p className="text-[11px] text-[#8993A3] mt-1">14,000+ channels · sports, news, kids</p>
            </button>
            <button
              onClick={() => onNavigate('movies')}
              className="group p-6 rounded-2xl bg-gradient-to-br from-[#0D1520] to-[#111A27] border border-white/[0.07] hover:border-[#E5093A]/40 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#C20A42]/15 border border-[#C20A42]/25 flex items-center justify-center mb-3">
                <Film className="w-5 h-5 text-[#FF2E55]" />
              </div>
              <p className="text-sm font-bold text-white">Browse Movies</p>
              <p className="text-[11px] text-[#8993A3] mt-1">220,000+ films on demand</p>
            </button>
            <button
              onClick={() => onNavigate('movies-series')}
              className="group p-6 rounded-2xl bg-gradient-to-br from-[#0D1520] to-[#111A27] border border-white/[0.07] hover:border-[#E5093A]/40 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#6A5CFF]/15 border border-[#6A5CFF]/25 flex items-center justify-center mb-3">
                <Layers className="w-5 h-5 text-[#9D8FFF]" />
              </div>
              <p className="text-sm font-bold text-white">Browse Series</p>
              <p className="text-[11px] text-[#8993A3] mt-1">17,000+ shows · full episodes</p>
            </button>
          </div>

          {/* Optional member sign-in */}
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1520]/80 border border-white/[0.07] shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
            {!showSignIn ? (
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#56A8FF]/12 border border-[#56A8FF]/25 flex items-center justify-center">
                    <LogIn className="w-4.5 h-4.5 text-[#56A8FF]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Have a member account?</p>
                    <p className="text-[11px] text-[#8993A3]">
                      Sign in to connect your own IPTV line, sync your watchlist and manage devices.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSignIn(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#E5093A] to-[#B90732] text-white text-xs font-bold shadow-[0_10px_30px_rgba(229,9,58,0.22)] hover:-translate-y-px transition-all"
                >
                  Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-sm font-bold text-white">Sign in to StreamPlay</p>
                    <p className="text-[11px] text-[#8993A3]">Optional — the catalog stays open either way.</p>
                  </div>
                  <button
                    onClick={() => setShowSignIn(false)}
                    className="text-[11px] font-semibold text-[#8993A3] hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                  >
                    Maybe later
                  </button>
                </div>

                <form onSubmit={handleSignIn} className="space-y-3.5 max-w-md">
                  <div>
                    <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your member password"
                      autoComplete="current-password"
                      className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                    />
                  </div>

                  {signInError && (
                    <div className="p-2.5 rounded-xl bg-[#FF4D67]/10 border border-[#FF4D67]/25 text-[#FF8DA0] text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {signInError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full h-12 rounded-xl bg-gradient-to-br from-[#E5093A] to-[#B90732] text-white text-sm font-bold shadow-[0_10px_30px_rgba(229,9,58,0.22)] hover:shadow-[0_14px_38px_rgba(229,9,58,0.28)] hover:-translate-y-px transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {signingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {signingIn ? 'Signing in…' : 'Sign In'}
                  </button>

                  <p className="text-[10px] text-[#5F6978] text-center leading-relaxed">
                    Your IPTV credentials never leave the secure server vault.
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // STEP 2/3 — line detection / connect / watching
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5093A]/12 border border-[#E5093A]/25 text-[#FF2E55] text-[10px] font-bold uppercase tracking-[0.2em] mb-3">
            <Play className="w-3 h-3" fill="currentColor" />
            Simple Player
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {line ? 'You are ready to watch.' : 'Connect your line to start watching.'}
          </h1>
          <p className="text-xs text-[#8993A3] mt-2">
            Signed in as <span className="text-[#C6CBD4] font-semibold">{user.email}</span>
            {isAdmin && <span className="ml-1.5 text-[#56A8FF]">· Director</span>}
          </p>
        </div>

        {checking && (
          <div className="p-8 rounded-2xl bg-[#0D1520]/70 border border-white/[0.07] flex items-center justify-center gap-3 text-sm text-[#8993A3]">
            <Loader2 className="w-4 h-4 animate-spin text-[#E5093A]" />
            Checking your line…
          </div>
        )}

        {/* CONNECTED — start watching */}
        {!checking && line && (
          <>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0D1520] to-[#111A27] border border-[#19C77A]/25 shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#19C77A]/12 border border-[#19C77A]/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-[#19C77A]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Line connected</p>
                    <p className="text-[11px] text-[#8993A3]">{line.providerName}</p>
                  </div>
                </div>
                {selfManaged && (
                  <button
                    onClick={handleDisconnect}
                    className="text-[11px] font-semibold text-[#FF8DA0] hover:text-[#FF4D67] px-3 py-1.5 rounded-lg border border-[#FF4D67]/25 hover:bg-[#FF4D67]/10 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Disconnect
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-xs">
                <div className="p-3 rounded-xl bg-[#0B121D]/80 border border-white/[0.06]">
                  <p className="text-[10px] text-[#5F6978] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><KeyRound className="w-3 h-3" /> Username</p>
                  <p className="font-mono text-[#C6CBD4] truncate">{line.usernameMasked}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0B121D]/80 border border-white/[0.06]">
                  <p className="text-[10px] text-[#5F6978] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Server className="w-3 h-3" /> Server</p>
                  <p className="font-mono text-[#C6CBD4] truncate">{line.serverHost}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0B121D]/80 border border-white/[0.06]">
                  <p className="text-[10px] text-[#5F6978] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Expires</p>
                  <p className="font-mono text-[#C6CBD4]">{line.expiresAt ? String(line.expiresAt).slice(0, 10) : 'Never'}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#0B121D]/80 border border-white/[0.06]">
                  <p className="text-[10px] text-[#5F6978] uppercase tracking-wider font-semibold mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Status</p>
                  <p className="font-mono text-[#19C77A] capitalize">{line.status || 'active'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                onClick={() => onNavigate('live-tv')}
                className="group p-6 rounded-2xl bg-[#0D1520] border border-white/[0.07] hover:border-[#E5093A]/30 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E5093A]/15 border border-[#E5093A]/25 flex items-center justify-center mb-3">
                  <Tv className="w-5 h-5 text-[#FF2E55]" />
                </div>
                <p className="text-sm font-bold text-white">Watch Live TV</p>
                <p className="text-[11px] text-[#8993A3] mt-1">14,000+ channels with EPG</p>
              </button>
              <button
                onClick={() => onNavigate('movies')}
                className="group p-6 rounded-2xl bg-[#0D1520] border border-white/[0.07] hover:border-[#E5093A]/30 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#C20A42]/15 border border-[#C20A42]/25 flex items-center justify-center mb-3">
                  <Film className="w-5 h-5 text-[#FF2E55]" />
                </div>
                <p className="text-sm font-bold text-white">Browse Movies</p>
                <p className="text-[11px] text-[#8993A3] mt-1">220,000+ films on demand</p>
              </button>
              <button
                onClick={() => onNavigate('movies-series')}
                className="group p-6 rounded-2xl bg-[#0D1520] border border-white/[0.07] hover:border-[#E5093A]/30 hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(0,0,0,0.38)] transition-all text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-[#6A5CFF]/15 border border-[#6A5CFF]/25 flex items-center justify-center mb-3">
                  <Layers className="w-5 h-5 text-[#9D8FFF]" />
                </div>
                <p className="text-sm font-bold text-white">Browse Series</p>
                <p className="text-[11px] text-[#8993A3] mt-1">17,000+ shows · full episodes</p>
              </button>
            </div>
          </>
        )}

        {/* NO LINE — connect your own credentials */}
        {!checking && !line && (
          <div className="p-6 sm:p-8 rounded-2xl bg-[#0D1520]/80 border border-white/[0.07] shadow-[0_18px_45px_rgba(0,0,0,0.28)]">
            {isAdmin ? (
              <div className="text-center py-6 space-y-3">
                <ShieldCheck className="w-10 h-10 text-[#56A8FF] mx-auto" />
                <p className="text-sm font-bold text-white">Directors browse through the secure vault line</p>
                <p className="text-xs text-[#8993A3] max-w-md mx-auto leading-relaxed">
                  No personal line is needed — the platform catalog is already unlocked for your account.
                </p>
                <button
                  onClick={() => onNavigate('live-tv')}
                  className="mt-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-[#E5093A] to-[#B90732] text-white text-xs font-bold shadow-[0_10px_30px_rgba(229,9,58,0.22)]"
                >
                  Open Live TV
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl bg-[#E5093A]/15 border border-[#E5093A]/25 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-[#FF2E55]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Connect your IPTV line</p>
                    <p className="text-[11px] text-[#8993A3]">
                      Use your Star IPTV username + password — or just paste your M3U link. Verified against the provider, stored encrypted server-side.
                    </p>
                  </div>
                </div>

                {/* Mode toggle */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0B121D] border border-white/[0.08] mb-5">
                  {([
                    { id: 'xtream' as ConnectMode, label: 'Username + Password' },
                    { id: 'm3u' as ConnectMode, label: 'M3U Link' },
                  ]).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMode(m.id); setConnectError(null); setConnectOk(null); }}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        mode === m.id
                          ? 'bg-gradient-to-br from-[#E5093A] to-[#B90732] text-white shadow-[0_6px_20px_rgba(229,9,58,0.25)]'
                          : 'text-[#8993A3] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleConnect} className="space-y-3.5">
                  {mode === 'xtream' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="sm:col-span-2">
                        <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">Server URL</label>
                        <input
                          type="text"
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          placeholder="http://your-provider:8080"
                          className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">Line Username</label>
                        <input
                          type="text"
                          value={lineUsername}
                          onChange={(e) => setLineUsername(e.target.value)}
                          placeholder="Your IPTV username"
                          autoComplete="off"
                          className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">Line Password</label>
                        <input
                          type="password"
                          value={linePassword}
                          onChange={(e) => setLinePassword(e.target.value)}
                          placeholder="Your IPTV password"
                          autoComplete="off"
                          className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] font-semibold text-[#C6CBD4] block mb-1.5">M3U Link (m3u_plus)</label>
                      <input
                        type="url"
                        value={m3uUrl}
                        onChange={(e) => setM3uUrl(e.target.value)}
                        placeholder="http://your-provider:8080/get.php?username=…&password=…&type=m3u_plus"
                        className="w-full bg-[#0B121D] border border-white/[0.08] rounded-xl px-3.5 py-3 text-sm text-white placeholder-[#5F6978] focus:outline-none focus:border-[#E5093A]/65 focus:shadow-[0_0_0_3px_rgba(229,9,58,0.10)]"
                      />
                      <p className="text-[10px] text-[#5F6978] mt-1.5">
                        The link must contain your username and password — they are extracted and verified automatically.
                      </p>
                    </div>
                  )}

                  {connectError && (
                    <div className="p-2.5 rounded-xl bg-[#FF4D67]/10 border border-[#FF4D67]/25 text-[#FF8DA0] text-xs flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {connectError}
                    </div>
                  )}
                  {connectOk && (
                    <div className="p-2.5 rounded-xl bg-[#19C77A]/10 border border-[#19C77A]/25 text-[#5FE0A8] text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      {connectOk}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={connecting}
                    className="w-full h-12 rounded-xl bg-gradient-to-br from-[#E5093A] to-[#B90732] text-white text-sm font-bold shadow-[0_10px_30px_rgba(229,9,58,0.22)] hover:shadow-[0_14px_38px_rgba(229,9,58,0.28)] hover:-translate-y-px transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" fill="currentColor" />}
                    {connecting ? 'Verifying with provider…' : 'Verify & Start Watching'}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
