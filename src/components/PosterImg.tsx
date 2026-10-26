"use client";

import { useState } from "react";

interface Props {
  id: string;
  alt: string;
  fallback: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/** Real poster with graceful fallback: /posters-real/{id}.jpg → provided SVG art. */
export default function PosterImg({ id, alt, fallback, className = "", loading = "lazy" }: Props) {
  const [idx, setIdx] = useState(0);
  const srcs = [`/posters-real/${id}.jpg`, fallback];
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={srcs[Math.min(idx, srcs.length - 1)]}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
