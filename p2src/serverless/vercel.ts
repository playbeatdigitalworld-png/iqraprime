/**
 * Vercel serverless entry.
 * Bundled by scripts/build-serverless.mjs into api/index.js (single-file
 * ESM bundle, all dependencies inlined except vite which is dev-only).
 * Vercel's Node runtime invokes the default export as the handler.
 */
import { createApp } from '../server.js';

type Handler = (req: unknown, res: unknown) => void;

let cached: Handler | null = null;

async function getHandler(): Promise<Handler> {
  if (!cached) {
    // Ensure the production code path (static/SPA + no vite middleware).
    // Vercel sets NODE_ENV=production, but default defensively anyway.
    process.env.NODE_ENV = process.env.NODE_ENV || 'production';
    const app = await createApp();
    cached = app as unknown as Handler;
  }
  return cached;
}

export default async function handler(req: unknown, res: unknown): Promise<void> {
  const h = await getHandler();
  h(req, res);
}
