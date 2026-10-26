/**
 * StreamPlay — Watch on Your Device (official app & device experience)
 *
 * Design contract:
 *  - Premium dark cinematic shell (ink surfaces, crimson accents) consistent
 *    with the Phase 2 sp2 design system.
 *  - The OFFICIAL StreamPlay app (installable PWA) is the most prominent option.
 *  - Honest by construction: no native Smart TV / Fire TV / APK claims, no
 *    reseller master credentials, no invented capabilities.
 *  - Preserves the existing usePWAInstall hook + PWAInstallButton behaviour;
 *    this page composes the same hook for a richer, full-page experience.
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  ExternalLink,
  Globe,
  Info,
  KeyRound,
  Laptop,
  Monitor,
  Play,
  Share2,
  ShieldCheck,
  Smartphone,
  Tv,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.js';

interface DevicesPageProps {
  onNavigate: (tab: string) => void;
}

type GuideSheet = null | 'ios' | 'manual';

/* ------------------------------------------------------------------ */
/* Shared premium card shell                                           */
/* ------------------------------------------------------------------ */

const OptionCard: React.FC<{
  eyebrow: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  bullets: string[];
  recommended?: boolean;
  action: React.ReactNode;
  footnote?: string;
}> = ({ eyebrow, icon, title, body, bullets, recommended = false, action, footnote }) => (
  <div
    className={`relative flex flex-col rounded-3xl p-7 transition-transform duration-300 hover:-translate-y-1 ${
      recommended
        ? 'bg-gradient-to-b from-[#162131] to-[#0D1520] border-2 border-[#E5093A]/60 shadow-[0_24px_80px_-24px_rgba(229,9,58,0.45)]'
        : 'bg-[#111A27] border border-white/10 hover:border-white/20'
    }`}
  >
    {recommended && (
      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#E5093A] text-white text-[10px] font-bold tracking-[0.18em] uppercase shadow-lg crimson-glow-sm whitespace-nowrap">
        Recommended
      </div>
    )}
    <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.24em] uppercase text-[#8993A3]">
      {eyebrow}
    </div>
    <div
      className={`mt-4 w-12 h-12 rounded-2xl flex items-center justify-center ${
        recommended ? 'bg-[#E5093A] text-white shadow-lg crimson-glow-sm' : 'bg-white/5 border border-white/10 text-[#C6CBD4]'
      }`}
    >
      {icon}
    </div>
    <h3 className="mt-5 text-xl font-bold text-white font-display tracking-tight">{title}</h3>
    <p className="mt-2.5 text-sm text-[#8993A3] leading-relaxed">{body}</p>
    <ul className="mt-5 space-y-2.5 flex-1">
      {bullets.map((b) => (
        <li key={b} className="flex items-start gap-2.5 text-[13px] text-[#C6CBD4]">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#E5093A] shrink-0" />
          <span>{b}</span>
        </li>
      ))}
    </ul>
    <div className="mt-7">{action}</div>
    {footnote && (
      <p className="mt-3.5 text-[11px] text-[#5F6978] leading-relaxed flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        {footnote}
      </p>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Instruction sheets (iOS + manual install)                           */
/* ------------------------------------------------------------------ */

const SheetShell: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({
  onClose,
  title,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
    role="dialog"
    aria-modal="true"
    aria-label={title}
  >
    <div className="w-full max-w-md rounded-3xl bg-[#111A27] border border-white/10 p-7 shadow-2xl relative max-h-[85vh] overflow-y-auto">
      <button
        onClick={onClose}
        className="absolute top-5 right-5 p-1.5 rounded-full text-[#8993A3] hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Close instructions"
      >
        <X className="w-5 h-5" />
      </button>
      <h3 className="text-lg font-bold text-white font-display pr-8">{title}</h3>
      {children}
    </div>
  </div>
);

const IosSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <SheetShell onClose={onClose} title="Add StreamPlay to your iPhone or iPad">
    <p className="mt-2 text-xs text-[#8993A3] leading-relaxed">
      iPhones and iPads install web apps through Safari's Share sheet — it takes about
      fifteen seconds and gives you the full cinematic, full-screen StreamPlay app with
      no App Store involved.
    </p>
    <div className="mt-5 space-y-2.5">
      {[
        <>Open <strong className="text-white">stream.playbeatdigital.store</strong> in <strong className="text-white">Safari</strong>.</>,
        <>Tap the <Share2 className="w-3.5 h-3.5 inline text-[#E5093A]" /> <strong className="text-white">Share</strong> button in the Safari toolbar.</>,
        <>Scroll down and choose <strong className="text-white">Add to Home Screen</strong>.</>,
        <>Tap <strong className="text-white">Add</strong> — the StreamPlay app icon appears on your Home Screen.</>,
      ].map((step, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-black/40 border border-white/5">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#E5093A]/15 border border-[#E5093A]/30 text-[#E5093A] font-bold text-[11px] shrink-0">
            {i + 1}
          </span>
          <span className="text-[13px] text-[#C6CBD4] leading-relaxed">{step}</span>
        </div>
      ))}
    </div>
    <p className="mt-4 text-[11px] text-[#5F6978] leading-relaxed">
      On iOS 16.4 or later you can also add StreamPlay from Chrome on iOS via the same
      Share → Add to Home Screen flow.
    </p>
    <button
      onClick={onClose}
      className="mt-5 w-full rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white py-3 text-sm font-semibold transition-all duration-200 active:scale-[0.98]"
    >
      Got It
    </button>
  </SheetShell>
);

const ManualSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <SheetShell onClose={onClose} title="Install StreamPlay from your browser menu">
    <p className="mt-2 text-xs text-[#8993A3] leading-relaxed">
      Your current browser didn't show the one-tap install prompt. Most modern browsers
      still let you install StreamPlay manually — follow the steps for your platform.
    </p>
    <div className="mt-5 space-y-4">
      <div className="p-4 rounded-xl bg-black/40 border border-white/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Smartphone className="w-4 h-4 text-[#E5093A]" /> Android — Chrome / Edge / Samsung Internet
        </div>
        <ol className="mt-2.5 space-y-1.5 text-[13px] text-[#C6CBD4] list-decimal list-inside leading-relaxed">
          <li>Open the browser <strong className="text-white">⋮ menu</strong>.</li>
          <li>Tap <strong className="text-white">Install app</strong> (or <strong className="text-white">Add to Home screen</strong>).</li>
          <li>Confirm — the StreamPlay icon lands on your Home Screen.</li>
        </ol>
      </div>
      <div className="p-4 rounded-xl bg-black/40 border border-white/5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Monitor className="w-4 h-4 text-[#E5093A]" /> Windows / macOS / Chromebook
        </div>
        <ol className="mt-2.5 space-y-1.5 text-[13px] text-[#C6CBD4] list-decimal list-inside leading-relaxed">
          <li>Look for the <strong className="text-white">install icon</strong> at the right end of the address bar — or open the browser menu.</li>
          <li>Choose <strong className="text-white">Install page as app</strong> (Chrome) or <strong className="text-white">Apps → Install this site as an app</strong> (Edge).</li>
          <li>StreamPlay opens in its own window and docks to your Start menu, Dock or taskbar.</li>
        </ol>
      </div>
    </div>
    <button
      onClick={onClose}
      className="mt-5 w-full rounded-xl bg-[#192231] hover:bg-[#232E40] text-[#C6CBD4] py-3 text-sm font-semibold transition-colors"
    >
      Close
    </button>
  </SheetShell>
);

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export const DevicesPage: React.FC<DevicesPageProps> = ({ onNavigate }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [sheet, setSheet] = useState<GuideSheet>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      await install();
    } finally {
      setIsInstalling(false);
    }
  };

  /** Primary install CTA — adapts to platform + install state (never a dead button). */
  const primaryCta = (size: 'lg' | 'md' = 'lg') => {
    const pad = size === 'lg' ? 'px-8 py-4 text-sm' : 'px-5 py-2.5 text-xs';
    if (isInstalled) {
      return (
        <button
          onClick={() => onNavigate('watch')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-semibold ${pad} transition-all duration-200 hover:bg-emerald-500/25`}
        >
          <CheckCircle2 className="w-4 h-4" />
          App Installed — Open StreamPlay
        </button>
      );
    }
    if (isInstallable) {
      return (
        <button
          onClick={handleInstall}
          disabled={isInstalling}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white font-bold shadow-lg crimson-glow ${pad} transition-all duration-200 active:scale-[0.98] disabled:opacity-60`}
        >
          <Download className="w-4 h-4" />
          {isInstalling ? 'Opening installer…' : 'Install StreamPlay App'}
        </button>
      );
    }
    if (isIOS) {
      return (
        <button
          onClick={() => setSheet('ios')}
          className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white font-bold shadow-lg crimson-glow ${pad} transition-all duration-200 active:scale-[0.98]`}
        >
          <Share2 className="w-4 h-4" />
          Add to Home Screen (iPhone / iPad)
        </button>
      );
    }
    return (
      <button
        onClick={() => setSheet('manual')}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white font-bold shadow-lg crimson-glow ${pad} transition-all duration-200 active:scale-[0.98]`}
      >
        <Download className="w-4 h-4" />
        How to Install the App
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-[#04070B]">
      {/* ============================= HERO ============================= */}
      <section className="relative overflow-hidden pt-28 pb-14">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(60% 55% at 70% 10%, rgba(229,9,58,0.14), transparent 60%), radial-gradient(50% 45% at 15% 30%, rgba(192,10,66,0.10), transparent 65%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-[1.15fr_0.85fr] gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5093A]/10 border border-[#E5093A]/25 text-[#FF4D6F] text-[10px] font-bold tracking-[0.22em] uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E5093A] animate-pulse" />
              Official StreamPlay App · Installable Web App
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white font-display tracking-tight leading-[1.05]">
              Watch on your device.
              <span className="block bg-gradient-to-r from-[#E5093A] to-[#FF6B6B] bg-clip-text text-transparent">
                Cinema-grade, everywhere.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm sm:text-base text-[#8993A3] leading-relaxed">
              Install the official StreamPlay app once and it behaves like a native
              app — full-screen playback, home-screen launch and automatic updates,
              with no app-store queues. Prefer not to install? Stream instantly in
              your browser, or connect a compatible player where your membership
              includes a personal line.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {primaryCta('lg')}
              <button
                onClick={() => onNavigate('watch')}
                className="inline-flex items-center gap-2 px-6 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#C6CBD4] hover:text-white text-sm font-semibold transition-all duration-200"
              >
                <Play className="w-4 h-4" />
                Watch in Browser
              </button>
            </div>
            <p className="mt-4 text-[11px] text-[#5F6978] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Device slots are enforced server-side at sign-in. The platform does not
              double-count the installed app alongside the browser session on the same
              account — new sign-ins reuse your active slot instead of consuming a new one.
            </p>
          </div>

          {/* Device constellation — pure CSS, no stock imagery */}
          <div className="relative h-[300px] sm:h-[360px] hidden md:block" aria-hidden="true">
            <div className="absolute right-2 top-2 w-64 rounded-2xl border border-white/10 bg-[#0D1520]/90 p-3 shadow-2xl rotate-[2deg]">
              <div className="aspect-video rounded-lg bg-gradient-to-br from-[#162131] via-[#0D1520] to-black flex items-center justify-center">
                <Tv className="w-10 h-10 text-[#E5093A]/80" />
              </div>
              <p className="mt-2 text-[10px] font-mono tracking-[0.2em] uppercase text-[#8993A3]">Living room TV · browser cast</p>
            </div>
            <div className="absolute left-4 top-24 w-40 rounded-[1.6rem] border-4 border-white/10 bg-[#0D1520] p-2 shadow-2xl -rotate-[5deg]">
              <div className="aspect-[9/17] rounded-[1.1rem] bg-gradient-to-b from-[#162131] to-black flex flex-col items-center justify-center gap-2">
                <StreamPlayMarkSmall />
                <span className="text-[8px] font-mono tracking-[0.2em] uppercase text-[#8993A3]">Installed PWA</span>
              </div>
            </div>
            <div className="absolute right-24 bottom-0 w-56 rounded-xl border border-white/10 bg-[#0D1520]/90 p-2.5 shadow-2xl rotate-[-2deg]">
              <div className="aspect-[16/10] rounded-lg bg-gradient-to-br from-[#162131] to-black flex items-center justify-center">
                <Laptop className="w-9 h-9 text-[#C6CBD4]/70" />
              </div>
              <p className="mt-1.5 text-[10px] font-mono tracking-[0.2em] uppercase text-[#8993A3]">Desktop app window</p>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== THREE VIEWING OPTIONS ==================== */}
      <section className="py-14" aria-label="Ways to watch">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#E5093A] font-bold">Three ways to watch</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
              Pick the experience that fits your screen
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 pt-3">
            {/* Option 1 — Official app (recommended) */}
            <OptionCard
              recommended
              eyebrow="Official app"
              icon={<Download className="w-6 h-6" />}
              title="Install StreamPlay App"
              body="The full StreamPlay experience, installed straight from the site — no store, no APK files, no waiting."
              bullets={[
                'Full-screen cinematic playback, zero browser chrome',
                'Launches from your Home Screen, Dock or Start menu',
                'Updates automatically in the background',
                'Works on Android, iPhone, iPad, Windows, macOS & Chromebook',
              ]}
              action={primaryCta('md')}
              footnote="An installable web app (PWA) — not a native store app. StreamPlay has no native Smart TV, Fire TV or APK application at this time."
            />

            {/* Option 2 — Browser */}
            <OptionCard
              eyebrow="Zero install"
              icon={<Globe className="w-6 h-6" />}
              title="Watch in Browser"
              body="Everything StreamPlay offers, instantly, in any modern browser — nothing to download or update."
              bullets={[
                'Instant access on any device with a browser',
                'Same library, same quality, same account',
                'Great for one-off sessions on shared devices',
                'Switch to the installed app anytime — progress follows you',
              ]}
              action={
                <button
                  onClick={() => onNavigate('watch')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white py-3 text-sm font-semibold transition-all duration-200"
                >
                  <Play className="w-4 h-4" />
                  Start Watching in Browser
                  <ArrowRight className="w-4 h-4" />
                </button>
              }
            />

            {/* Option 3 — External player (honest + vault-safe) */}
            <OptionCard
              eyebrow="For Premium members with a line"
              icon={<KeyRound className="w-6 h-6" />}
              title="Use a Compatible IPTV Player"
              body="Members with a personally assigned line can watch through third-party players that support standard playlist and guide formats."
              bullets={[
                'Compatible with popular players that support M3U playlists and XMLTV guides (e.g. VLC, TiviMate, IPTV Smarters Pro)',
                'Your line credentials are issued per member from the server vault',
                'Connection limits follow your plan and the reseller agreement',
                'Setup guide available from your account dashboard',
              ]}
              action={
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white py-3 text-sm font-semibold transition-all duration-200"
                >
                  <ExternalLink className="w-4 h-4" />
                  View My Line Access
                  <ArrowRight className="w-4 h-4" />
                </button>
              }
              footnote="StreamPlay never displays or distributes reseller master credentials. If no line is assigned to your membership yet, request provisioning from the platform director."
            />
          </div>
        </div>
      </section>

      {/* ==================== PLATFORM INSTALL GUIDES ==================== */}
      <section className="py-14" aria-label="Install guides by platform">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <p className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#E5093A] font-bold">Step-by-step</p>
            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
              Installation on every platform
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: <Smartphone className="w-5 h-5" />,
                title: 'Android',
                sub: 'Chrome · Edge · Samsung Internet',
                steps: ['Open stream.playbeatdigital.store', 'Tap the ⋮ menu', 'Choose "Install app" or "Add to Home screen"', 'Confirm the install prompt'],
              },
              {
                icon: <Share2 className="w-5 h-5" />,
                title: 'iPhone & iPad',
                sub: 'Safari (Share sheet)',
                steps: ['Open the site in Safari', 'Tap the Share button', 'Scroll to "Add to Home Screen"', 'Tap Add — done'],
              },
              {
                icon: <Monitor className="w-5 h-5" />,
                title: 'Windows / macOS',
                sub: 'Chrome · Edge',
                steps: ['Look for the install icon in the address bar', 'Or open the browser menu', 'Choose "Install page as app"', 'Launch from Start menu / Dock'],
              },
              {
                icon: <Tv className="w-5 h-5" />,
                title: 'Smart TV & TV boxes',
                sub: 'Browser or compatible player',
                steps: ['StreamPlay ships as a web app — there is no native TV, Fire TV or APK app', 'Open your TV browser to the site, or', 'Use a compatible player where your plan includes a personal line', 'Cast from the installed app on mobile where supported'],
              },
            ].map((g) => (
              <div key={g.title} className="rounded-2xl bg-[#111A27] border border-white/10 p-6 hover:border-white/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E5093A]/10 border border-[#E5093A]/25 text-[#E5093A] flex items-center justify-center">
                    {g.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-display">{g.title}</h3>
                    <p className="text-[10px] font-mono tracking-[0.14em] uppercase text-[#5F6978]">{g.sub}</p>
                  </div>
                </div>
                <ol className="mt-4 space-y-2 text-xs text-[#C6CBD4]">
                  {g.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="flex items-center justify-center w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full bg-white/5 border border-white/10 text-[9px] font-bold text-[#8993A3] mt-0.5">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== MEMBERSHIP & DEVICE SLOTS ==================== */}
      <section className="py-14 pb-20" aria-label="Device limits and membership">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-br from-[#111A27] to-[#0D1520] border border-white/10 p-8 sm:p-10">
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.24em] uppercase text-[#E5093A] font-bold mb-3">
                  <ShieldCheck className="w-4 h-4" />
                  Fair, secure device limits
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display tracking-tight">
                  Your membership, enforced where it matters
                </h2>
                <div className="mt-5 grid sm:grid-cols-3 gap-4">
                  {[
                    {
                      t: 'Verified server-side',
                      d: 'Entitlement checks are designed to run on the server at sign-in and at stream time — never in the client alone. Until the proposed tiers activate, access stays director-provisioned.',
                    },
                    {
                      t: 'Plan-based device slots',
                      d: 'Registered-device limits follow your membership tier and are enforced at sign-in. Sessions can be revoked anytime from your account.',
                    },
                    {
                      t: 'One device, one slot',
                      d: 'Signing in from the installed app while your browser session is active does not consume an extra slot — slots are counted per active sign-in on your account, enforced server-side.',
                    },
                  ].map((c) => (
                    <div key={c.t} className="p-4 rounded-2xl bg-black/30 border border-white/5">
                      <h3 className="text-[13px] font-bold text-white font-display">{c.t}</h3>
                      <p className="mt-1.5 text-xs text-[#8993A3] leading-relaxed">{c.d}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3 min-w-[220px]">
                <button
                  onClick={() => onNavigate('pricing')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white px-6 py-3.5 text-sm font-bold shadow-lg crimson-glow-sm transition-all duration-200 active:scale-[0.98]"
                >
                  See Membership Plans
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#C6CBD4] hover:text-white px-6 py-3.5 text-sm font-semibold transition-colors"
                >
                  Manage My Devices
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sheets */}
      {sheet === 'ios' && <IosSheet onClose={() => setSheet(null)} />}
      {sheet === 'manual' && <ManualSheet onClose={() => setSheet(null)} />}
    </main>
  );
};

/* Inline brand mark (keeps this page self-contained without extra imports) */
const StreamPlayMarkSmall: React.FC = () => (
  <div className="w-10 h-10 rounded-xl bg-[#E5093A] flex items-center justify-center shadow-lg crimson-glow-sm">
    <Play className="w-5 h-5 text-white fill-white" />
  </div>
);
