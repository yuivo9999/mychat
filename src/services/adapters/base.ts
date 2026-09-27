import { Message, ModelItem, ApiKeyConfig, ModelParameters } from '../../types';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onFinish?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface AdapterOptions {
  model: ModelItem;
  apiKeyConfig: ApiKeyConfig;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  parameters?: ModelParameters;
  abortSignal?: AbortSignal;
  timeoutSeconds?: number;
}

export interface BaseAdapter {
  sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string>;
  testConnection(apiKeyConfig: ApiKeyConfig, modelId?: string): Promise<{ success: boolean; message: string }>;
}

export async function executeFetch(
  targetUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
): Promise<Response> {
  const method = init.method || 'POST';
  const headers = init.headers || {};
  const body = init.body;
  let parsedBody: any = body;

  if (typeof body === 'string') {
    try { parsedBody = JSON.parse(body); } catch { parsedBody = body; }
  }

  try {
    return await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: targetUrl, method, headers, body: parsedBody }),
      signal: init.signal,
    });
  } catch (proxyErr: any) {
    if (proxyErr.name === 'AbortError') throw proxyErr;
    // Direct fallback is useful for local development against providers that
    // explicitly allow browser CORS. Hosted deployments should use /api/proxy.
    return fetch(targetUrl, init);
  }
}

export function parseHttpError(status: number, errorData: any, statusText: string): string {
  let detail = '';
  let reason = '';
  if (typeof errorData === 'string') {
    detail = errorData;
  } else if (errorData?.error?.message) {
    detail = errorData.error.message;
    reason = errorData?.error?.details?.[0]?.reason || errorData?.error?.status || '';
  } else if (errorData?.message) {
    detail = errorData.message;
  }

  if (
    detail.includes('API key not valid') ||
    detail.includes('API_KEY_INVALID') ||
    reason === 'API_KEY_INVALID' ||
    detail.toLowerCase().includes('api key not valid')
  ) {
    return `API Key 无效或未生效 (${status} API_KEY_INVALID): 提供商拒绝了此 Key。请确认 Key 属于当前提供商、对应 API 已启用，并且没有复制空格、引号或其他平台的 Key。`;
  }

  if (status === 401) return `API Key 无效或未授权 (401): ${detail || '请检查设置中的 API Key'}`;
  if (status === 403) return `没有访问权限 (403): ${detail || '当前 API Key 没有该模型或 API 的调用权限'}`;
  if (status === 404) return `模型不存在或端点未找到 (404): ${detail || '请确认模型 ID 和 Base URL 是否匹配'}`;
  if (status === 429) {
    if (detail.toLowerCase().includes('quota') || detail.toLowerCase().includes('balance') || detail.toLowerCase().includes('credit')) {
      return `额度不足 (429): ${detail || '当前 Key 的免费额度或账户额度已耗尽'}`;
    }
    return `请求频率超限 (429): ${detail || '请求过于频繁，请稍后再试'}`;
  }
  if (status >= 500) return `服务提供商接口故障 (${status}): ${detail || statusText || '提供商服务器错误，请稍后再试'}`;
  return `请求失败 (${status} ${statusText}): ${detail || '未知错误'}`;
}
