/**
 * Local development / self-hosted bootstrap.
 * Creates the shared Express app (server.ts) and listens on PORT.
 * The Vercel serverless entry lives in api/vercel.ts and does NOT listen.
 */
import http from 'http';
import { createApp } from './server.js';

async function startServer() {
  const app = await createApp();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[StreamPlay] Server listening on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV === 'production' ? 'production' : 'development'} mode`
    );
  });
}

startServer().catch((err) => {
  console.error('[StreamPlay] Failed to start server:', err);
  process.exit(1);
});
