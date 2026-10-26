"use client";

import Link from "next/link";
import TitleCard from "@/components/TitleCard";
import { useMyList } from "@/hooks/useMyList";

export default function MyListClient() {
  const { titles, ready } = useMyList();

  if (!ready) {
    return (
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-navy" />
        ))}
      </div>
    );
  }

  if (!titles.length) {
    return (
      <div className="mt-10 rounded-2xl border border-gold/20 bg-navy/60 p-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-gold to-gold-deep text-ink">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m12 20.5-8.2-8.4a5.4 5.4 0 1 1 7.6-7.6l.6.6.6-.6a5.4 5.4 0 1 1 7.6 7.6Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <p className="mt-4 font-display text-xl font-bold text-white">Your list is empty</p>
        <p className="mx-auto mt-2 max-w-sm text-sm text-mist leading-relaxed">
          Tap the heart on any movie or drama to save it here. Your list stays on this device —
          even offline, once the app is installed.
        </p>
        <Link href="/movies" className="btn-gold mt-6 inline-block rounded-lg px-6 py-2.5 text-sm">
          Browse Movies
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
      {titles.map((t) => (
        <div key={t.id} className="w-full [&>a]:w-full">
          <TitleCard t={t} />
        </div>
      ))}
    </div>
  );
}
