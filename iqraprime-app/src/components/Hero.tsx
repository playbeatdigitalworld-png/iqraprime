"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Title } from "@/lib/catalog";
import MyListButton from "./MyListButton";

export default function Hero({ items }: { items: Title[] }) {
  const [idx, setIdx] = useState(0);
  // track which hero images are portrait (posters) so we can render the ambient-blur layout
  const [portrait, setPortrait] = useState<Record<string, boolean>>({});

  // detect orientation — must handle images that completed BEFORE React attached onLoad (cache)
  const probe = (el: HTMLImageElement | null, id: string) => {
    if (!el || !el.complete || !el.naturalWidth) return;
    const np = el.naturalHeight > el.naturalWidth * 1.05;
    setPortrait((prev) => (prev[id] === np ? prev : { ...prev, [id]: np }));
  };

  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 8000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items.length) return null;
  const hero = items[idx];
  const isPortrait = portrait[hero.id];

  return (
    <section
      className="relative -mt-16 h-[78vh] min-h-[520px] max-h-[760px] overflow-hidden"
      aria-label="Featured"
    >
      {items.map((it, i) => {
        const p = portrait[it.id];
        return (
          <div
            key={it.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? "opacity-100" : "opacity-0"}`}
            aria-hidden={i !== idx}
          >
            {/* ambient layer — always blurred so text stays readable */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.backdrop}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover scale-125 blur-2xl ${p ? "opacity-60" : "opacity-0"}`}
              loading={i === 0 ? "eager" : "lazy"}
            />
            {/* main layer — sharp cover for landscape stills */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={it.backdrop}
              alt=""
              ref={(el) => probe(el, it.id)}
              onLoad={(e) => probe(e.currentTarget, it.id)}
              className={`absolute inset-0 h-full w-full transition-all duration-700 ${
                p === undefined ? "opacity-0" : p ? "opacity-0" : "object-cover opacity-100"
              }`}
              loading={i === 0 ? "eager" : "lazy"}
            />
          </div>
        );
      })}

      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/40 to-transparent" />

      {/* sharp poster card on the right when the source art is portrait */}
      {isPortrait && (
        <div className="absolute right-6 lg:right-16 bottom-16 sm:bottom-20 hidden sm:block pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.backdrop}
            alt=""
            className="h-[46vh] max-h-[420px] w-auto rounded-xl border border-gold/25 shadow-[0_24px_60px_rgba(0,0,0,0.65)]"
          />
        </div>
      )}

      <div className="relative h-full mx-auto max-w-7xl px-4 sm:px-6 flex flex-col justify-end pb-16 sm:pb-20">
        <div className="max-w-2xl fade-up" key={hero.id}>
          <div className="flex items-center gap-3 text-xs font-semibold tracking-widest">
            <span className="rounded-md bg-gold px-2 py-1 text-ink">#{idx + 1} FEATURED</span>
            <span className="text-gold">{hero.kind === "drama" ? "PAKISTANI DRAMA" : hero.kind === "series" ? "WEB SERIES" : "MOVIE"}</span>
          </div>

          <h1 className="mt-4 font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white gold-glow-text">
            {hero.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mist">
            <span className="text-gold font-bold">★ {hero.rating.toFixed(1)}</span>
            <span>{hero.year}</span>
            <span className="text-gold/60">•</span>
            <span>{hero.meta}</span>
            <span className="text-gold/60">•</span>
            <span>{hero.genres.slice(0, 2).join(" · ")}</span>
          </div>

          <p className="mt-4 text-sm sm:text-base text-white/85 leading-relaxed line-clamp-3">
            {hero.synopsis}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/title/${hero.id}`}
              className="btn-gold inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
              </svg>
              Play Now
            </Link>
            <MyListButton id={hero.id} />
          </div>

          <div className="mt-8 flex items-center gap-2" role="tablist" aria-label="Featured selection">
            {items.map((it, i) => (
              <button
                key={it.id}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Show ${it.title}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-8 bg-gold" : "w-4 bg-white/25 hover:bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
