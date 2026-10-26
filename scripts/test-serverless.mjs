/**
 * Local smoke test for the serverless bundle (api/index.js).
 * Wraps the exported handler in a minimal http server and probes
 * the same routes Vercel will route to it (only /api/* + SPA fallback).
 */
import http from 'http';
import handler from '../api/index.js';

const server = http.createServer((req, res) => handler(req, res));
await new Promise((r) => server.listen(3999, '127.0.0.1', r));

const base = 'http://127.0.0.1:3999';
const results = [];

async function probe(name, path, opts = {}) {
  try {
    const res = await fetch(base + path, opts);
    const text = await res.text();
    results.push({ name, path, status: res.status, len: text.length, sample: text.slice(0, 120) });
  } catch (e) {
    results.push({ name, path, error: String(e) });
  }
}

await probe('health', '/api/health');
await probe('pilot settings', '/api/pilot/settings');
await probe('movies', '/api/content/movies');
await probe('channels', '/api/content/channels');
await probe('login (seeded admin)', '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@aetherstream.tv', password: 'admin123' }),
});
await probe('SPA fallback (extensionless)', '/some/client/route');

for (const r of results) {
  if (r.error) console.log(`FAIL ${r.name} -> ${r.error}`);
  else console.log(`OK   ${r.name} [${r.status}] (${r.len}B) :: ${r.sample.replace(/\n/g, ' ').slice(0, 100)}`);
}
server.close();
