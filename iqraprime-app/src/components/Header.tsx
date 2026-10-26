"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import InstallButton from "./InstallButton";
import IptvLineDialog from "./IptvLineDialog";
import { useIptvLine } from "@/hooks/useIptvLine";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/dramas", label: "Dramas" },
  { href: "/iptv", label: "IPTV Library" },
  { href: "/my-list", label: "My List" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const { connected, ping, ready } = useIptvLine();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <>
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-ink/90 backdrop-blur-md border-b border-gold/15 shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
            : "bg-gradient-to-b from-ink/90 via-ink/40 to-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0" aria-label="IQRAPRIME home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand-logo.png"
              alt="IQRAPRIME logo"
              className="h-9 w-auto rounded-md border border-gold/25 object-cover shadow-[0_0_14px_rgba(255,189,36,0.25)]"
            />
            <span className="hidden sm:block font-display text-xl tracking-wide font-bold">
              <span className="text-gold gold-glow-text">IQRA</span>
              <span className="text-white">PRIME</span>
            </span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 ml-3" aria-label="Primary">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active ? "text-gold bg-gold/10" : "text-mist hover:text-white hover:bg-white/5"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <button
              onClick={() => setLineOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition"
              aria-label="IPTV line status — click to configure"
              title={connected ? `IPTV line connected${ping?.expiry ? ` till ${new Date(ping.expiry).toLocaleDateString()}` : ""}` : "Connect your IPTV line"}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  !ready || !ping ? "bg-mist animate-pulse" : connected ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-red-400"
                }`}
              />
              <span className={connected ? "text-emerald-300" : "text-mist"}>{connected ? "Live" : "Connect"}</span>
            </button>

            <Link
              href="/search"
              aria-label="Search titles"
              className="grid h-9 w-9 place-items-center rounded-lg border border-gold/25 text-mist hover:text-gold hover:border-gold/50 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </Link>
            <span className="hidden md:block">
              <InstallButton compact />
            </span>
            <button
              className="lg:hidden grid h-9 w-9 place-items-center rounded-lg border border-gold/25 text-mist hover:text-gold transition"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label="Toggle menu"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="lg:hidden border-t border-gold/15 bg-ink/95 backdrop-blur-md px-4 py-3" aria-label="Mobile">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium ${
                      active ? "text-gold bg-gold/10" : "text-mist hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {n.label}
                  </Link>
                );
              })}
              <button
                onClick={() => setLineOpen(true)}
                className="mt-1 flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-mist hover:bg-white/5"
              >
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
                IPTV Line — {connected ? "Connected" : "Not connected"}
              </button>
              <span className="sm:hidden mt-1">
                <InstallButton compact className="w-full justify-center" />
              </span>
            </div>
          </nav>
        )}
      </header>

      <IptvLineDialog open={lineOpen} onClose={() => setLineOpen(false)} onSaved={() => { window.dispatchEvent(new CustomEvent("iqraprime:line-changed")); }} />
    </>
  );
}
