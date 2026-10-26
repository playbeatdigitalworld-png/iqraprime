import React from 'react';
import { ArrowRight, Clapperboard, Radio, ShieldCheck, Tv } from 'lucide-react';

interface HeroBannerProps {
  channelCount: number;
  onWatchLive: () => void;
  onNavigate: (section: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({ channelCount, onWatchLive, onNavigate }) => (
  <section className="relative isolate overflow-hidden border-b border-amber-300/10 bg-[#060912]">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_78%_40%,rgba(21,72,132,0.42),transparent_44%),radial-gradient(ellipse_at_12%_100%,rgba(173,111,24,0.13),transparent_38%)]" />
    <div className="absolute inset-0 -z-10 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:linear-gradient(to_right,transparent,black,transparent)]" />

    <div className="relative mx-auto grid min-h-[520px] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
      <div className="max-w-2xl">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-200/[0.06] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-100">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
          A better way to watch
        </div>
        <h1 className="font-display text-5xl font-black leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Your world of
          <span className="mt-2 block bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text pb-2 text-transparent">
            entertainment.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
          Live channels, movies, and series in one place. Your authorized provider brings the channels, titles, and artwork to your screen.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            onClick={onWatchLive}
            className="group inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-amber-300 to-yellow-500 px-5 py-3 text-sm font-extrabold text-[#171006] shadow-[0_8px_32px_rgba(245,158,11,0.2)] transition hover:brightness-110"
          >
            <Tv className="h-4 w-4" />
            Explore Live TV
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button
            onClick={() => onNavigate('movies')}
            className="rounded-lg border border-white/15 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:border-amber-200/30 hover:bg-white/[0.08]"
          >
            Browse movies &amp; series
          </button>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span className="inline-flex items-center gap-2"><Radio className="h-3.5 w-3.5 text-amber-300" /> Live TV</span>
          <span className="h-1 w-1 rounded-full bg-amber-400/70" />
          <span className="inline-flex items-center gap-2"><Clapperboard className="h-3.5 w-3.5 text-amber-300" /> Movies &amp; series</span>
          <span className="h-1 w-1 rounded-full bg-amber-400/70" />
          <span>One storefront</span>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[510px]">
        <div className="absolute -inset-8 -z-10 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -right-5 top-4 h-48 w-48 rounded-full border border-sky-300/15 sm:h-64 sm:w-64" />
        <div className="absolute -right-1 top-8 h-40 w-40 rounded-full border border-amber-300/20 sm:h-56 sm:w-56" />
        <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#090f1d]/90 p-5 shadow-[0_30px_100px_rgba(0,0,0,0.55)] backdrop-blur sm:p-7">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">PlayBeat</div>
              <div className="mt-1 text-lg font-bold text-white">Your entertainment hub</div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200/20 bg-amber-200/[0.07] text-amber-200">
              <Tv className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {[
              { label: 'Live TV', icon: Radio, section: 'live' },
              { label: 'Movies', icon: Clapperboard, section: 'movies' },
              { label: 'Series', icon: Tv, section: 'series' }
            ].map(({ label, icon: Icon, section }) => (
              <button
                key={section}
                onClick={() => onNavigate(section)}
                className="group rounded-xl border border-white/[0.09] bg-white/[0.035] px-2 py-4 text-center transition hover:border-amber-200/30 hover:bg-amber-200/[0.06]"
              >
                <Icon className="mx-auto h-5 w-5 text-amber-300 transition group-hover:scale-110" />
                <span className="mt-2 block text-xs font-semibold text-slate-200">{label}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-amber-200/15 bg-gradient-to-r from-amber-200/[0.08] to-transparent p-4">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.55)]" />
              <div>
                <div className="text-sm font-bold text-white">
                  {channelCount > 0 ? `${channelCount.toLocaleString()} cached channel listings` : 'Provider connection needed'}
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {channelCount > 0
                    ? 'An authorized HTTPS provider is needed to refresh listings and verify live playback.'
                    : 'Connect an authorized provider to load real channels, titles, and artwork.'}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            <span>Real catalog content only</span>
            <ShieldCheck className="h-4 w-4 text-amber-300/70" />
          </div>
        </div>
        <div className="absolute -bottom-4 -left-3 hidden h-14 w-14 rounded-xl border border-amber-200/20 bg-[#0b1221] shadow-xl sm:flex sm:items-center sm:justify-center">
          <Clapperboard className="h-6 w-6 text-amber-300" />
        </div>
      </div>
    </div>
    <div className="absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
  </section>
);
