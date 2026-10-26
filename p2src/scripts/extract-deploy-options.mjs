import fs from 'node:fs';

const dir = '/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/';
const f = 'chunk-V426AGVC.js';
const s = fs.readFileSync(dir + f, 'utf8');

// find where the deploy command builds deploymentOptions / calls client deploy()
for (const needle of ['skipAutoDetectionConfirmation', 'deploymentOptions', 'defaultName', 'withCache']) {
  let idx = 0;
  let found = 0;
  while (found < 4) {
    const i = s.indexOf(needle, idx);
    if (i < 0) break;
    const ctx = s.slice(Math.max(0, i - 250), i + 350).replace(/\n/g, ' ');
    // skip help text
    if (!ctx.includes('description:') || needle === 'deploymentOptions') {
      console.log('===', needle, '@', i);
      console.log(ctx);
      console.log('·····');
      found++;
    }
    idx = i + needle.length;
  }
}
