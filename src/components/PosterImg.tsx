"use client";

import { useEffect, useState } from "react";

interface Props {
  id: string;
  alt: string;
  fallback: string;
  className?: string;
  loading?: "lazy" | "eager";
}

// Module-level manifest cache shared by all poster instances.
let manifestCache: { ids: Set<string>; at: number } | null = null;
let manifestPromise: Promise<Set<string>> | null = null;

function loadManifest(): Promise<Set<string>> {
  if (manifestCache && Date.now() - manifestCache.at < 60_000) return Promise.resolve(manifestCache.ids);
  if (!manifestPromise) {
    manifestPromise = fetch("/api/posters/manifest", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ids?: string[] }) => {
        const set = new Set(d.ids || []);
        manifestCache = { ids: set, at: Date.now() };
        return set;
      })
      .catch(() => new Set<string>())
      .finally(() => {
        manifestPromise = null;
      });
  }
  return manifestPromise;
}

/** Real poster with manifest-aware fallback: real jpg if downloaded, else branded SVG. Never broken. */
export default function PosterImg({ id, alt, fallback, className = "", loading = "lazy" }: Props) {
  const [hasReal, setHasReal] = useState<boolean | null>(manifestCache?.ids.has(id) ?? null);

  useEffect(() => {
    let dead = false;
    loadManifest().then((set) => {
      if (!dead) setHasReal(set.has(id));
    });
    return () => {
      dead = true;
    };
  }, [id]);

  // While unknown, render the guaranteed SVG (no broken-image flash).
  const src = hasReal ? `/posters-real/${id}.jpg` : fallback;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={src} alt={alt} loading={loading} className={className} />
  );
}
