import fs from 'node:fs';

const dir = '/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/';

// chunk-YGMOJBSP likely holds the deploy command implementation
const s = fs.readFileSync(dir + 'chunk-YGMOJBSP.js', 'utf8');
console.log('file size:', s.length);

for (const needle of ['skipAutoDetectionConfirmation', 'projectSettings', 'isDir="1"', 'deploy(', 'meta:']) {
  let idx = 0;
  let found = 0;
  while (found < 3) {
    const i = s.indexOf(needle, idx);
    if (i < 0) break;
    const ctx = s.slice(Math.max(0, i - 400), i + 500).replace(/\n/g, ' ');
    console.log('===', needle, '@', i);
    console.log(ctx);
    console.log('·····');
    idx = i + needle.length;
    found++;
  }
}
