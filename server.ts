import 'dotenv/config';
import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { initDb } from './server/db.ts';
import { apiRouter } from './server/routes.ts';
import {
  securityHeadersMiddleware,
  rateLimiterMiddleware,
  wafInspectionMiddleware,
} from './server/firewall.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. Security Headers & Anti-Fingerprinting Shield
  app.use(securityHeadersMiddleware);

  // 2. DDoS & Brute-Force Rate Limiter
  app.use(rateLimiterMiddleware);

  // 3. Payload Limit Guard (prevents buffer-overflow / memory exhaustion attacks)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Web Application Firewall (WAF) Deep Packet Inspection (SQLi, XSS, Scanners, Traversal)
  app.use(wafInspectionMiddleware);

  // Initialize PostgreSQL database tables and seeds
  await initDb();

  // API Routes
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', app: 'Life Tracko', timestamp: new Date().toISOString() });
  });

  // 404 handler for unhandled API routes
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  // Vite middleware in dev or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Life Tracko Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Life Tracko server:', err);
  process.exit(1);
});
