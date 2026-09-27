import { Attachment } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const comma = dataUrl.indexOf(',');
      if (comma < 0) return reject(new Error('无法读取文件 Base64 数据'));
      resolve(dataUrl.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export async function parseFileToAttachment(file: File): Promise<Attachment> {
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const type = file.type || guessMimeType(file.name);
  const base64Data = await fileToBase64(file);
  const dataUrl = `data:${type};base64,${base64Data}`;

  return {
    id,
    name: file.name,
    size: file.size,
    type,
    dataUrl: type.startsWith('image/') ? dataUrl : undefined,
    base64Data,
  };
}

function guessMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'txt': return 'text/plain';
    case 'md':
    case 'markdown': return 'text/markdown';
    case 'csv': return 'text/csv';
    case 'tsv': return 'text/tab-separated-values';
    case 'json': return 'application/json';
    case 'js':
    case 'mjs':
    case 'cjs': return 'text/javascript';
    case 'jsx': return 'text/jsx';
    case 'ts': return 'text/typescript';
    case 'tsx': return 'text/tsx';
    case 'html': return 'text/html';
    case 'css': return 'text/css';
    case 'py': return 'text/x-python';
    case 'java': return 'text/x-java';
    case 'c':
    case 'h': return 'text/x-c';
    case 'cpp': return 'text/x-c++';
    case 'go': return 'text/x-go';
    case 'rs': return 'text/x-rust';
    case 'sh': return 'text/x-shellscript';
    case 'yaml':
    case 'yml': return 'application/yaml';
    case 'xml': return 'text/xml';
    case 'sql': return 'application/sql';
    case 'env': return 'text/plain';
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function decodeBase64Text(base64: string): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(base64ToBytes(base64));
}

export function extractPdfRoughText(base64: string, fileName: string): string {
  const rawString = decodeBase64Text(base64);
  const textMatches = rawString.match(/\(([^()]+)\)[\\s]*T[jJ]/g);
  if (textMatches && textMatches.length > 0) {
    const extracted = textMatches
      .map(m => m.replace(/^[\\s(]+|[)TjJ\\s]+$/g, ''))
      .filter(t => t.length > 1)
      .join(' ');
    if (extracted.trim().length > 30) return extracted.slice(0, 50000);
  }
  return `[PDF 文本解析失败: ${fileName} (${formatFileSize(base64ToBytes(base64).byteLength)})]`;
}

export function extractDocxRoughText(base64: string, fileName: string): string {
  const str = decodeBase64Text(base64);
  const textTags = str.match(/<w:t[^>]*>([^<]+)<\\/w:t>/g);
  if (textTags && textTags.length > 0) {
    return textTags.map(tag => tag.replace(/<[^>]+>/g, '')).join(' ').slice(0, 50000);
  }
  return `[Word 文档文本解析失败: ${fileName}]`;
}

export function extractAttachmentText(att: Attachment): string {
  if (att.extractedText) return att.extractedText;
  if (!att.base64Data) return `[附件: ${att.name}]`;

  if (att.type === 'application/pdf' || att.name.toLowerCase().endsWith('.pdf')) {
    return extractPdfRoughText(att.base64Data, att.name);
  }

  if (
    att.type.startsWith('text/') ||
    /\\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|html|css|py|java|c|cpp|h|go|rs|sh|yaml|yml|xml|sql|env)$/i.test(att.name)
  ) {
    return decodeBase64Text(att.base64Data).slice(0, 100000);
  }

  if (att.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || att.name.toLowerCase().endsWith('.docx')) {
    return extractDocxRoughText(att.base64Data, att.name);
  }

  return `[无法本地提取文本的附件: ${att.name}]`;
}
