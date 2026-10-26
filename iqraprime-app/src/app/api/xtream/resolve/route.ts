import {
  resolveLine,
  getVodInfo,
  getSeriesInfo,
  matchVod,
  matchSeries,
  movieStreamUrl,
  episodeStreamUrl,
} from "@/lib/xtream";

export const dynamic = "force-dynamic";

/**
 * Resolves a REAL playback URL.
 *  - kind=movie&id=STREAM_ID            → direct VOD url (container-aware)
 *  - kind=episode&id=EPISODE_ID&ext=mp4 → direct episode url
 *  - kind=match&title=...&year=...      → fuzzy-match curated title to provider VOD
 *  - kind=matchSeries&title=...         → fuzzy-match curated drama to provider series
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") || "match";
  const line = resolveLine(req);
  if (!line) {
    return Response.json({ error: "no_line", message: "Connect your IPTV line for playback." }, { status: 200 });
  }

  try {
    if (kind === "movie") {
      const id = Number(url.searchParams.get("id"));
      if (!id) return Response.json({ error: "bad_id" }, { status: 200 });
      let ext = url.searchParams.get("ext") || "mp4";
      try {
        const info = await getVodInfo(line, id);
        const fromInfo = (info.movie_data as { container_extension?: string } | undefined)?.container_extension;
        if (fromInfo) ext = String(fromInfo);
      } catch { /* fall back to provided ext */ }
      return Response.json({ url: movieStreamUrl(line, id, ext), ext, kind: "movie", id });
    }

    if (kind === "episode") {
      const id = Number(url.searchParams.get("id"));
      const ext = url.searchParams.get("ext") || "mp4";
      if (!id) return Response.json({ error: "bad_id" }, { status: 200 });
      return Response.json({ url: episodeStreamUrl(line, id, ext), ext, kind: "episode", id });
    }

    if (kind === "match") {
      const title = url.searchParams.get("title") || "";
      const year = Number(url.searchParams.get("year")) || undefined;
      if (!title) return Response.json({ error: "bad_title" }, { status: 200 });
      const hit = await matchVod(line, title, year);
      if (!hit) return Response.json({ found: false });
      return Response.json({
        found: true,
        kind: "movie",
        id: hit.stream_id,
        name: hit.name,
        ext: hit.container_extension || "mp4",
        url: movieStreamUrl(line, hit.stream_id, hit.container_extension || "mp4"),
      });
    }

    if (kind === "matchSeries") {
      const title = url.searchParams.get("title") || "";
      if (!title) return Response.json({ error: "bad_title" }, { status: 200 });
      const hit = await matchSeries(line, title);
      if (!hit) return Response.json({ found: false });
      return Response.json({ found: true, kind: "series", id: hit.series_id, name: hit.name });
    }

    return Response.json({ error: "bad_kind" }, { status: 200 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "provider_error" }, { status: 200 });
  }
}
