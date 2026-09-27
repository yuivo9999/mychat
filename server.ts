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
      let targetUrl = url;
      const envGeminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

      // Smart fallback for Google Gemini endpoints with default/test/env keys
      if (targetUrl.includes('generativelanguage.googleapis.com') && envGeminiKey) {
        try {
          const parsed = new URL(targetUrl);
          const currentKey = (parsed.searchParams.get('key') || '').trim();
          const isDummyOrTestKey = 
            !currentKey ||
            currentKey.toLowerCase().includes('test') ||
            currentKey.toLowerCase().includes('mock') ||
            currentKey.toLowerCase().includes('default') ||
            currentKey.toLowerCase().includes('google') ||
            currentKey.includes('AIzaSy_') ||
            currentKey === 'undefined' ||
            currentKey.length < 35;

          if (isDummyOrTestKey) {
            parsed.searchParams.set('key', envGeminiKey);
          }

          // Map deprecated/legacy model names in URL to supported models
          let pathname = parsed.pathname;
          if (pathname.includes('/models/gemini-1.5-flash') || pathname.includes('/models/gemini-2.5-flash') || pathname.includes('/models/gemini-2.0-flash')) {
            pathname = pathname.replace(/\/models\/gemini-[12]\.[05]-flash(-8b)?/, '/models/gemini-3.8-flash');
          } else if (pathname.includes('/models/gemini-1.5-pro') || pathname.includes('/models/gemini-2.5-pro')) {
            pathname = pathname.replace(/\/models\/gemini-[12]\.[05]-pro/, '/models/gemini-3.8-flash');
          }
          parsed.pathname = pathname;
          targetUrl = parsed.toString();
        } catch {
          // Ignore URL parsing failure
        }
      }

      // Forward request from backend
      let response = await fetch(targetUrl, {
        method,
        headers: {
          ...headers,
        },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      });

      // If failed on a Gemini endpoint and envKey is available, retry with gemini-3.8-flash and envKey
      if (!response.ok && envGeminiKey && targetUrl.includes('generativelanguage.googleapis.com')) {
        try {
          const parsed = new URL(targetUrl);
          parsed.searchParams.set('key', envGeminiKey);
          if (parsed.pathname.includes('/models/')) {
            parsed.pathname = parsed.pathname.replace(/\/models\/[^:]+/, '/models/gemini-3.8-flash');
          }
          const retryResponse = await fetch(parsed.toString(), {
            method,
            headers: { ...headers },
            body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
          });
          if (retryResponse.ok) {
            response = retryResponse;
          }
        } catch {}
      }

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
