// Fetch REAL cinematic backdrops (landscape) for hero/trending titles via z-ai image-search
// Saves to public/backdrops/{id}.jpg and writes src/data/backdrop-manifest.ts
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const ROOT = "/home/z/my-project/iqraprime-app";
const OUT = path.join(ROOT, "public", "backdrops");
const TMP = "/tmp/backdrops";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

// parse TS data files with regex (no TS runtime needed)
function parseEntries(file) {
  const txt = fs.readFileSync(path.join(ROOT, "src", "data", file), "utf8");
  const out = [];
  const re = /id:\s*"([^"]+)"[\s\S]{0,400}?title:\s*"([^"]+)"[\s\S]{0,200}?year:\s*(\d{4})/g;
  let m;
  while ((m = re.exec(txt))) out.push({ id: m[1], title: m[2], year: Number(m[3]) });
  return out;
}

const all = [
  ...parseEntries("movies.ts").map((t) => ({ ...t, kind: "movie" })),
  ...parseEntries("movies-extra.ts").map((t) => ({ ...t, kind: "movie" })),
  ...parseEntries("movies-2026.ts").map((t) => ({ ...t, kind: "movie" })),
  ...parseEntries("dramas.ts").map((t) => ({ ...t, kind: "drama" })),
  ...parseEntries("dramas-2026.ts").map((t) => ({ ...t, kind: "drama" })),
  ...parseEntries("webseries.ts").map((t) => ({ ...t, kind: "series" })),
];

// all trending / hero-eligible ids
const TARGET_IDS = [
  "movie-jailer-2", "movie-king", "movie-ramayana-part-1", "movie-toxic",
  "movie-drishyam-3", "movie-alpha", "movie-peddi", "movie-avengers-doomsday",
  "movie-taandob", "movie-dune-part-three",
  "drama-zanjeerain", "drama-dar-e-nijaat", "drama-nashtar", "drama-mitti-de-baway",
  "drama-toota-huwa-dil", "drama-bas-tera-saath-ho", "series-panchayat-5", "series-farzi-2",
  "series-family-man", "series-abdullahpur-ka-devdas",
  "drama-tere-bin", "drama-parizaad", "drama-kabhi-main-kabhi-tum", "drama-jafaa",
  "movie-rrr", "movie-pathaan", "movie-jawan", "movie-tiger-3", "movie-animal",
  "movie-oppenheimer", "movie-dune-2", "movie-deadpool-wolverine",
  "movie-legend-of-maula-jatt", "movie-hawa", "movie-priyotoma",
  "movie-baahubali-2", "movie-dangal", "movie-3-idiots",
  "drama-humsafar", "drama-mere-paas-tum-ho", "drama-suno-chanda",
  "movie-devdas", "movie-bajirao-mastani", "movie-dunki", "movie-brahmastra",
];

const targets = TARGET_IDS.map((id) => all.find((t) => t.id === id)).filter(Boolean);
console.log(`Fetching ${targets.length} backdrops`);

function search(task, attempt = 1) {
  return new Promise((resolve) => {
    const q =
      task.kind === "drama"
        ? `${task.title} Pakistani drama still scene HD`
        : `${task.title} ${task.year} movie scene still HD wide`;
    const out = path.join(TMP, `${task.id}.json`);
    execFile(
      "z-ai",
      ["image-search", "-q", q, "--count", "4", "--gl", "us", "--no-rank", "-o", out],
      { timeout: 100000 },
      async (err) => {
        const msg = String(err?.message || err || "");
        if ((/429|Too many/i.test(msg) || /API request failed/i.test(msg)) && attempt <= 10) {
          await new Promise((r) => setTimeout(r, 70000));
          return resolve(search(task, attempt + 1));
        }
        resolve({ task, err, out });
      }
    );
  });
}

async function download(url, dest) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 15000) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

// probe image dimensions from header bytes (jpeg/png)
function probeSize(buf) {
  try {
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let o = 2;
      while (o < buf.length - 9) {
        if (buf[o] !== 0xff) { o++; continue; }
        const marker = buf[o + 1];
        const len = buf.readUInt16BE(o + 2);
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7) };
        }
        o += 2 + len;
      }
    }
    if (buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
  } catch { /* ignore */ }
  return { w: 0, h: 0 };
}

const results = {};
const queue = [...targets];

async function worker() {
  while (queue.length) {
    const task = queue.shift();
    const { err, out } = await search(task);
    let picked = null;
    try {
      const raw = JSON.parse(fs.readFileSync(out, "utf8"));
      const items = Array.isArray(raw) ? raw : raw?.results || raw?.data || [];
      // download all candidates, pick the most landscape one
      const cands = [];
      for (let i = 0; i < items.length; i++) {
        const u = items[i]?.image || items[i]?.image_url || items[i]?.url || items[i]?.link;
        if (!u) continue;
        const dest = path.join(TMP, `${task.id}-${i}.img`);
        if (await download(u, dest)) {
          const buf = fs.readFileSync(dest);
          const { w, h } = probeSize(buf);
          cands.push({ dest, w, h, size: buf.length });
        }
      }
      // prefer landscape (w >= h), largest width, min 800px wide
      cands.sort((a, b) => {
        const al = a.w >= a.h ? 1 : 0, bl = b.w >= b.h ? 1 : 0;
        if (al !== bl) return bl - al;
        return b.w - a.w;
      });
      const best = cands.find((c) => c.w >= 700) || cands[0];
      if (best) {
        const finalDest = path.join(OUT, `${task.id}.jpg`);
        fs.copyFileSync(best.dest, finalDest);
        picked = { w: best.w, h: best.h, bytes: best.size };
        results[task.id] = `${task.id}.jpg`;
        console.log(`OK  ${task.id}  ${best.w}x${best.h}  ${(best.size / 1024).toFixed(0)}KB`);
      }
    } catch (e) {
      console.log(`ERR ${task.id}: ${e.message}`);
    }
    if (!picked) console.log(`FAIL ${task.id}  ${err ? String(err.message).slice(0, 80) : "no usable image"}`);
    await new Promise((r) => setTimeout(r, 6000)); // rate limit
  }
}

await worker();

const manifestPath = path.join(ROOT, "src", "data", "backdrop-manifest.ts");
const ts = `// AUTO-GENERATED by scripts/fetch-backdrops.mjs — id → real backdrop filename in /public/backdrops
export const BACKDROP_MANIFEST: Record<string, string> = {
${Object.entries(results)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([id, f]) => `  "${id}": "${f}",`)
  .join("\n")}
};
`;
fs.writeFileSync(manifestPath, ts);
console.log(`\nDone. ${Object.keys(results).length}/${targets.length} backdrops → ${manifestPath}`);
