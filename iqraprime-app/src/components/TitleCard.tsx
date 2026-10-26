import Link from "next/link";
import type { Title } from "@/lib/catalog";
import PosterImg from "./PosterImg";

export default function TitleCard({ t, rank }: { t: Title; rank?: number }) {
  return (
    <Link
      href={`/title/${t.id}`}
      className="group card-hover relative block w-[150px] sm:w-[168px] shrink-0 rounded-xl overflow-hidden border border-gold/10 bg-navy"
      aria-label={`${t.title} (${t.year})`}
    >
      <div className="relative aspect-[2/3]">
        <PosterImg
          id={t.id}
          fallback={t.poster}
          alt={`${t.title} poster`}
          className="h-full w-full object-cover"
        />
        {typeof rank === "number" && (
          <span className="absolute left-0 top-2 rounded-r-lg bg-gradient-to-r from-gold to-gold-deep px-2.5 py-0.5 text-xs font-black text-ink shadow">
            #{rank}
          </span>
        )}
        <span className="absolute right-2 top-2 rounded-md bg-ink/80 backdrop-blur px-1.5 py-0.5 text-[11px] font-bold text-gold border border-gold/30">
          ★ {t.rating.toFixed(1)}
        </span>
        <span className="absolute left-2 bottom-2 rounded-md bg-gold/90 px-1.5 py-0.5 text-[10px] font-bold text-ink uppercase tracking-wide">
          {t.kind === "drama" ? "Drama" : t.kind === "series" ? "Series" : "Movie"}
        </span>
        {t.year >= 2026 && (
          <span className="absolute right-2 bottom-2 rounded-md bg-gold px-1.5 py-0.5 text-[10px] font-black text-ink shadow">
            2026
          </span>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="truncate text-sm font-semibold text-white group-hover:text-gold transition">
          {t.title}
        </h3>
        <p className="mt-0.5 truncate text-[11px] text-mist">
          {t.year} · {t.genres.slice(0, 2).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
