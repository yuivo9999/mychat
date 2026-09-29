import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Simple, dependency-free CORS middleware
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Helper: Extract clean text from HTML
  function extractTextFromHtml(html: string): { title: string; text: string } {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '网页内容';

    // Remove script, style, svg, noscript
    let clean = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
      .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
      .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
      .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');

    // Extract text
    clean = clean.replace(/<[^>]+>/g, ' ');
    clean = clean
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    return { title, text: clean.slice(0, 8000) };
  }

  // Helper: Decode HTML entities and strip tags
  function cleanHtmlText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&middot;/g, '·')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 1. Web Search Endpoint (DuckDuckGo HTML + Direct URL crawler + Wikipedia Fallback)
  app.post('/api/web-search', async (req, res) => {
    const { query, urls = [] } = req.body;
    const results: Array<{ title: string; url: string; snippet: string }> = [];
    const pageContents: Array<{ url: string; title: string; content: string }> = [];

    // Crawl specific URLs if provided in user's prompt
    if (Array.isArray(urls) && urls.length > 0) {
      for (const targetUrl of urls.slice(0, 3)) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 6000);
          const pageRes = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (pageRes.ok) {
            const html = await pageRes.text();
            const { title, text } = extractTextFromHtml(html);
            if (text) {
              pageContents.push({ url: targetUrl, title: cleanHtmlText(title), content: text });
            }
          }
        } catch (pageErr) {
          console.warn('Failed to crawl URL:', targetUrl, pageErr);
        }
      }
    }

    // Search DuckDuckGo HTML for query
    if (query && query.trim()) {
      try {
        const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query.trim())}`;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 7000);
        const ddgRes = await fetch(ddgUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (ddgRes.ok) {
          const html = await ddgRes.text();
          const blocks = html.split(/result__body/);
          for (let i = 1; i < blocks.length && results.length < 6; i++) {
            const block = blocks[i];
            const urlMatch = block.match(/href="[^"]*uddg=([^"&]+)/);
            let resultUrl = '';
            if (urlMatch) {
              try {
                resultUrl = decodeURIComponent(urlMatch[1]);
              } catch {}
            }
            if (!resultUrl) {
              const rawHref = block.match(/href="([^"]+)"/);
              if (rawHref && rawHref[1].startsWith('http')) {
                resultUrl = rawHref[1];
              }
            }

            // Exclude advertising or redirect trackers
            if (!resultUrl || resultUrl.includes('duckduckgo.com/y.js') || resultUrl.includes('ad_provider') || resultUrl.includes('ad_domain')) {
              continue;
            }

            const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
            const title = titleMatch ? cleanHtmlText(titleMatch[1]) : '';
            const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
            const snippet = snippetMatch ? cleanHtmlText(snippetMatch[1]) : '';

            if (title && (resultUrl || snippet)) {
              results.push({
                title,
                url: resultUrl,
                snippet,
              });
            }
          }
        }
      } catch (ddgErr) {
        console.warn('DuckDuckGo search error:', ddgErr);
      }
    }

    // Fallback: If 0 results from DuckDuckGo, try Wikipedia OpenSearch
    if (results.length === 0 && query && query.trim()) {
      try {
        const wikiUrl = `https://zh.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query.trim())}&limit=5&namespace=0&format=json`;
        const wikiController = new AbortController();
        const wikiTimer = setTimeout(() => wikiController.abort(), 5000);
        const wikiRes = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: wikiController.signal,
        });
        clearTimeout(wikiTimer);
        if (wikiRes.ok) {
          const data = await wikiRes.json();
          const titles: string[] = data[1] || [];
          const snippets: string[] = data[2] || [];
          const links: string[] = data[3] || [];
          for (let i = 0; i < titles.length; i++) {
            if (titles[i] && links[i]) {
              results.push({
                title: cleanHtmlText(titles[i]),
                url: links[i],
                snippet: cleanHtmlText(snippets[i] || `维基百科词条：${titles[i]}`),
              });
            }
          }
        }
      } catch (wikiErr) {
        console.warn('Wikipedia search fallback error:', wikiErr);
      }
    }

    res.json({
      success: true,
      query: query || '',
      results,
      pageContents,
    });
  });

  // 2. Direct Webpage Fetch Endpoint
  app.post('/api/fetch-url', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        return res.status(resp.status).json({ error: `HTTP ${resp.status}: ${resp.statusText}` });
      }
      const html = await resp.text();
      const { title, text } = extractTextFromHtml(html);
      res.json({ success: true, url, title, content: text });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch webpage' });
    }
  });

  // 3. General Proxy Endpoint for CORS
  app.post('/api/proxy', async (req, res) => {
    const { url, method = 'POST', headers = {}, body } = req.body;
    if (!url) {
      return res.status(400).json({ error: { message: 'Missing target URL' } });
    }
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      });

      res.status(response.status);
      const contentType = response.headers.get('content-type') || '';
      const isEventStream = contentType.includes('text/event-stream') || contentType.includes('stream');

      if (isEventStream && response.body) {
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
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
      res.status(502).json({ error: { message: err.message || 'Proxy error' } });
    }
  });

  // Health check
  app.get('/api/health', (_req, res) => {
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
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
