// Creator Hub router factory — combines public, creator-self and admin
// sub-routers, gates everything on CREATOR_HUB_ENABLED (admin routes stay
// reachable for the owner to re-enable), and maps HttpError to JSON.
import { Router, Request, Response, NextFunction } from 'express';
import { store } from './store.js';
import { HttpError } from './auth.js';
import { createPublicCreatorRouter, createCreatorSelfRouter, type CreatorHubDeps } from './routes.js';
import { createAdminCreatorRouter } from './adminRoutes.js';

export type { CreatorHubDeps } from './routes.js';

export function createCreatorHubRouter(deps: CreatorHubDeps): Router {
  const r = Router();

  r.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = await store.getFlags();
      if (!flags.CREATOR_HUB_ENABLED && !req.path.startsWith('/admin') && req.path !== '/flags' && req.path !== '/cron/rollup') {
        return res.status(503).json({ error: 'Creator Hub is currently disabled.', code: 'creator_hub_disabled' });
      }
      next();
    } catch (e) { next(e); }
  });

  // Admin router FIRST so /admin/* never passes through requireCreator;
  // then public routes; the creator self-router's auth middleware comes last.
  r.use('/admin', createAdminCreatorRouter(deps));
  r.use('/', createPublicCreatorRouter());
  r.use('/', createCreatorSelfRouter());

  // error handler → JSON
  r.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message, code: err.code });
    }
    const message = err instanceof Error ? err.message : 'Creator Hub error';
    console.error('[creator-hub]', message);
    return res.status(500).json({ error: message, code: 'creator_hub_error' });
  });

  return r;
}
