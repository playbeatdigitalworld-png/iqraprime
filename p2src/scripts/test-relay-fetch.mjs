// Replicate the relay's upstream fetch for a live manifest
const url = process.argv[2];
const UA = 'VLC/3.0.20 LibVLC/3.0.20';
try {
  const up = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': UA } });
  const text = await up.text();
  console.log('status:', up.status);
  console.log('ctype:', up.headers.get('content-type'));
  console.log('final url host:', new URL(up.url || url).host);
  console.log('len:', text.length, '| has #EXTM3U:', text.includes('#EXTM3U'));
  console.log('head:', JSON.stringify(text.slice(0, 120)));
} catch (e) {
  console.log('FETCH THREW:', e.name, e.message, e.cause?.code || e.cause?.message || '');
}
