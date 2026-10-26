import fs from 'node:fs';

const dir = '/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/';

// find code that reads .vercel/output (Build Output API) for deploy --prebuilt
const needles = ['output', 'config.json'];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(dir + f, 'utf8');
  // look for the prebuilt deploy handler: reads output dir, builds files map
  const idxs = [];
  let i = s.indexOf('join(cwd, ".vercel", "output")');
  if (i < 0) i = s.indexOf('".vercel", "output"');
  if (i < 0) i = s.indexOf(".vercel/output");
  if (i >= 0) {
    console.log('=== FILE:', f, 'at', i);
    console.log(s.slice(Math.max(0, i - 200), i + 2200));
    console.log('\n...\n');
  }
}
