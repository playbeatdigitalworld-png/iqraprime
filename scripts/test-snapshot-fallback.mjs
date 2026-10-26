/**
 * Local harness: invoke the shipped serverless handler directly against the
 * catalog endpoints while the upstream IPTV provider is offline, to prove the
 * snapshot-outage fallback serves the verified catalog.
 *
 * Usage: SUPABASE_SERVICE_ROLE_KEY=... node scripts/test-snapshot-fallback.mjs
 */
import handler from '../api/index.js';
import http from 'node:http';

const BASE = 'http://127.0.0.1:1'; // host is irrelevant; only url/path is used

function call(path) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage();
    req.url = path;
    req.method = 'GET';
    req.headers = { host: 'localhost', 'user-agent': 'harness' };
    const chunks = [];
    const res = new http.ServerResponse(req);
    const origEnd = res.end.bind(res);
    res.end = (...args) => {
      if (args[0]) chunks.push(Buffer.from(args[0]));
      const body = Buffer.concat(chunks).toString('utf8');
      resolve({ status: res.statusCode, body });
      return origEnd();
    };
    res.write = (chunk, ...rest) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    };
    Promise.resolve(handler(req, res)).catch(reject);
    setTimeout(() => reject(new Error(`harness timeout: ${path}`)), 240_000);
  });
}

const tests = [
  '/api/catalog/warm?type=live',
  '/api/catalog/categories?type=live',
  '/api/catalog/search?q=news&type=live&limit=2',
  '/api/catalog/items?type=live&categoryId=95&limit=3',
  '/api/catalog/highlights',
];

let pass = 0;
let fail = 0;
for (const path of tests) {
  const started = Date.now();
  try {
    const { status, body } = await call(path);
    const ms = Date.now() - started;
    let summary = body.slice(0, 220);
    try {
      const j = JSON.parse(body);
      if (path.includes('warm')) summary = `ok=${j.ok} items=${j.items} complete=${j.complete} staleFallback=${j.staleFallback}`;
      else if (path.includes('categories')) summary = `categories=${(j.categories || []).length} first=${JSON.stringify((j.categories || [])[0])} second=${JSON.stringify((j.categories || [])[1])}`;
      else if (path.includes('search')) summary = `scope=${j.scope} items=${(j.items || []).length} first=${j.items?.[0]?.name || '-'}`;
      else if (path.includes('items?')) summary = `totalInCategory=${j.totalInCategory} first=${j.items?.[0]?.name || '-'}`;
      else if (path.includes('highlights')) summary = `live=${j.live?.length} vod=${j.vod?.length} series=${j.series?.length} line=${j.line}`;
    } catch { /* raw */ }
    console.log(`[${status}] ${path} (${ms}ms)\n    -> ${summary}`);
    if (status === 200) pass += 1; else fail += 1;
  } catch (e) {
    fail += 1;
    console.log(`[ERR] ${path}\n    -> ${e.message}`);
  }
}
console.log(`\nPASS ${pass} / FAIL ${fail}`);
process.exit(fail ? 1 : 0);
