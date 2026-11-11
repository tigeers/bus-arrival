import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './api/index.ts';
import healthHandler from './api/health.ts';
import busTrackerHandler from './api/bustracker.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS support for API endpoints
  app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, AccountKey, x-account-key');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API endpoints according to instructions
  app.use('/api/health', healthHandler);
  app.use('/api/bustracker', busTrackerHandler);
  app.use('/api', apiRouter);

  // Vite middleware in dev or static serving in prod
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[LTA Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[LTA Server] Health endpoint: http://localhost:${PORT}/api/health`);
    console.log(`[LTA Server] Bus tracker endpoint: http://localhost:${PORT}/api/bustracker`);
  });
}

startServer().catch((err) => {
  console.error('[LTA Server] Failed to start:', err);
  process.exit(1);
});
