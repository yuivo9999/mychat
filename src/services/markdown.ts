import { Marked } from 'marked';
import hljs from 'highlight.js';

const marked = new Marked({
  gfm: true,
  breaks: true,
});

// Configure custom renderer
const renderer = {
  code({ text, lang }: { text: string; lang?: string }) {
    const validLang = lang && hljs.getLanguage(lang) ? lang : '';
    let highlighted = '';

    try {
      if (validLang) {
        highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
      } else {
        highlighted = hljs.highlightAuto(text).value;
      }
    } catch {
      highlighted = escapeHtml(text);
    }

    const displayLang = (lang || 'TEXT').toLowerCase();
    const encoded = encodeURIComponent(text);

    return `
      <div class="code-block-wrapper my-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-hidden shadow-sm not-prose">
        <div class="code-header flex items-center justify-between px-3.5 py-1.5 bg-neutral-800/70 dark:bg-neutral-900/90 text-xs font-mono text-neutral-400 border-b border-neutral-700/50 dark:border-neutral-800 select-none">
          <span class="font-medium text-neutral-300 uppercase tracking-wider">${displayLang}</span>
          <div class="flex items-center gap-1.5">
            <button type="button" class="code-copy-btn inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer" data-code="${encoded}" title="复制代码">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>复制</span>
            </button>
            <button type="button" class="code-dl-btn inline-flex items-center gap-1 px-2 py-1 rounded hover:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer" data-lang="${displayLang}" data-code="${encoded}" title="下载代码文件">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              <span>下载</span>
            </button>
          </div>
        </div>
        <pre class="p-4 overflow-x-auto text-[13px] font-mono leading-relaxed selection:bg-indigo-600/40"><code class="hljs language-${displayLang}">${highlighted}</code></pre>
      </div>
    `;
  },

  table({ header, rows }: { header: string; rows: string }) {
    return `
      <div class="overflow-x-auto my-4 rounded-lg border border-neutral-200 dark:border-neutral-800">
        <table class="w-full text-left border-collapse text-sm">
          <thead class="bg-neutral-100 dark:bg-neutral-800/80 font-medium text-neutral-700 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800">
            ${header}
          </thead>
          <tbody class="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900/40">
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  },

  link({ href, title, text }: { href: string; title?: string | null; text: string }) {
    const t = title ? ` title="${escapeHtml(title)}"` : '';
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"${t}>${text}<svg class="w-3 h-3 inline-block ml-0.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg></a>`;
  }
};

marked.use({ renderer: renderer as any });

export function renderMarkdown(content: string): string {
  if (!content) return '';
  try {
    return marked.parse(content) as string;
  } catch {
    return escapeHtml(content);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getFileExtensionForLang(lang: string): string {
  const map: Record<string, string> = {
    javascript: 'js',
    js: 'js',
    typescript: 'ts',
    ts: 'ts',
    tsx: 'tsx',
    jsx: 'jsx',
    python: 'py',
    py: 'py',
    html: 'html',
    css: 'css',
    json: 'json',
    markdown: 'md',
    md: 'md',
    sql: 'sql',
    bash: 'sh',
    sh: 'sh',
    shell: 'sh',
    go: 'go',
    rust: 'rs',
    rs: 'rs',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
  };
  return map[lang.toLowerCase()] || 'txt';
}
