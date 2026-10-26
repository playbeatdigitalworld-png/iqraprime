import { resolveLine, getSeriesInfo } from "@/lib/xtream";

export const dynamic = "force-dynamic";

/** Full seasons + episodes for a provider series (real episode ids for playback). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = Number(url.searchParams.get("id"));
  const line = resolveLine(req);
  if (!line) return Response.json({ error: "no_line" }, { status: 200 });
  if (!id) return Response.json({ error: "bad_id" }, { status: 200 });

  try {
    const data = await getSeriesInfo(line, id);
    const seasons = Array.from(new Set(data.episodes.map((e) => e.season))).sort();
    return Response.json({
      info: {
        name: data.info?.name || "",
        cover: data.info?.cover || "",
        plot: data.info?.plot || "",
        cast: data.info?.cast || "",
        genre: data.info?.genre || "",
        releaseDate: data.info?.releaseDate || "",
        rating: data.info?.rating || 0,
      },
      seasons,
      episodes: data.episodes,
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "provider_error" }, { status: 200 });
  }
}
