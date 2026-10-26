// Fetch REAL posters: Wikipedia page images (primary) → save public/posters-real/{id}.jpg
import { MOVIES } from "../src/data/movies.ts";
import { DRAMAS } from "../src/data/dramas.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project/iqraprime-app";
const OUT = path.join(ROOT, "public", "posters-real");
fs.mkdirSync(OUT, { recursive: true });

const titles = [
  ...MOVIES.map((m) => ({ id: m.id, title: m.title, year: m.year, kind: "movie" })),
  ...DRAMAS.map((d) => ({ id: d.id, title: d.title, year: d.year, kind: "drama" })),
];

const UA = "IQRAPRIME-app/1.0 (contact: playbeatdigitalworld)";

function queriesFor(t) {
  const q = t.title;
  if (t.kind === "drama") {
    return [`${q} TV series`, `${q} Pakistani drama`, q];
  }
  return [`${q} ${t.year} film`, `${q} film`, q];
}

async function findThumb(t, tries = 6) {
  for (const q of queriesFor(t)) {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", q);
    url.searchParams.set("gsrlimit", "3");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "thumbnail");
    url.searchParams.set("pithumbsize", "600");
    for (let a = 0; a < tries; a++) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
        if (res.status === 429) {
          await new Promise((r) => setTimeout(r, 60000));
          continue;
        }
        if (!res.ok) break;
        const data = await res.json();
        const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
        let found = null;
        for (const p of pages) {
          const src = p?.thumbnail?.source;
          if (src && /\.(jpe?g|png)$/i.test(src)) { found = src; break; }
        }
        if (found) {
          for (let d = 0; d < 4; d++) {
            const dl = await fetch(found, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) }).catch(() => null);
            if (dl && dl.status === 429) { await new Promise((r) => setTimeout(r, 60000)); continue; }
            if (dl && dl.ok) {
              const ct = dl.headers.get("content-type") || "";
              const buf = Buffer.from(await dl.arrayBuffer());
              if (ct.startsWith("image/") && buf.length > 8000) return { src: found, buf };
            }
            break;
          }
          return null;
        }
        break; // page found but no image → next query variant
      } catch { await new Promise((r) => setTimeout(r, 5000)); }
    }
    await new Promise((r) => setTimeout(r, 3500)); // pace: ~17 req/min
  }
  return null;
}

async function download(url, dest) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000) return false;
    // normalize to jpg via PIL later; keep original ext content as .jpg (browsers sniff)
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

let ok = 0, fail = 0, done = 0;
const failures = [];
const CONC = 5;

async function worker(queue) {
  while (queue.length) {
    const t = queue.shift();
    if (!t) break;
    const dest = path.join(OUT, `${t.id}.jpg`);
    if (fs.existsSync(dest)) { ok++; done++; continue; }
    const hit = await findThumb(t);
    if (hit) {
      fs.writeFileSync(dest, hit.buf);
      ok++;
    } else { fail++; failures.push(t.id); }
    done++;
    fs.writeFileSync(path.join(OUT, "_status.json"), JSON.stringify({ ok, fail, failures }, null, 1));
    if (done % 15 === 0) console.log(`progress ${done}/${titles.length} ok=${ok} fail=${fail}`);
  }
}

const queue = [...titles];
await Promise.all(Array.from({ length: 1 }, () => worker(queue))); // single worker: stay under rate limits
fs.writeFileSync(path.join(OUT, "_status.json"), JSON.stringify({ ok, fail, failures }, null, 1));
console.log(`DONE ok=${ok} fail=${fail} total=${titles.length}`);
