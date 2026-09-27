import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON Body parser with high limit for image & doc attachments
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Universal API Proxy endpoint to bypass browser CORS for LLM providers
  app.post('/api/proxy', async (req, res) => {
    const { url, method = 'POST', headers = {}, body } = req.body;
    if (!url) {
      return res.status(400).json({ error: { message: 'Missing target URL' } });
    }

    try {
      // Forward request from backend
      const response = await fetch(url, {
        method,
        headers: {
          ...headers,
        },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      });

      res.status(response.status);

      const contentType = response.headers.get('content-type') || '';
      const isEventStream = contentType.includes('text/event-stream') || contentType.includes('stream');

      if (isEventStream && response.body) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        if (contentType.includes('application/json')) {
          const data = await response.json();
          res.json(data);
        } else {
          const text = await response.text();
          res.send(text);
        }
      }
    } catch (err: any) {
      console.error('Server proxy error for URL:', url, err);
      res.status(502).json({
        error: {
          message: err.message || 'Server proxy failed to connect to the target endpoint',
        },
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // In development, mount Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built dist
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
