/**
 * Serverless bundle builder.
 * Bundles api/vercel.ts -> api/index.js as a single self-contained ESM file:
 * - all runtime deps (express, @supabase/supabase-js, @google/genai, ...)
 *   are inlined; only `vite` stays external (dev-only dynamic import).
 * - a resolve plugin maps ".js" import specifiers to ".ts" sources
 *   (the TS ESM convention used throughout the repo, resolved by tsx in dev).
 * Output api/index.js is gitignored; `vercel deploy --prebuilt` uploads it.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

const jsToTs = {
  name: 'js-to-ts',
  setup(build) {
    build.onResolve({ filter: /\.js$/ }, (args) => {
      if (!args.path.startsWith('.') || args.path.includes('node_modules')) return null;
      const importerDir = path.dirname(args.importer || path.join(root, 'index'));
      const base = args.path.slice(0, -3);
      for (const ext of ['.ts', '.tsx']) {
        const candidate = path.resolve(importerDir, base + ext);
        if (fs.existsSync(candidate)) return { path: candidate };
      }
      return null;
    });
  },
};

await esbuild.build({
  entryPoints: [path.join(root, 'serverless/vercel.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile: path.join(root, 'api/index.js'),
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  packages: 'bundle',
  external: ['vite'],
  plugins: [jsToTs],
  banner: {
    // esbuild's ESM dynamic-require shim checks `typeof require` first —
    // provide a real one via createRequire so CJS deps (express tree) that
    // keep runtime `require("builtin")` calls work inside the ESM bundle.
    js: [
      '/* StreamPlay serverless bundle — deployed via GitHub Actions -> Vercel git integration */',
      "import { createRequire as __spCreateRequire } from 'node:module';",
      'const require = __spCreateRequire(import.meta.url);',
    ].join('\n'),
  },
});

const size = fs.statSync(path.join(root, 'api/index.js')).size;
console.log(`[serverless] bundled api/index.js (${(size / 1024 / 1024).toFixed(2)} MB)`);
