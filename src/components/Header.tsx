"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import InstallButton from "./InstallButton";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/dramas", label: "Dramas" },
  { href: "/web-series", label: "Web Series" },
  { href: "/my-list", label: "My List" },
];

export default function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-ink/90 backdrop-blur-md border-b border-gold/15 shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
          : "bg-gradient-to-b from-ink/90 via-ink/40 to-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center shrink-0" aria-label="IQRAPRIME home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/logo-header.png"
            alt="IQRAPRIME — Kahani Jo Dil Chhoo Jaye"
            className="h-14 w-auto"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4" aria-label="Primary">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  active ? "text-gold bg-gold/10" : "text-mist hover:text-white hover:bg-white/5"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
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
          <span className="hidden sm:block">
            <InstallButton compact />
          </span>
          <button
            className="md:hidden grid h-9 w-9 place-items-center rounded-lg border border-gold/25 text-mist hover:text-gold transition"
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
        <nav className="md:hidden border-t border-gold/15 bg-ink/95 backdrop-blur-md px-4 py-3" aria-label="Mobile">
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
            <span className="mt-1 sm:hidden">
              <InstallButton compact className="w-full justify-center" />
            </span>
          </div>
        </nav>
      )}
    </header>
  );
}
