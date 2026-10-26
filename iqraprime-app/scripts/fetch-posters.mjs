// Fetch REAL posters via z-ai image-search, save to public/posters-real/{id}.jpg
import { MOVIES } from "../src/data/movies.ts";
import { DRAMAS } from "../src/data/dramas.ts";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";

const ROOT = "/home/z/my-project/iqraprime-app";
const OUT = path.join(ROOT, "public", "posters-real");
const TMP = "/tmp/posters";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });

const titles = [
  ...MOVIES.map((m) => ({ id: m.id, title: m.title, year: m.year, kind: "movie" })),
  ...DRAMAS.map((d) => ({ id: d.id, title: d.title, year: d.year, kind: "drama" })),
];

const status = { done: 0, ok: 0, fail: 0, total: titles.length, results: {} };

function search(task, attempt = 1) {
  return new Promise((resolve) => {
    const q =
      task.kind === "drama"
        ? `${task.title} Pakistani drama serial poster HD`
        : `${task.title} ${task.year} movie official poster HD`;
    const out = path.join(TMP, `${task.id}.json`);
    execFile(
      "z-ai",
      ["image-search", "-q", q, "--count", "3", "--gl", "us", "--no-rank", "-o", out],
      { timeout: 100000 },
      async (err) => {
        const msg = String((err as { message?: string })?.message || err || "");
        if (/429|Too many/i.test(msg) && attempt <= 8) {
          await new Promise((r) => setTimeout(r, 60000)); // full cooldown wait
          return resolve(search(task, attempt + 1));
        }
        resolve({ task, err, out });
      }
    );
  });
}

async function download(url, dest) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.startsWith("image/")) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) return false;
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

async function worker(queue) {
  while (queue.length) {
    const task = queue.shift();
    if (!task) break;
    const dest = path.join(OUT, `${task.id}.jpg`);
    if (fs.existsSync(dest)) {
      status.results[task.id] = "cached";
      status.done++; status.ok++;
      continue;
    }
    const { err, out } = await search(task);
    let ok = false;
    if (!err && fs.existsSync(out)) {
      try {
        const data = JSON.parse(fs.readFileSync(out, "utf8"));
        if (data.success && Array.isArray(data.results)) {
          for (const r of data.results) {
            if (await download(r.original_url, dest)) { ok = true; break; }
          }
        }
      } catch { /* parse fail */ }
    }
    status.results[task.id] = ok ? "ok" : "fail";
    status.done++; ok ? status.ok++ : status.fail++;
    fs.writeFileSync(path.join(TMP, "status.json"), JSON.stringify(status, null, 1));
  }
}

const queue = [...titles];
const WORKERS = 2;
await Promise.all(Array.from({ length: WORKERS }, () => worker(queue)));
fs.writeFileSync(path.join(TMP, "status.json"), JSON.stringify(status, null, 1));
console.log(`DONE ok=${status.ok} fail=${status.fail} total=${status.total}`);
