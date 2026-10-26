"use client";

import { useMemo, useState } from "react";
import type { Title } from "@/lib/catalog";
import TitleCard from "@/components/TitleCard";

export default function BrowseGrid({ items, allGenres }: { items: Title[]; allGenres: string[] }) {
  const [genre, setGenre] = useState("All");
  const [sort, setSort] = useState<"popularity" | "rating" | "year" | "title">("year");

  const filtered = useMemo(() => {
    let list = genre === "All" ? items : items.filter((t) => t.genres.includes(genre));
    list = [...list];
    switch (sort) {
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
      case "year":
        list.sort((a, b) => b.year - a.year);
        break;
      case "title":
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        list.sort((a, b) => b.popularity - a.popularity);
    }
    return list;
  }, [items, genre, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by genre">
        {["All", ...allGenres].map((g) => (
          <button
            key={g}
            onClick={() => setGenre(g)}
            aria-pressed={genre === g}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition border ${
              genre === g
                ? "bg-gold text-ink border-gold shadow-[0_0_14px_rgba(255,189,36,0.4)]"
                : "border-gold/25 text-mist hover:text-gold hover:border-gold/50"
            }`}
          >
            {g}
          </button>
        ))}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          aria-label="Sort titles"
          className="ml-auto rounded-lg border border-gold/25 bg-navy px-3 py-1.5 text-xs text-white outline-none focus:border-gold"
        >
          <option value="popularity">Most popular</option>
          <option value="rating">Highest rated</option>
          <option value="year">Newest</option>
          <option value="title">A – Z</option>
        </select>
      </div>

      <p className="mt-4 text-xs text-mist" aria-live="polite">
        {filtered.length} title{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {filtered.map((t) => (
          <div key={t.id} className="w-full [&>a]:w-full">
            <TitleCard t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
