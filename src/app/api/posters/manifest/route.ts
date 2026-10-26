import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "public", "posters-real");
let cache: { at: number; ids: string[] } | null = null;

/** Live manifest of downloaded real posters so the UI never renders broken images. */
export async function GET() {
  if (!cache || Date.now() - cache.at > 60_000) {
    let ids: string[] = [];
    try {
      ids = fs
        .readdirSync(DIR)
        .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
        .map((f) => f.replace(/\.(jpe?g|png|webp)$/i, ""));
    } catch {
      ids = [];
    }
    cache = { at: Date.now(), ids };
  }
  return Response.json(
    { ids: cache.ids },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
  );
}
