"use client";

import { useEffect, useState } from "react";

let manifestPromise: Promise<Record<string, string>> | null = null;

function loadManifest(): Promise<Record<string, string>> {
  if (!manifestPromise) {
    manifestPromise = fetch("/art/index.json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return manifestPromise;
}

interface Props {
  id: string;
  fallback: string;
  alt: string;
  className?: string;
  eager?: boolean;
}

/**
 * Renders the real poster for a title when one exists in /public/art
 * (driven by art/index.json), falling back to the branded SVG art.
 * Swaps automatically once real posters become available.
 */
export default function PosterImg({ id, fallback, alt, className = "", eager = false }: Props) {
  const [real, setReal] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadManifest().then((m) => {
      if (alive && m[id]) setReal(`/art/${m[id]}`);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={real || fallback}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      className={className}
    />
  );
}
