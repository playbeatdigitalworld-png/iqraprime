import fs from 'node:fs';

const dir = '/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/';
const targets = ['prepareFiles', 'readBuildOutputConfiguration', '--prebuilt', 'prebuilt'];

for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(dir + f, 'utf8');
  const i = s.indexOf('prepareFiles');
  if (i >= 0) {
    console.log('=== FILE:', f, 'at', i);
    // find the definition (not just import reference)
    let d = s.indexOf('function prepareFiles');
    if (d < 0) d = s.indexOf('prepareFiles=(');
    if (d < 0) d = s.indexOf('prepareFiles =');
    if (d >= 0) {
      console.log(s.slice(d, d + 2000));
    } else {
      console.log('(definition not in this chunk; ref context)');
      console.log(s.slice(Math.max(0, i - 100), i + 300));
    }
    break;
  }
}

console.log('\n=== prebuilt references ===');
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(dir + f, 'utf8');
  const i = s.indexOf('prebuilt');
  if (i >= 0) {
    console.log('FILE:', f, '→', s.slice(Math.max(0, i - 150), i + 250).replace(/\n/g, ' '));
    console.log('---');
  }
}
