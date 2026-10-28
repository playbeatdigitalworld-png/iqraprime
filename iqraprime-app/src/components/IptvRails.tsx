"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { proxiedImg } from "@/lib/imgproxy";

/**
 * IptvRails — renders real provider titles (baked snapshots from the IPTV line)
 * as horizontal rails, 2026 releases always first. Every card opens the live
 * provider detail page where the built-in player streams the title directly.
 */

export interface IptvItem {
  i: number;
  n: string;
  y: number | null;
  r: number;
  e?: string;
  g?: string;
  p: string;
}

export interface SectionSpec {
  file: string;
  title: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  limit?: number;
}

const cache = new Map<string, IptvItem[]>();

async function loadSection(file: string): Promise<IptvItem[]> {
  const hit = cache.get(file);
  if (hit) return hit;
  const res = await fetch(`/iptv/${file}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as IptvItem[];
  cache.set(file, data);
  return data;
}

function isSeriesFile(file: string) {
  return /-series$|-web$/.test(file);
}

function IptvCard({ item, kind }: { item: IptvItem; kind: "movie" | "series" }) {
  const [broken, setBroken] = useState(false);
  const href = kind === "series" ? `/iptv/series/${item.i}` : `/iptv/movie/${item.i}`;
  return (
    <Link
      href={href}
      className="group card-hover relative block w-[150px] sm:w-[168px] shrink-0 rounded-xl overflow-hidden border border-gold/10 bg-navy"
      aria-label={`${item.n}${item.y ? ` (${item.y})` : ""}`}
    >
      <div className="relative aspect-[2/3] bg-gradient-to-br from-navy-2 to-ink">
        {item.p && !broken ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={proxiedImg(item.p, item.n)}
            alt={`${item.n} poster`}
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center px-3 text-center">
            <span className="font-display text-sm font-bold text-gold/70 line-clamp-3">{item.n}</span>
          </div>
        )}
        {item.r > 0 && (
          <span className="absolute right-2 top-2 rounded-md bg-ink/80 backdrop-blur px-1.5 py-0.5 text-[11px] font-bold text-gold border border-gold/30">
            ★ {item.r.toFixed(1)}
          </span>
        )}
        <span className="absolute left-2 bottom-2 rounded-md bg-gold/90 px-1.5 py-0.5 text-[10px] font-bold text-ink uppercase tracking-wide">
          {kind === "series" ? "Series" : "Movie"}
        </span>
        {item.y === 2026 && (
          <span className="absolute right-2 bottom-2 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-black text-ink shadow">
            2026
          </span>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition">
          {item.n}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-mist">
          {item.y ? item.y : "New"}{item.g ? ` · ${item.g}` : ""}
        </p>
      </div>
    </Link>
  );
}

function IptvRail({ spec }: { spec: SectionSpec }) {
  const kind = isSeriesFile(spec.file) ? "series" : "movie";
  const [items, setItems] = useState<IptvItem[] | null>(cache.get(spec.file) || null);

  useEffect(() => {
    if (items) return;
    let dead = false;
    loadSection(spec.file)
      .then((list) => {
        if (!dead) setItems(list);
      })
      .catch(() => {
        /* rail silently hidden if snapshot missing */
      });
    return () => {
      dead = true;
    };
  }, [spec.file, items]);

  if (!items || !items.length) return null;
  const shown = items.slice(0, spec.limit ?? 20);

  return (
    <section className="mt-10" aria-label={spec.title}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-baseline justify-between">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
          {spec.title}
          <span className="ml-3 inline-block h-1 w-10 rounded bg-gradient-to-r from-gold to-transparent align-middle" />
        </h2>
        {spec.viewAllHref && (
          <Link
            href={spec.viewAllHref}
            className="text-sm font-semibold text-gold hover:text-gold-soft transition"
          >
            {spec.viewAllLabel || "View all"} →
          </Link>
        )}
      </div>
      <div className="mt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-3 -mx-1 px-1 pt-1">
            {shown.map((it, idx) => (
              <IptvCard key={`${it.i}-${idx}`} item={it} kind={kind} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function IptvRails({ sections }: { sections: SectionSpec[] }) {
  return (
    <>
      {sections.map((s) => (
        <IptvRail key={s.file + s.title} spec={s} />
      ))}
    </>
  );
}
