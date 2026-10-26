import fs from 'node:fs';

const dir = '/home/z/.npm-global/lib/node_modules/vercel/dist/chunks/';

// The prebuilt deploy handler converts Build Output v3 into deployment files.
// Look for identifiers: 'outputStatic', 'config.json', 'functions', 'filesWithPath', 'deployPrebuilt'
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
  const s = fs.readFileSync(dir + f, 'utf8');
  for (const needle of ['config.json"', 'outputStatic', 'prebuiltOutput', 'deployStaticBuild']) {
    const i = s.indexOf(needle);
    if (i >= 0 && !s.slice(i - 200, i + 50).includes('description:')) {
      console.log('===', f, '|', needle, '@', i);
      console.log(s.slice(Math.max(0, i - 300), i + 1600));
      console.log('·····');
      break;
    }
  }
}
