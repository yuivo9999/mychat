import katex from 'katex';
import { Marked } from 'marked';
import hljs from 'highlight.js';

export interface MarkdownOptions {
  renderLatex?: boolean;
  showLineNumbers?: boolean;
  collapseLongCode?: boolean;
  enableCodeHighlight?: boolean;
  codeShowCopyBtn?: boolean;
  codeShowDownloadBtn?: boolean;
  codeShowAddToWorkspaceBtn?: boolean;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLatexInText(text: string): string {
  if (!text) return '';

  // 1. Block math: $$ ... $$ or \[ ... \]
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return `<div class="katex-block my-3 overflow-x-auto text-center py-2 px-1">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `$$${math}$$`;
    }
  });

  result = result.replace(/\\\[([\s\S]+?)\\\]/g, (_, math) => {
    try {
      return `<div class="katex-block my-3 overflow-x-auto text-center py-2 px-1">${katex.renderToString(math.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `\\[${math}\\]`;
    }
  });

  // 2. Inline math: $ ... $ (avoiding plain dollar currencies like $10 or $20)
  result = result.replace(/(?<!\\|\$)\$([^\$\n]+?)\$(?!\$)/g, (match, math) => {
    // If it looks like plain currency (e.g. $100 or $5.50), skip
    if (/^\s*\d+(\.\d+)?(\s*[\+\-\*\/]\s*\d+(\.\d+)?)?\s*$/.test(math)) {
      return match;
    }
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return match;
    }
  });

  result = result.replace(/\\\(([\s\S]+?)\\\)/g, (match, math) => {
    try {
      return katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
    } catch {
      return match;
    }
  });

  return result;
}

function processMarkdownWithLatex(content: string, renderLatex: boolean): string {
  if (!renderLatex || !content) return content;

  // Protect code blocks and inline code from LaTeX parsing
  const codeBlocks: string[] = [];
  let processed = content.replace(/(```[\s\S]*?```|`[^`\n]+`)/g, (match) => {
    const placeholder = `__MATH_CODE_TOKEN_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return placeholder;
  });

  // Render LaTeX formulas
  processed = renderLatexInText(processed);

  // Restore code blocks
  processed = processed.replace(/__MATH_CODE_TOKEN_(\d+)__/g, (_, idx) => {
    return codeBlocks[parseInt(idx, 10)] || '';
  });

  return processed;
}

export function renderMarkdown(content: string, options: MarkdownOptions = {}): string {
  if (!content) return '';
  const {
    renderLatex = true,
    showLineNumbers = true,
    collapseLongCode = true,
    enableCodeHighlight = true,
    codeShowCopyBtn = true,
    codeShowDownloadBtn = true,
    codeShowAddToWorkspaceBtn = true,
  } = options;

  try {
    const textWithLatex = processMarkdownWithLatex(content, renderLatex);

    const customMarked = new Marked({
      gfm: true,
      breaks: true,
    });

    customMarked.use({
      renderer: {
        code({ text, lang }: { text: string; lang?: string }) {
          const displayLang = (lang || 'TEXT').toLowerCase();
          const validLang = enableCodeHighlight && lang && hljs.getLanguage(lang) ? lang : '';
          let highlighted = '';

          try {
            if (enableCodeHighlight) {
              if (validLang) {
                highlighted = hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
              } else {
                highlighted = hljs.highlightAuto(text).value;
              }
            } else {
              highlighted = escapeHtml(text);
            }
          } catch {
            highlighted = escapeHtml(text);
          }

          const encoded = encodeURIComponent(text);
          
          const rawLines = text.split('\n');
          const lineCount = rawLines.length;
          const isLongCode = collapseLongCode && lineCount >= 14;

          // Build line numbers HTML
          let lineNumbersHtml = '';
          if (showLineNumbers) {
            const linesArray = highlighted.split('\n');
            lineNumbersHtml = `
              <div class="code-line-numbers select-none py-3 pl-2.5 pr-2.5 text-right font-mono text-[11px] leading-[1.625rem] text-neutral-500/50 dark:text-neutral-500/40 border-r border-neutral-700/30 dark:border-neutral-800 shrink-0">
                ${linesArray.map((_, i) => `<span class="block">${i + 1}</span>`).join('')}
              </div>
            `;
          }

          const codeContentHtml = `
            <div class="code-body flex min-w-0 flex-1">
              ${lineNumbersHtml}
              <pre class="flex-1 p-3 px-3.5 overflow-x-auto text-[12.5px] font-mono leading-[1.625rem] selection:bg-indigo-600/40"><code class="hljs language-${displayLang}">${highlighted}</code></pre>
            </div>
          `;

          // Generate dynamic toolbar buttons based on user options
          let buttonsHtml = '';
          if (codeShowCopyBtn) {
            buttonsHtml += `
              <button type="button" class="code-copy-btn inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer text-xs" data-code="${encoded}" title="复制代码">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                <span>复制</span>
              </button>
            `;
          }
          if (codeShowDownloadBtn) {
            buttonsHtml += `
              <button type="button" class="code-dl-btn inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer text-xs" data-lang="${displayLang}" data-code="${encoded}" title="下载代码文件">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span>下载</span>
              </button>
            `;
          }
          if (codeShowAddToWorkspaceBtn) {
            buttonsHtml += `
              <button type="button" class="code-add-workspace-btn inline-flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-neutral-700 dark:hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer text-xs" data-lang="${displayLang}" data-code="${encoded}" title="保存到工作区成为文件">
                <svg class="w-3.5 h-3.5 text-lime-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>加入工作区</span>
              </button>
            `;
          }

          if (isLongCode) {
            return `
              <div class="code-block-wrapper my-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-hidden shadow-sm not-prose">
                <div class="code-header flex items-center justify-between px-3.5 py-1.5 bg-neutral-800/80 dark:bg-neutral-900/95 text-xs font-mono text-neutral-400 border-b border-neutral-700/50 dark:border-neutral-800 select-none">
                  <div class="flex items-center gap-2">
                    <span class="font-medium text-neutral-300 uppercase tracking-wider">${displayLang}</span>
                    <span class="text-[10px] px-1.5 py-0.2 rounded bg-neutral-700/60 dark:bg-neutral-800 text-neutral-400 font-sans">${lineCount} 行</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    ${buttonsHtml}
                  </div>
                </div>
                <div class="code-collapsible-wrapper relative max-h-[300px] overflow-hidden transition-all duration-300">
                  ${codeContentHtml}
                  <div class="code-collapse-mask absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-neutral-900 via-neutral-900/85 dark:from-neutral-950 dark:via-neutral-950/85 to-transparent flex items-end justify-center pb-2 select-none">
                    <button type="button" class="code-expand-toggle-btn inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/80 shadow-md transition active:scale-95 cursor-pointer">
                      <svg class="w-3.5 h-3.5 transition-transform duration-200 toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                      <span class="toggle-text">展开完整代码 (${lineCount} 行)</span>
                    </button>
                  </div>
                </div>
              </div>
            `;
          }

          return `
            <div class="code-block-wrapper my-3.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-neutral-900 dark:bg-neutral-950 text-neutral-100 overflow-hidden shadow-sm not-prose">
              <div class="code-header flex items-center justify-between px-3.5 py-1.5 bg-neutral-800/80 dark:bg-neutral-900/95 text-xs font-mono text-neutral-400 border-b border-neutral-700/50 dark:border-neutral-800 select-none">
                <span class="font-medium text-neutral-300 uppercase tracking-wider">${displayLang}</span>
                <div class="flex items-center gap-1.5">
                  ${buttonsHtml}
                </div>
              </div>
              ${codeContentHtml}
            </div>
          `;
        },
        table({ header, rows }: { header: string; rows: string }) {
          return `
            <div class="overflow-x-auto my-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
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
        heading({ text, depth }: { text: string; depth: number }) {
          const hashes = '#'.repeat(depth);
          return `<div class="my-2.5 font-sans">${hashes} ${text}</div>`;
        },
        blockquote({ text }: { text: string }) {
          return `<div class="my-2 pl-3.5 border-l-2 border-neutral-300 dark:border-neutral-700 text-neutral-500 font-sans">${text}</div>`;
        },
        strong({ text }: { text: string }) {
          return `**${text}**`;
        },
        em({ text }: { text: string }) {
          return `*${text}*`;
        },
        codespan({ text }: { text: string }) {
          return `<code class="font-mono bg-neutral-100 dark:bg-neutral-800 px-1 py-0.5 rounded text-[12.5px]">${text}</code>`;
        },
        link({ href, text }: { href: string; text: string }) {
          if (href === text) return href;
          return `${text} (${href})`;
        },
        image({ href, text }: { href: string; text: string }) {
          return `![${text}](${href})`;
        },
        list({ items, ordered, start }: { items: any[]; ordered: boolean; start: number }) {
          return `<div class="my-2.5 space-y-1 pl-1 font-sans">${items.map((item, i) => {
            const prefix = ordered ? `${(start || 1) + i}. ` : '• ';
            return `<div>${prefix}${item.text || item}</div>`;
          }).join('')}</div>`;
        },
        listitem({ text }: { text: string }) {
          return text;
        },
        paragraph({ text }: { text: string }) {
          return `<div class="my-2 leading-relaxed font-sans">${text}</div>`;
        }
      } as any
    });

    return customMarked.parse(textWithLatex) as string;
  } catch {
    return escapeHtml(content);
  }
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
