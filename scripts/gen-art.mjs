// Generate branded SVG posters & backdrops for every title + PWA icons from logo
import { MOVIES } from "../src/data/movies.ts";
import { MOVIES_EXTRA } from "../src/data/movies-extra.ts";
import { DRAMAS } from "../src/data/dramas.ts";
import { WEB_SERIES } from "../src/data/webseries.ts";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project/iqraprime-app";
const POSTERS = path.join(ROOT, "public", "posters");
const BACKDROPS = path.join(ROOT, "public", "backdrops");

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function wrapTitle(title, maxChars = 14, maxLines = 3) {
  const words = title.split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    } else cur = (cur + " " + w).trim();
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  // remainder if still long
  const rest = words.slice(lines.join(" ").split(/\s+/).length).join(" ");
  if (rest && lines.length < maxLines) lines[lines.length - 1] += "";
  return lines.slice(0, maxLines);
}

function posterSVG(t) {
  const [c1, c2] = t.palette;
  const lines = wrapTitle(t.title, 13, 3);
  const fs = lines.length === 1 ? 64 : lines.length === 2 ? 56 : 46;
  const kindLabel = t.kind === "drama" ? "DRAMA SERIES" : "FEATURE FILM";
  const yearStr = String(t.year);
  const titleY = t.kind === "drama" ? 600 : 610;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="675" height="1000" viewBox="0 0 675 1000">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${shade(c1, 1.15)}"/>
      <stop offset="0.55" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.28" r="0.75">
      <stop offset="0" stop-color="#FFBD24" stop-opacity="0.30"/>
      <stop offset="0.5" stop-color="#FFBD24" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.45" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#05070B" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  <rect width="675" height="1000" fill="url(#bg)"/>
  <g opacity="0.16" stroke="#FFBD24" stroke-width="1.4" fill="none">
    <circle cx="560" cy="120" r="150"/><circle cx="560" cy="120" r="110"/>
    <path d="M60 220 L180 120 L300 220" opacity="0.7"/>
    <path d="M420 760 L500 660 L580 760" opacity="0.5"/>
  </g>
  <rect width="675" height="1000" fill="url(#glow)"/>
  <g opacity="0.5">
    <polygon points="${140 + (t.year % 7) * 40},180 ${200 + (t.year % 7) * 40},80 ${260 + (t.year % 7) * 40},180" fill="#FFBD24" opacity="0.12"/>
    <polygon points="${60 + (t.rating % 5) * 60},320 ${120 + (t.rating % 5) * 60},220 ${180 + (t.rating % 5) * 60},320" fill="#FFE18A" opacity="0.10"/>
  </g>
  <text x="48" y="96" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="bold" letter-spacing="6" fill="#FFBD24">IQRAPRIME</text>
  <rect x="48" y="112" width="64" height="4" fill="#D99A19"/>
  <text x="48" y="164" font-family="Arial, Helvetica, sans-serif" font-size="17" letter-spacing="5" fill="#B8C0CC" opacity="0.85">${kindLabel}</text>
  <g font-family="Georgia, 'Times New Roman', serif" font-weight="bold" fill="#FFFFFF">
    ${lines.map((l, i) => `<text x="48" y="${titleY + i * (fs + 10)}" font-size="${fs}">${esc(l)}</text>`).join("\n    ")}
  </g>
  <text x="48" y="${titleY + lines.length * (fs + 10) + 34}" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#FFBD24" font-weight="bold">${yearStr}  ·  ★ ${t.rating.toFixed(1)}</text>
  <text x="48" y="${titleY + lines.length * (fs + 10) + 74}" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#B8C0CC" letter-spacing="2">${esc(t.genres.slice(0, 2).join(" • "))}</text>
  <rect width="675" height="1000" fill="url(#vig)"/>
  <rect x="10" y="10" width="655" height="980" fill="none" stroke="#FFBD24" stroke-opacity="0.25" stroke-width="2" rx="14"/>
</svg>`;
}

function backdropSVG(t) {
  const [c1, c2] = t.palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shade(c1, 1.1)}"/>
      <stop offset="0.6" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <linearGradient id="vig" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#05070B" stop-opacity="0.96"/>
      <stop offset="0.6" stop-color="#05070B" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.1"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <g opacity="0.14" stroke="#FFBD24" stroke-width="2" fill="none">
    <circle cx="980" cy="200" r="220"/><circle cx="980" cy="200" r="150"/>
    <path d="M700 620 L860 420 L1020 620" />
    <path d="M950 620 L1060 480 L1170 620" opacity="0.7"/>
  </g>
  <rect width="1280" height="720" fill="url(#vig)"/>
  <text x="64" y="120" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="bold" letter-spacing="7" fill="#FFBD24">IQRAPRIME</text>
  <rect x="64" y="138" width="72" height="5" fill="#D99A19"/>
</svg>`;
}

const all = [
  ...MOVIES.map((m) => ({ ...m, kind: "movie" })),
  ...MOVIES_EXTRA.map((m) => ({ ...m, kind: "movie" })),
  ...DRAMAS.map((d) => ({ ...d, kind: "drama" })),
  ...WEB_SERIES.map((d) => ({ ...d, kind: "series" })),
];

for (const t of all) {
  fs.writeFileSync(path.join(POSTERS, `${t.id}.svg`), posterSVG(t));
  fs.writeFileSync(path.join(BACKDROPS, `${t.id}.svg`), backdropSVG(t));
}
console.log(`Generated ${all.length} posters + ${all.length} backdrops`);
