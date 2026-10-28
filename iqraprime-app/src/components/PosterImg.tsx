import { POSTER_MANIFEST } from "@/data/poster-manifest";

interface Props {
  id: string;
  alt: string;
  fallback: string;
  className?: string;
  loading?: "lazy" | "eager";
}

/**
 * Real poster with build-time manifest: serves the downloaded photo poster
 * from /art (bundled with the deployment) when available, else the branded
 * SVG art. Build-time data means zero network round-trips, no manifest
 * fetch that can fail, and no broken-image flash.
 */
export default function PosterImg({ id, alt, fallback, className = "", loading = "lazy" }: Props) {
  const file = POSTER_MANIFEST[id];
  const src = file ? `/art/${file}` : fallback;

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={src} alt={alt} loading={loading} className={className} />
  );
}
