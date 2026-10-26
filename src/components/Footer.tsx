"use client";

import Link from "next/link";
import InstallButton from "./InstallButton";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gold/15 bg-navy/60">
      {/* Install Our App block */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        <div className="rounded-2xl border border-gold/25 bg-gradient-to-r from-navy-2 via-navy to-ink p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-white">
              Install <span className="text-gold gold-glow-text">Our App</span>
            </h2>
            <p className="mt-2 text-sm text-mist leading-relaxed max-w-xl">
              Take IQRAPRIME everywhere. Install the app for fullscreen streaming, faster launches
              and your My List — always one tap away on your Home Screen.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <InstallButton label="Install Our App" />
          </div>
        </div>
      </div>

      <div className="border-t border-gold/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/logo-header.png" alt="IQRAPRIME" className="h-14 w-auto" />
            </div>
            <p className="mt-3 text-xs text-mist leading-relaxed max-w-xs">
              Kahani Jo Dil Chhoo Jaye — stories that touch the heart. Movies and Pakistani dramas,
              curated for every mood.
            </p>
          </div>
          <nav aria-label="Footer">
            <h3 className="text-sm font-semibold text-gold mb-3">Browse</h3>
            <ul className="space-y-2 text-sm text-mist">
              <li><Link href="/movies" className="hover:text-gold transition">Movies</Link></li>
              <li><Link href="/dramas" className="hover:text-gold transition">Pakistani Dramas</Link></li>
              <li><Link href="/search" className="hover:text-gold transition">Search</Link></li>
              <li><Link href="/my-list" className="hover:text-gold transition">My List</Link></li>
            </ul>
          </nav>
          <div>
            <h3 className="text-sm font-semibold text-gold mb-3">About</h3>
            <p className="text-xs text-mist leading-relaxed">
              IQRAPRIME is a progressive web app. Works online and offline, installs like a native
              app on Android, iOS and desktop.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gold/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-mist">© {new Date().getFullYear()} IQRAPRIME. All rights reserved.</p>
          <p className="text-xs text-mist">Kahani Jo Dil Chhoo Jaye.</p>
        </div>
      </div>
    </footer>
  );
}
