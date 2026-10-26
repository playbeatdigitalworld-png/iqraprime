// Upload the full IQRAPRIME catalog + real posters to Supabase Storage (bucket: catalog)
import { MOVIES } from "../src/data/movies.ts";
import { MOVIES_EXTRA } from "../src/data/movies-extra.ts";
import { DRAMAS } from "../src/data/dramas.ts";
import { WEB_SERIES } from "../src/data/webseries.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project/iqraprime-app";
const ART = path.join(ROOT, "public", "art");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sryvcjphsezqvuzybwnh.supabase.co";
const SRK =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeXZjanBoc2V6cXZ1enlid25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzAyODU0NywiZXhwIjoyMTA4NjA0NTQ3fQ.nz3-063op0urlO4DPS9ebh7iuHCsUHDrcZTsNt4j78w";

async function upload(name, body, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/catalog/${name}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SRK}`,
      "Content-Type": contentType,
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok && res.status !== 200) {
    const t = await res.text();
    throw new Error(`${name}: ${res.status} ${t.slice(0, 120)}`);
  }
  return true;
}

async function main() {
  const artIndex = fs.existsSync(path.join(ART, "index.json"))
    ? JSON.parse(fs.readFileSync(path.join(ART, "index.json"), "utf8"))
    : {};

  const catalog = {
    brand: "IQRAPRIME",
    tagline: "Kahani Jo Dil Chhoo Jaye.",
    updatedAt: new Date().toISOString(),
    counts: { movies: MOVIES.length + MOVIES_EXTRA.length, dramas: DRAMAS.length, webseries: WEB_SERIES.length },
    movies: [...MOVIES, ...MOVIES_EXTRA],
    dramas: DRAMAS,
    webseries: WEB_SERIES,
    artIndex,
  };

  await upload("catalog.json", JSON.stringify(catalog), "application/json");
  console.log(`catalog.json uploaded (${catalog.counts.movies} movies, ${catalog.counts.dramas} dramas, ${catalog.counts.webseries} web series)`);

  let n = 0;
  const files = Object.values(artIndex);
  for (const f of files) {
    try {
      const buf = fs.readFileSync(path.join(ART, f));
      const ct = f.endsWith(".png") ? "image/png" : f.endsWith(".webp") ? "image/webp" : "image/jpeg";
      await upload(`art/${f}`, buf, ct);
      n++;
    } catch (e) {
      console.error("skip", f, String(e).slice(0, 80));
    }
  }
  await upload("art/index.json", JSON.stringify(artIndex), "application/json");
  console.log(`art uploaded: ${n}/${files.length} posters → ${SUPABASE_URL}/storage/v1/object/public/catalog/`);
}

main().catch((e) => {
  console.error("UPLOAD FAILED:", e.message);
  process.exit(1);
});
