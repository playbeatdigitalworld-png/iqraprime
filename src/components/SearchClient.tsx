"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TitleCard from "@/components/TitleCard";
import { searchTitles } from "@/lib/catalog";

const SUGGESTIONS = ["Humsafar", "Tere Bin", "Pathaan", "Fawad Khan", "Inception", "Mahira Khan", "Comedy"];

export default function SearchClient() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const pre = new URLSearchParams(window.location.search).get("q") ?? "";
    setQ(pre);
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => (q.trim() ? searchTitles(q) : []), [q]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-10 pb-16">
      <h1 className="font-display text-3xl font-bold text-white">Search</h1>
      <p className="mt-1 text-sm text-mist">Find movies, dramas, cast and genres.</p>

      <form
        className="mt-6 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.replace(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
        role="search"
      >
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mist"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles, cast, genres…"
            aria-label="Search titles"
            className="w-full rounded-xl border border-gold/25 bg-navy py-3 pl-12 pr-4 text-sm text-white placeholder:text-mist/60 outline-none focus:border-gold focus:shadow-[0_0_18px_rgba(255,189,36,0.2)] transition"
          />
        </div>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setQ(s)}
            className="rounded-full border border-gold/20 px-3 py-1 text-xs text-mist hover:text-gold hover:border-gold/50 transition"
          >
            {s}
          </button>
        ))}
      </div>

      {q.trim() ? (
        <div className="mt-8">
          <p className="text-xs text-mist" aria-live="polite">
            {results.length} result{results.length === 1 ? "" : "s"} for &quot;{q}&quot;
          </p>
          {results.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {results.map((t) => (
                <div key={t.id} className="w-full [&>a]:w-full">
                  <TitleCard t={t} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-10 rounded-2xl border border-gold/20 bg-navy/60 p-8 text-center">
              <p className="font-display text-xl text-white">No stories found</p>
              <p className="mt-2 text-sm text-mist">
                Try a different title, actor name or genre.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
