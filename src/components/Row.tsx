import Link from "next/link";
import type { Title } from "@/lib/catalog";
import TitleCard from "./TitleCard";

interface Props {
  title: string;
  items: Title[];
  href?: string;
  ranked?: boolean;
  viewAllLabel?: string;
}

export default function Row({ title, items, href, ranked = false, viewAllLabel = "View all" }: Props) {
  if (!items.length) return null;
  return (
    <section className="mt-10" aria-label={title}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-baseline justify-between">
        <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
          {title}
          <span className="ml-3 inline-block h-1 w-10 rounded bg-gradient-to-r from-gold to-transparent align-middle" />
        </h2>
        {href && (
          <Link href={href} className="text-sm font-semibold text-gold hover:text-gold-soft transition">
            {viewAllLabel} →
          </Link>
        )}
      </div>
      <div className="mt-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="no-scrollbar flex gap-3.5 overflow-x-auto pb-3 -mx-1 px-1 pt-1">
            {items.map((t, i) => (
              <TitleCard key={t.id} t={t} rank={ranked ? i + 1 : undefined} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
