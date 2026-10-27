#!/usr/bin/env node
/**
 * IQRAPRIME — bake real IPTV catalog snapshots into public/iptv/*.json
 * Source: full player_api dumps (get_vod_streams / get_series) fetched from the provider.
 * Ordering: 2026 FIRST everywhere, then newest year, then rating.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd(), "public", "iptv");
mkdirSync(ROOT, { recursive: true });

const VOD = JSON.parse(readFileSync("/tmp/vod.json", "utf8"));
const SER = JSON.parse(readFileSync("/tmp/series.json", "utf8"));
console.log(`source: ${VOD.length} vod, ${SER.length} series`);

const YEAR_RE = /\((19|20)\d{2}\)/;
const yearOf = (name) => {
  const m = String(name || "").match(/\((19|20)(\d{2})\)/);
  return m ? Number(m[0].slice(1, -1)) : null;
};

/** Clean display name: strip "IN-EN:" / "PK:" prefixes and "(2026)" suffix */
function cleanName(raw) {
  let n = String(raw || "").replace(/\.$/, "");
  n = n.replace(/^[A-Za-z]{1,3}(?:-[A-Za-z]{1,4})?:\s*/, "");
  n = n.replace(/\s*\((19|20)\d{2}\)\s*$/, "").trim();
  return n || String(raw);
}

/** Trim an entry to the minimum the UI needs */
function vodEntry(v) {
  return {
    i: v.stream_id ?? v.num,
    n: cleanName(v.name),
    y: yearOf(v.name) || (v.added ? new Date(Number(v.added) * 1000).getFullYear() : null),
    r: Math.round((Number(v.rating) || 0) * 10) / 10,
    e: v.container_extension || "mp4",
    p: v.stream_icon || "",
  };
}

function serEntry(s) {
  return {
    i: s.series_id,
    n: cleanName(s.name),
    y: s.releaseDate ? new Date(s.releaseDate).getFullYear() || null : null,
    r: Math.round((Number(s.rating) || 0) * 10) / 10,
    g: (s.genre || "").split(/[,|]/)[0]?.trim() || "",
    p: s.cover || "",
  };
}

/** 2026 first, then newest, then rating */
const yearSort = (a, b) =>
  (b.y === 2026) - (a.y === 2026) || (b.y || 0) - (a.y || 0) || b.r - a.r;
const dateSort = (a, b) => (b.y === 2026) - (a.y === 2026) || (b.y || 0) - (a.y || 0) || b.r - a.r;

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const it of list) {
    const key = `${it.n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()}|${it.y || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function vodSection(ids, { top = 0, sort = yearSort } = {}) {
  const idset = new Set(ids.map(String));
  let list = VOD.filter((v) => idset.has(String(v.category_id))).map(vodEntry);
  list = dedupe(list).sort(sort);
  if (top > 0) list = list.slice(0, top);
  return list;
}

function serSection(ids, { top = 0 } = {}) {
  const idset = new Set(ids.map(String));
  let list = SER.filter((s) => idset.has(String(s.category_id))).map(serEntry);
  list = dedupe(list).sort(dateSort);
  if (top > 0) list = list.slice(0, top);
  return list;
}

const sections = {
  // ---- MOVIES ----
  "in-2026": vodSection([1049, 1050, 1061, 1062, 1063, 1064]),
  "en-2026": vodSection([1051], { top: 240 }),
  "pk-movies": vodSection([373, 376]),
  "bd-movies": vodSection([144, 674]),
  "in-hindi": vodSection([778], { top: 400 }),
  "in-hindi-dubbed": vodSection([489, 1121], { top: 240 }),
  "in-south": vodSection([780, 781, 1116, 1119], { top: 480 }),
  // ---- SERIES ----
  "pk-series": serSection([308, 608, 628]),
  "bd-series": serSection([419]),
  "in-series": serSection([306], { top: 400 }),
  "in-web": serSection([570, 495, 656, 454, 408], { top: 400 }),
};

const manifest = { generated: new Date().toISOString(), sections: {} };
let totalEntries = 0;
for (const [name, list] of Object.entries(sections)) {
  writeFileSync(join(ROOT, `${name}.json`), JSON.stringify(list));
  const y2026 = list.filter((x) => x.y === 2026).length;
  manifest.sections[name] = { count: list.length, y2026 };
  totalEntries += list.length;
  const sample = list.slice(0, 3).map((x) => `${x.n}${x.y ? ` (${x.y})` : ""}`).join(" | ");
  console.log(`${name}.json: ${list.length} entries (${y2026} from 2026) — ${sample}`);
}
writeFileSync(join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`TOTAL: ${totalEntries} real provider titles baked → public/iptv/`);
