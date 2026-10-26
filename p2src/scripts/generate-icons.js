import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, r, g, b) {
  // Simple valid RGBA PNG generator using standard PNG chunk specs
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // deflate compression
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // no interlace

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(8 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    // CRC calculation
    let crc = 0xffffffff;
    const toCheck = buf.subarray(4, 8 + len);
    for (let i = 0; i < toCheck.length; i++) {
      crc = updateCrc(crc, toCheck[i]);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // Precomputed CRC table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function updateCrc(crc, byte) {
    return crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw bitmap scanlines with filter byte 0
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.45;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Crimson emblem accent in center
      const inEmblem = (Math.abs(dx) < width * 0.22 && Math.abs(dy) < height * 0.22) ||
                       (dx > -width*0.1 && dx < width*0.15 && Math.abs(dy) < (dx + width*0.1)*0.9);

      if (inEmblem) {
        rawData[pxOffset] = 229;     // #E5093A
        rawData[pxOffset + 1] = 9;
        rawData[pxOffset + 2] = 58;
        rawData[pxOffset + 3] = 255;
      } else if (dist < radius) {
        rawData[pxOffset] = 14;      // #0E1420
        rawData[pxOffset + 1] = 20;
        rawData[pxOffset + 2] = 32;
        rawData[pxOffset + 3] = 255;
      } else {
        rawData[pxOffset] = 5;       // #05070B
        rawData[pxOffset + 1] = 7;
        rawData[pxOffset + 2] = 11;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, 229, 9, 58));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, 229, 9, 58));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, 229, 9, 58));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, 229, 9, 58));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPng(32, 32, 229, 9, 58));

console.log('Successfully generated compliant PNG PWA icons in /public');
