// Probe how the provider reacts to different fetch header sets
const url = process.argv[2];
const UA = 'VLC/3.0.20 LibVLC/3.0.20';

async function attempt(label, headers, redirect = 'follow') {
  try {
    const up = await fetch(url, { redirect, headers });
    const text = await up.text();
    const loc = up.headers.get('location') || '-';
    console.log(
      `[${label}] status=${up.status} ctype=${up.headers.get('content-type')} ` +
        `finalHost=${(() => { try { return new URL(up.url || url).host; } catch { return '?'; } })()} ` +
        `loc=${loc.slice(0, 60)} hasM3U=${text.includes('#EXTM3U')} len=${text.length}`
    );
  } catch (e) {
    console.log(`[${label}] THREW: ${e.message} / ${e.cause?.code || ''}`);
  }
}

await attempt('ua-only', { 'User-Agent': UA });
await attempt('ua+accept', { 'User-Agent': UA, Accept: '*/*' });
await attempt('ua+accept+no-enc', { 'User-Agent': UA, Accept: '*/*', 'Accept-Encoding': 'identity' });
await attempt('manual-redirect ua-only', { 'User-Agent': UA }, 'manual');
await attempt('curl-clone', {
  'User-Agent': UA,
  Accept: '*/*',
  'Accept-Encoding': 'identity',
  Connection: 'keep-alive',
});
