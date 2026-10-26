// Upload full catalog.json to Supabase Storage bucket "catalog"
import { MOVIES } from "../src/data/movies.ts";
import { DRAMAS } from "../src/data/dramas.ts";
import fs from "node:fs";

const SUPABASE_URL = "https://sryvcjphsezqvuzybwnh.supabase.co";
const SRK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyeXZjanBoc2V6cXZ1enlid25oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzAyODU0NywiZXhwIjoyMTA4NjA0NTQ3fQ.nz3-063op0urlO4DPS9ebh7iuHCsUHDrcZTsNt4j78w";

const payload = {
  brand: "IQRAPRIME",
  tagline: "Kahani Jo Dil Chhoo Jaye.",
  updatedAt: new Date().toISOString(),
  counts: { movies: MOVIES.length, dramas: DRAMAS.length },
  movies: MOVIES.map((m) => ({
    ...m,
    poster: `/posters-real/${m.id}.jpg`,
    posterFallback: `/posters/${m.id}.svg`,
    kind: "movie",
  })),
  dramas: DRAMAS.map((d) => ({
    ...d,
    poster: `/posters-real/${d.id}.jpg`,
    posterFallback: `/posters/${d.id}.svg`,
    kind: "drama",
  })),
};

const body = JSON.stringify(payload);
const res = await fetch(`${SUPABASE_URL}/storage/v1/object/catalog/catalog.json`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${SRK}`,
    "Content-Type": "application/json",
    "x-upsert": "true",
  },
  body,
});
const txt = await res.text();
console.log("upload catalog.json:", res.status, txt.slice(0, 200));
console.log("size:", (body.length / 1024).toFixed(1), "KB");
