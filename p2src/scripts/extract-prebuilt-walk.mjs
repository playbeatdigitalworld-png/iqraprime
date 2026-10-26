import fs from 'node:fs';

const s = fs.readFileSync('/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/chunk-RYMRVMGD.js', 'utf8');
// The prebuilt walk was at ~65078. Extract a wide window around it.
const i = s.indexOf('prebuilt){let vcConfigFilePaths');
console.log(s.slice(Math.max(0, i - 2500), i + 2600));
