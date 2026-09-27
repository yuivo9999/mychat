import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Same-origin server proxy. This is required when the browser cannot call an
  // external provider directly because of CORS. Provider keys can be supplied
  // by the UI or, preferably in a hosted deployment, by environment variables.
  app.post('/api/proxy', async (req, res) => {
    const { url, method = 'POST', headers = {}, body } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: { message: 'Missing target URL' } });
    }

    try {
      const parsed = new URL(url);
      const targetHost = parsed.hostname.toLowerCase();
      const forwardedHeaders: Record<string, string> = { ...headers };

      // Never leak a query-string Gemini key into logs, browser history, or
      // intermediary URLs. Gemini accepts x-goog-api-key as a request header.
      if (targetHost === 'generativelanguage.googleapis.com') {
        const envGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        const queryKey = parsed.searchParams.get('key') || '';
        const headerKey = forwardedHeaders['x-goog-api-key'] || forwardedHeaders['X-Goog-Api-Key'] || '';
        const key = envGeminiKey || headerKey || queryKey;
        parsed.searchParams.delete('key');
        delete forwardedHeaders['x-goog-api-key'];
        delete forwardedHeaders['X-Goog-Api-Key'];
        if (key) forwardedHeaders['x-goog-api-key'] = key;
      }

      // NVIDIA uses the OpenAI-compatible Bearer authorization header. If the
      // deployment provides NVIDIA_API_KEY, use it only when the client did
      // not already supply Authorization.
      if (targetHost === 'integrate.api.nvidia.com') {
        const envNvidiaKey = process.env.NVIDIA_API_KEY;
        const hasAuthorization = Object.keys(forwardedHeaders).some(k => k.toLowerCase() === 'authorization');
        if (envNvidiaKey && !hasAuthorization) {
          forwardedHeaders.Authorization = `Bearer ${envNvidiaKey}`;
        }
      }

      const targetUrl = parsed.toString();
      const response = await fetch(targetUrl, {
        method,
        headers: forwardedHeaders,
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
      console.error('Server proxy error:', err?.message || err);
      res.status(502).json({
        error: {
          message: err?.message || 'Server proxy failed to connect to the target endpoint',
        },
      });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
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
