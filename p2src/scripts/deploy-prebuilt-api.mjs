#!/usr/bin/env node
/**
 * scripts/deploy-prebuilt-api.mjs
 *
 * Deploys the prebuilt Vercel Build Output API v3 tree (.vercel/output)
 * to production via the raw REST API — required because the owner-supplied
 * scoped token cannot pass the CLI's /v2/user identity check (team-scoped
 * token: /v2/user → 404), though project-scoped API calls work fine.
 *
 * Contract replicated from Vercel CLI 62.7.0 internals:
 *  - Upload:  POST /v2/files?teamId=<team>
 *             headers: content-type: application/octet-stream,
 *                      x-now-digest: <sha1>, x-now-size: <n>
 *             body: raw file bytes   (200 = stored; may also return presigned urls)
 *  - Deploy:  POST /v13/deployments?teamId=<team>&skipAutoDetectionConfirmation=1&prebuilt=1
 *             body: { version:2, name, project, target:"production", source:"cli",
 *                     projectSettings, autoAssignCustomDomains, files:[{file,size,mode,sha}] }
 *             file paths are uploaded relative to the repo root (".vercel/output/<rel>");
 *             the edge's file-tree view prepends "src/" itself — verified against
 *             production deployment dpl_Dz5cpeaUEHr2ZZxq7hCtV6XZohSW (uploading with
 *             an explicit "src/" prefix yields src/src/... and edge 404s)
 *  - Poll:    GET /v13/deployments/<id>?teamId=<team> until readyState READY/ERROR
 *
 * The token is read from env VERCEL_TOKEN and never printed or persisted.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TEAM = 'team_tCgCVncHJhJXwj7Kqi0bNfia';
const PROJECT_ID = 'prj_QznLATdIdlXJXOfOXEouDfoUdpRk';
const PROJECT_NAME = 'streamplay';
const OUTPUT_DIR = '/home/z/my-project/.vercel/output';
const PATH_PREFIX = '.vercel/output';
const API = 'https://api.vercel.com';

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error('FATAL: VERCEL_TOKEN env var not set');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(pathname, init = {}, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${API}${pathname}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          ...(init.headers || {}),
        },
      });
      return res;
    } catch (e) {
      lastErr = e;
      await sleep(1500 * attempt);
    }
  }
  throw lastErr;
}

// ---------- 1. Walk the output tree ----------
function walk(dir, base = dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

const files = walk(OUTPUT_DIR);
console.log(`Found ${files.length} files in build output`);

// ---------- 2. Upload ----------
const prepared = [];
let uploaded = 0;
const CONCURRENCY = 8;

async function uploadOne(abs) {
  const rel = path.relative(OUTPUT_DIR, abs).split(path.sep).join('/');
  const data = fs.readFileSync(abs);
  const sha = crypto.createHash('sha1').update(data).digest('hex');
  const mode = fs.statSync(abs).mode;

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await api(
      `/v2/files?teamId=${TEAM}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Length': String(data.byteLength),
          'x-now-digest': sha,
          'x-now-size': String(data.byteLength),
        },
        body: data,
      },
      1
    );
    if (res.status === 200) {
      // Modern API may return presigned PUT urls — mirror CLI semantics:
      // 200 means accepted; if urls are present, PUT the bytes to be safe.
      let body = null;
      try {
        body = await res.json();
      } catch {}
      if (body && Array.isArray(body.urls) && body.urls.length > 0) {
        for (const u of body.urls) {
          try {
            const put = await fetch(u, { method: 'PUT', body: data });
            if (!put.ok && put.status !== 200)
              console.warn(`  warn: PUT to presigned url for ${rel} → ${put.status}`);
          } catch (e) {
            console.warn(`  warn: PUT failed for ${rel}: ${e.message}`);
          }
        }
      }
      uploaded++;
      if (uploaded % 25 === 0 || uploaded === files.length)
        console.log(`  uploaded ${uploaded}/${files.length}`);
      return { file: `${PATH_PREFIX}/${rel}`, size: data.byteLength, mode, sha };
    }
    if (res.status >= 400 && res.status < 500) {
      const t = await res.text();
      throw new Error(`Upload rejected for ${rel}: ${res.status} ${t.slice(0, 200)}`);
    }
    await sleep(2000 * attempt); // server error → retry
  }
  throw new Error(`Upload failed after retries: ${rel}`);
}

const queue = [...files];
const results = [];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      results.push(await uploadOne(item));
    }
  })
);
console.log(`All ${results.length} files uploaded`);

// ---------- 3. Create deployment ----------
const body = {
  version: 2,
  name: PROJECT_NAME,
  project: PROJECT_ID,
  target: 'production',
  source: 'cli',
  autoAssignCustomDomains: true,
  projectSettings: {
    framework: null,
    buildCommand: null,
    devCommand: null,
    installCommand: null,
    outputDirectory: 'dist',
    commandForIgnoringBuildStep: null,
    nodeVersion: '24.x',
  },
  files: results,
};

const createRes = await api(
  `/v13/deployments?teamId=${TEAM}&skipAutoDetectionConfirmation=1&prebuilt=1`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  },
  2
);
const createText = await createRes.text();
let deploy;
try {
  deploy = JSON.parse(createText);
} catch {
  console.error('Deployment creation returned non-JSON:', createText.slice(0, 500));
  process.exit(1);
}
if (!createRes.ok || deploy.error) {
  console.error(
    `DEPLOY FAILED: ${createRes.status}`,
    JSON.stringify(deploy.error || deploy).slice(0, 800)
  );
  process.exit(1);
}
console.log(`Deployment created: ${deploy.id} → ${deploy.url}`);

// ---------- 4. Poll ----------
const deadline = Date.now() + 5 * 60 * 1000;
let final = null;
while (Date.now() < deadline) {
  await sleep(5000);
  const r = await api(`/v13/deployments/${deploy.id}?teamId=${TEAM}`, {}, 2);
  const d = await r.json();
  final = d;
  if (d.readyState === 'READY' || d.readyState === 'ERROR' || d.state === 'ERROR') break;
  process.stdout.write(`  state: ${d.readyState || d.state}\n`);
}

if (!final) {
  console.error('Polling failed');
  process.exit(1);
}
console.log('=== RESULT ===');
console.log('id:', final.id);
console.log('url:', final.url);
console.log('readyState:', final.readyState, '| readySubstate:', final.readySubstate);
console.log(
  'aliases:',
  (final.alias || []).join(', ') || '(none yet)'
);
if (final.readyState !== 'READY') {
  console.error('Deployment did not become READY:', JSON.stringify(final).slice(0, 600));
  process.exit(1);
}
console.log('DEPLOY OK');
