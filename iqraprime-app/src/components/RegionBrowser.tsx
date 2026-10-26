"use client";

import { useState } from "react";
import type { Title } from "@/lib/catalog";
import TitleCard from "@/components/TitleCard";

interface Props {
  pools: Record<string, Title[]>;
}

/** Movies page with country/region tabs — "All countries" merges everything. */
export default function RegionBrowser({ pools }: Props) {
  const regions = ["All Countries", ...Object.keys(pools)];
  const [active, setActive] = useState("All Countries");

  const items = active === "All Countries" ? Object.values(pools).flat() : pools[active];

  const sorted = [...items].sort((a, b) => b.popularity - a.popularity);

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by region">
        {regions.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={active === r}
            onClick={() => setActive(r)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition border ${
              active === r
                ? "bg-gold text-ink border-gold shadow-[0_0_14px_rgba(255,189,36,0.4)]"
                : "border-gold/25 text-mist hover:text-gold hover:border-gold/50"
            }`}
          >
            {r}
            {r !== "All Countries" && (
              <span className="ml-1.5 opacity-60">{pools[r].length}</span>
            )}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-mist" aria-live="polite">
        {sorted.length} movies
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {sorted.map((t) => (
          <div key={t.id} className="w-full [&>a]:w-full">
            <TitleCard t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}
