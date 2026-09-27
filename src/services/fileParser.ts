import { Attachment } from '../types';

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function parseFileToAttachment(file: File): Promise<Attachment> {
  const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const isImage = file.type.startsWith('image/');
  const isText = 
    file.type.startsWith('text/') ||
    file.name.match(/\.(txt|md|markdown|json|csv|tsv|js|jsx|ts|tsx|html|css|py|java|c|cpp|h|go|rs|sh|yaml|yml|xml|sql|env)$/i);
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
  const isDocx = file.name.endsWith('.docx');

  if (isImage) {
    const dataUrl = await readFileAsDataURL(file);
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'image/png',
      dataUrl,
    };
  }

  if (isText) {
    const text = await readFileAsText(file);
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'text/plain',
      extractedText: text,
    };
  }

  if (isPdf) {
    // Basic text extraction or fallback for PDFs in browser
    try {
      const rawText = await readPdfRoughText(file);
      return {
        id,
        name: file.name,
        size: file.size,
        type: 'application/pdf',
        extractedText: rawText || `[PDF 文件: ${file.name}, 大小: ${formatFileSize(file.size)}]`,
      };
    } catch {
      return {
        id,
        name: file.name,
        size: file.size,
        type: 'application/pdf',
        extractedText: `[PDF 文件: ${file.name}, 大小: ${formatFileSize(file.size)}]`,
      };
    }
  }

  if (isDocx) {
    try {
      const rawText = await extractDocxRoughText(file);
      return {
        id,
        name: file.name,
        size: file.size,
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extractedText: rawText || `[Word 文档: ${file.name}]`,
      };
    } catch {
      return {
        id,
        name: file.name,
        size: file.size,
        type: 'application/docx',
        extractedText: `[Word 文档: ${file.name}]`,
      };
    }
  }

  // Fallback: try reading as text
  try {
    const text = await readFileAsText(file);
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      extractedText: text,
    };
  } catch {
    return {
      id,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      extractedText: `[二进制文件: ${file.name}, 大小: ${formatFileSize(file.size)}]`,
    };
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

// Basic browser PDF text extractor
async function readPdfRoughText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const rawString = textDecoder.decode(buffer);
  
  // Extract readable stream characters between stream/endstream or literal text
  const textMatches = rawString.match(/\(([^()]+)\)[\s]*T[jJ]/g);
  if (textMatches && textMatches.length > 0) {
    const extracted = textMatches
      .map(m => m.replace(/^[\s(]+|[)TjJ\s]+$/g, ''))
      .filter(t => t.length > 1)
      .join(' ');
    if (extracted.trim().length > 30) {
      return extracted.slice(0, 50000);
    }
  }
  return `[PDF 文本解析: ${file.name} (${formatFileSize(file.size)})]`;
}

// Rough DOCX parser (DOCX is a zip file, we can scan document.xml text nodes)
async function extractDocxRoughText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const str = textDecoder.decode(buffer);
  
  const textTags = str.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
  if (textTags && textTags.length > 0) {
    return textTags
      .map(tag => tag.replace(/<[^>]+>/g, ''))
      .join(' ')
      .slice(0, 50000);
  }
  return `[Word 文档解析: ${file.name}]`;
}
