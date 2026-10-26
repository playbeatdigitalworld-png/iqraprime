import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Tv,
  Smartphone,
  Lock,
  ArrowRight,
  Info,
  CheckCircle2,
  FileText,
  KeyRound,
  LogIn,
  MonitorSmartphone,
  ServerCog,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { StreamPlayMark } from '../components/common/StreamPlayLogo.js';

interface PricingPageProps {
  onNavigate: (tab: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const { user, subscription, isAdmin, login } = useAuth();
  const { showToast } = useToast();

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleMemberLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast('Please enter both email and password', 'error');
      return;
    }

    setIsLoggingIn(true);
    try {
      await login(loginEmail, loginPassword);
      showToast('Welcome to StreamPlay Private Pilot', 'success');
      onNavigate('home');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Login failed', 'error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 min-h-screen">
      {/* Pilot Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5093A]/10 border border-[#E5093A]/25 text-[#FF4D6F] text-xs font-semibold mb-4 font-mono tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#E5093A] animate-pulse" />
          <span>PRIVATE ACCESS · CLOSED BETA · 3–5 HOUSEHOLD MEMBERS</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white font-display tracking-tight leading-tight">
          Private Access & Testing Portal
        </h1>
        <p className="text-xs sm:text-sm text-[#8993A3] mt-3 leading-relaxed">
          StreamPlay is operating in closed-beta mode for private testing of streaming infrastructure,
          adaptive bitrate playback, device concurrency, and authorized Star IPTV integration.
        </p>
      </div>

      {/* Mandatory Regulatory & SECP Corporate Notice Banner */}
      <div className="mb-12 p-6 rounded-2xl bg-[#111A27] border border-amber-500/30 shadow-xl relative overflow-hidden">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white font-display">
              SECP Corporate Registration & Pre-Launch Notice
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              StreamPlay is currently in a <strong>private closed-beta pilot for authorized household members</strong>.
              Commercial service launch, public subscriptions, and payment processing are strictly withheld pending
              formal Securities and Exchange Commission of Pakistan (SECP) corporate registration and relevant regulatory approvals.
            </p>
            <p className="text-[11px] text-amber-300 font-medium pt-1">
              • Public registration and payment gateways are disabled in this environment.
            </p>
          </div>
        </div>
      </div>

      {/* ==================== PROPOSED SUBSCRIPTION MODEL ==================== */}
      <div id="plans" className="mb-14 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5093A]/10 border border-[#E5093A]/25 text-[#FF4D6F] text-[10px] font-bold tracking-[0.22em] uppercase mb-4">
            <BadgeCheck className="w-3.5 h-3.5" />
            Proposed Subscription Model
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display tracking-tight">
            Simple plans. Premium cinema.
          </h2>
          <p className="text-xs sm:text-sm text-[#8993A3] mt-3 leading-relaxed">
            Stream free forever, or unlock the licensed Premium catalog for about the
            price of a cup of tea. Entitlements and device limits are verified
            server-side — the app never decides what you're allowed to watch.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {/* FREE */}
          <div className="relative flex flex-col rounded-3xl bg-[#111A27] border border-white/10 p-7 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono tracking-[0.26em] uppercase text-[#8993A3] font-bold">Free</p>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold tracking-[0.14em] uppercase">Proposed</span>
            </div>
            <div className="mt-3 flex items-end gap-1.5">
              <span className="text-4xl font-extrabold text-white font-display tracking-tight">$0</span>
              <span className="text-xs text-[#8993A3] mb-1.5">forever</span>
            </div>
            <p className="mt-3 text-xs text-[#8993A3] leading-relaxed">
              Authorized free live TV plus public-domain and commercially reusable
              open-license movies & series. No card, no clock.
            </p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                'Authorized free-to-air live TV channels',
                'Public-domain & open-license movies and series',
                'Universal watchlist & viewing history',
                'Installable StreamPlay app on every device',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#C6CBD4]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => onNavigate('watch')}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white py-3 text-sm font-semibold transition-all duration-200"
            >
              Start Watching Free
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* PREMIUM BASIC */}
          <div className="relative flex flex-col rounded-3xl bg-[#111A27] border border-white/10 p-7 transition-transform duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-mono tracking-[0.26em] uppercase text-[#8993A3] font-bold">Premium Basic</p>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold tracking-[0.14em] uppercase">Proposed</span>
            </div>
            <div className="mt-3 flex items-end gap-1.5">
              <span className="text-4xl font-extrabold text-white font-display tracking-tight">$1.00</span>
              <span className="text-xs text-[#8993A3] mb-1.5">/ month</span>
            </div>
            <p className="mt-3 text-xs text-[#8993A3] leading-relaxed">
              30 days of the full licensed Premium catalog on one registered device.
            </p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                'Full licensed Premium catalog access',
                '30-day access window per cycle',
                'Maximum 1 registered device',
                'Server-side entitlement verification',
                'Official app + browser + compatible player',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#C6CBD4]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#E5093A] shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => document.getElementById('member-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white py-3 text-sm font-semibold transition-all duration-200"
            >
              <LogIn className="w-4 h-4" />
              Activate via Director
            </button>
          </div>

          {/* PREMIUM PLUS — most value */}
          <div className="relative flex flex-col rounded-3xl bg-gradient-to-b from-[#162131] to-[#0D1520] border-2 border-[#E5093A]/60 p-7 shadow-[0_24px_80px_-24px_rgba(229,9,58,0.45)] transition-transform duration-300 hover:-translate-y-1">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[#E5093A] text-white text-[10px] font-bold tracking-[0.18em] uppercase shadow-lg crimson-glow-sm whitespace-nowrap">
              Most Value
            </div>
            <p className="text-[10px] font-mono tracking-[0.26em] uppercase text-[#FF4D6F] font-bold">Premium Plus</p>
            <span className="absolute top-5 right-6 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] font-bold tracking-[0.14em] uppercase">Proposed</span>
            <div className="mt-3 flex items-end gap-1.5">
              <span className="text-4xl font-extrabold text-white font-display tracking-tight">$1.50</span>
              <span className="text-xs text-[#8993A3] mb-1.5">/ month</span>
            </div>
            <p className="mt-3 text-xs text-[#8993A3] leading-relaxed">
              The same Premium catalog for the whole household — two registered
              devices, streamed their way.
            </p>
            <ul className="mt-5 space-y-2.5 flex-1">
              {[
                'Same full licensed Premium catalog',
                '30-day access window per cycle',
                'Maximum 2 registered devices',
                'Server-side entitlement verification',
                'Secure simultaneous-stream limits per the reseller agreement',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#C6CBD4]">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 text-[#E5093A] shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => document.getElementById('member-access')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="mt-7 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white py-3 text-sm font-bold shadow-lg crimson-glow-sm transition-all duration-200 active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              Activate via Director
            </button>
          </div>
        </div>

        {/* Compliance strip */}
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <ServerCog className="w-4 h-4" />,
              t: 'Verified server-side',
              d: 'Plan entitlements are checked at sign-in and at stream time.',
            },
            {
              icon: <MonitorSmartphone className="w-4 h-4" />,
              t: 'Secure device limits',
              d: 'Registered-device caps enforced by the platform, revocable from your account.',
            },
            {
              icon: <ShieldCheck className="w-4 h-4" />,
              t: 'IPTV agreement compliant',
              d: 'Simultaneous-stream limits follow the authorized reseller agreement.',
            },
            {
              icon: <KeyRound className="w-4 h-4" />,
              t: 'Credentials stay server-side',
              d: 'IPTV usernames & passwords never appear in the app or this page.',
            },
          ].map((c) => (
            <div key={c.t} className="flex items-start gap-3 p-4 rounded-2xl bg-[#111A27] border border-white/10">
              <div className="p-2 rounded-lg bg-[#E5093A]/10 text-[#E5093A] shrink-0">{c.icon}</div>
              <div>
                <h4 className="text-[12px] font-bold text-white font-display">{c.t}</h4>
                <p className="mt-1 text-[11px] text-[#8993A3] leading-relaxed">{c.d}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-[#5F6978] flex items-center justify-center gap-1.5 flex-wrap">
          <Info className="w-3.5 h-3.5" />
          All three tiers are a PROPOSED model for review only — payment processing,
          server-side entitlement checks and device-limit enforcement are not yet
          active, so nothing is purchasable today. Tiers activate only after
          corporate registration and full implementation of payment, entitlement
          and device enforcement. Current members keep director-provisioned access.
        </p>
      </div>

      {/* Current Pilot Capacity & Feature Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Pillar 1: Controlled Membership */}
        <div className="p-6 rounded-2xl bg-[#111A27] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-display">
            3–5 Approved Members
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Access is provisioned exclusively by the System Director. Household members test video feeds, device limits, and custom watchlists.
          </p>
          <div className="pt-2 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Currently Active: Julian Vance & Elena Rostova</span>
          </div>
        </div>

        {/* Pillar 2: Star IPTV Line Integration */}
        <div className="p-6 rounded-2xl bg-[#111A27] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5093A]/10 text-[#E5093A] flex items-center justify-center">
            <Tv className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-display">
            Authorized Star IPTV Testing
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Secure server-side adapter validates M3U playlists, parses electronic program guides (EPG), and routes streams through protected player endpoints.
          </p>
          <div className="pt-2 text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Server Vault Enforced · Zero Client Exposure</span>
          </div>
        </div>

        {/* Pillar 3: Concurrency & Device Management */}
        <div className="p-6 rounded-2xl bg-[#111A27] border border-white/10 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Smartphone className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white font-display">
            1–2 Registered Devices by Tier
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            The proposed model allocates one registered device on Premium Basic and two
            on Premium Plus. Limits are enforced server-side at sign-in, and older
            sessions can be revoked on demand from your account dashboard.
          </p>
          <div className="pt-2 text-[11px] font-mono text-purple-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Same Engine for Browser & Installed App — No Double Counting</span>
          </div>
        </div>
      </div>

      {/* Member Session or Pilot Sign-In Section */}
      <div id="member-access" className="max-w-xl mx-auto rounded-2xl bg-[#111A27] border border-white/10 p-6 sm:p-8 shadow-2xl scroll-mt-24">
        {user ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">
                Authorized Pilot Member Active
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Signed in as <strong className="text-white">{user.name}</strong> ({user.email})
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#080B12] border border-white/5 text-xs text-slate-300 space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Access Status:</span>
                <span className="text-emerald-400 font-semibold font-mono">Approved Pilot Pass</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Role:</span>
                <span className="capitalize text-slate-200">{isAdmin ? 'Director (Admin)' : 'Household Member'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Device Allocation:</span>
                <span className="font-mono text-slate-200">{subscription?.maxDevices || 2} Connected Screens</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => onNavigate('home')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#E5093A] hover:bg-[#B90732] text-white text-xs font-semibold shadow-md crimson-glow-sm transition-all"
              >
                Enter Streaming Theater
              </button>
              <button
                onClick={() => onNavigate('dashboard')}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold border border-white/10 transition-colors"
              >
                Manage My Devices
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="text-center">
              <StreamPlayMark className="w-12 h-12 mx-auto mb-3 drop-shadow-[0_4px_16px_rgba(229,9,58,0.4)]" />
              <h3 className="text-lg font-bold text-white font-display">
                Member Access Login
              </h3>
              <p className="text-xs text-[#8993A3] mt-1">
                Enter your credentials provided by the platform director.
              </p>
            </div>

            <form onSubmit={handleMemberLogin} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-semibold">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#080B12] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#E5093A]"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 rounded-xl bg-brand-gradient hover:brightness-110 text-white font-semibold transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
              >
                {isLoggingIn ? 'Authenticating...' : 'Sign In with Member Pass'}
              </button>
            </form>

            <div className="pt-3 border-t border-white/5 text-center">
              <p className="text-[11px] text-slate-400">
                Pilot access is provisioned by the platform director. Contact the
                director if you need help signing in — there are no public or
                one-tap test accounts on this platform.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
