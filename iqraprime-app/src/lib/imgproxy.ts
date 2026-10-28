/**
 * IQRAPRIME artwork URL helper.
 *
 * Remote artwork (TMDB posters, panel images) is served through the
 * same-origin /api/img proxy so posters render on networks where
 * image.tmdb.org is unreachable and so plain-HTTP panel images don't
 * trip mixed-content blocking. Local asset paths pass through unchanged.
 *
 * `t` (optional label) is shown on the branded placeholder if the
 * upstream artwork can't be fetched.
 */
export function proxiedImg(u: string | null | undefined, t?: string): string {
  const s = (u || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) return s; // local path (/posters/…, /art/…, data:)
  const q = t ? `&t=${encodeURIComponent(t)}` : "";
  return `/api/img?u=${encodeURIComponent(s)}${q}`;
}
