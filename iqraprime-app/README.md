# IQRAPRIME

**Kahani Jo Dil Chhoo Jaye.** — Stories that touch the heart.

A premium streaming PWA for **movies and Pakistani dramas**, built from scratch with a
black-and-gold cinematic identity. Installable on Android, iOS and desktop.

![IQRAPRIME](public/icons/icon-512.png)

## Features

- **Movies + Pakistani Dramas only** — 105 curated titles (77 movies, 28 dramas), no live TV
- **Cinematic black-gold UI** — `#05070B` ink, `#FFBD24` brand gold, serif display headlines
- **Auto-rotating hero carousel**, horizontal rails (Trending / New / Top Rated / Lollywood / Bollywood / Hollywood)
- **Browse pages** with genre chips + sort (popularity / rating / newest / A–Z)
- **Instant search** across titles, cast, genres and years
- **My List** persisted in `localStorage`
- **Title pages** with branded SVG key-art, episodes grid for dramas and an **hls.js-ready player**
- **Full PWA install flow**
  - `manifest.webmanifest` (standalone, maskable icons, shortcuts)
  - Service worker: app-shell precache, stale-while-revalidate artwork, network-first pages,
    `/offline` fallback, and **no caching of media streams or private data**
  - **Install App** button in the header, **Install Our App** block in the footer,
    one shared `usePwaInstall` hook (`beforeinstallprompt` capture, deferred prompt, `appinstalled`)
  - iOS Safari guided modal (Share → Add to Home Screen), ARIA-accessible

## Tech Stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS 4 (theme tokens via `@theme`)
- hls.js (player shell, demo stream until providers are connected)
- Zero-database catalog: typed static data in `src/data` (Supabase env vars kept ready in `.env.example`)

## Getting Started

```bash
bun install        # or npm install
bun run dev        # http://localhost:3000
bun run build && bun run start
```

Generate brand art (posters/backdrops/icons) only when catalog changes:

```bash
node scripts/gen-art.mjs     # SVG posters + backdrops for every title
python3 scripts/gen-icons.py # PWA icons from the official logo
```

## Environment

Copy `.env.example` → `.env` and fill in when connecting a backend:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
P_HOST=   # Xtream provider host (optional, future playback)
P_USER=
P_PASS=
```

## Deployment

Works out of the box on Vercel / Netlify / any Node host:

1. Push this repo to GitHub
2. Import into Vercel → framework auto-detected (Next.js)
3. Add environment variables (optional today, required for real playback later)
4. Deploy — service worker and manifest are served from `/public`

## Repository Notes

- This codebase is **written from scratch** for IQRAPRIME — it contains no code from any
  previous project or repository.
- The catalog ships as curated seed data with generated brand art; connect your licensed
  playback sources (Xtream/HLS) via the player component to go live.
