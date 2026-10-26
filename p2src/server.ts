import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './server/routes/api.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Create the configured Express app (API + static/SPA serving).
 * Exported so both the local dev server (dev.ts) and the serverless
 * entry (api/vercel.ts -> Vercel) share one boot path.
 */
export async function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';

  // Core middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic security & CORS headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.removeHeader('X-Frame-Options');
    // Allow embedding in the platform's preview panel iframe (cross-origin).
    // X-Frame-Options: SAMEORIGIN blocked the preview gateway, so we use a
    // permissive frame-ancestors policy instead (modern browsers honor CSP
    // frame-ancestors over X-Frame-Options).
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Mount API Router
  app.use('/api', apiRouter);

  if (!isProd) {
    // Development mode: Vite middleware
    // (specifier kept in a variable so serverless bundlers/NFT cannot trace it)
    const viteSpecifier = 'vite';
    const { createServer: createViteServer } = await import(viteSpecifier);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.use('*', async (req: Request, res: Response, next) => {
      const url = req.originalUrl;
      try {
        let template = await vite.transformIndexHtml(
          url,
          await (await import('fs/promises')).readFile(path.resolve(__dirname, 'index.html'), 'utf-8')
        );

        // Ensure the WebSocket & iframe shield script executes before /@vite/client
        const shieldMarker = '<!-- Synchronous Iframe Environment & WebSocket Shield';
        if (template.includes('/@vite/client') && template.includes(shieldMarker)) {
          const shieldStart = template.indexOf(shieldMarker);
          const shieldEnd = template.indexOf('</script>', shieldStart) + 9;
          if (shieldStart !== -1 && shieldEnd > shieldStart) {
            const shieldHtml = template.substring(shieldStart, shieldEnd);
            template = template.substring(0, shieldStart) + template.substring(shieldEnd);
            template = template.replace('<head>', `<head>\n    ${shieldHtml}`);
          }
        }

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // Production mode: Static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  return app;
}
