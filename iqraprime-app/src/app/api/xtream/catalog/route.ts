import { resolveLine, getVodStreams, getSeries, getCategories, type VodStream, type SeriesItem } from "@/lib/xtream";

export const dynamic = "force-dynamic";

interface ProviderItem {
  kind: "movie" | "series";
  id: number;
  name: string;
  poster: string;
  rating: number;
  year: number | null;
  category: string;
  ext?: string;
  plot?: string;
  genre?: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "movies") as "movies" | "series";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const categoryId = url.searchParams.get("category") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = Math.min(120, Math.max(12, Number(url.searchParams.get("page_size") || 60)));

  const line = resolveLine(req);
  if (!line) {
    return Response.json({ error: "no_line", message: "Connect your IPTV line to browse the full provider library." }, { status: 200 });
  }

  try {
    const [cats, raw] = await Promise.all([
      getCategories(line, type === "movies" ? "vod" : "series"),
      type === "movies"
        ? getVodStreams(line).then((l: VodStream[]) => l)
        : getSeries(line).then((l: SeriesItem[]) => l),
    ]);
    const catName = new Map(cats.map((c) => [String(c.category_id), c.category_name]));

    let items: ProviderItem[] = raw.map((row) => {
      const s = row as VodStream & SeriesItem;
      const isMovie = type === "movies";
      const added = s.added ? new Date(Number(s.added) * 1000) : null;
      return {
        kind: isMovie ? "movie" : "series",
        id: isMovie ? Number(s.stream_id) : Number(s.series_id),
        name: String(s.name || "").replace(/\.$/, ""),
        poster: String((isMovie ? s.stream_icon : s.cover) || ""),
        rating: Math.round((Number(s.rating) || 0) * 10) / 10,
        year: isMovie
          ? added && !isNaN(added.getTime())
            ? added.getFullYear()
            : null
          : s.releaseDate
            ? new Date(s.releaseDate).getFullYear()
            : null,
        category: catName.get(String(s.category_id)) || "Other",
        ext: isMovie ? s.container_extension || "mp4" : undefined,
        plot: s.plot || "",
        genre: s.genre || "",
      };
    });

    if (categoryId) {
      const wanted = catName.get(String(categoryId)) || categoryId;
      items = items.filter((i) => i.category === wanted);
    }
    if (q) items = items.filter((i) => i.name.toLowerCase().includes(q));

    items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return Response.json({
      total,
      page,
      page_size: pageSize,
      pages: Math.ceil(total / pageSize),
      categories: cats.map((c) => c.category_name),
      items: paged,
      connected: true,
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "provider_error", connected: false },
      { status: 200 }
    );
  }
}
