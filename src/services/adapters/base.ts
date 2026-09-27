import { Message, ModelItem, ApiKeyConfig } from '../../types';

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
  abortSignal?: AbortSignal;
  timeoutSeconds?: number;
}

export interface BaseAdapter {
  sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string>;
  testConnection(apiKeyConfig: ApiKeyConfig, modelId?: string): Promise<{ success: boolean; message: string }>;
}

export function parseHttpError(status: number, errorData: any, statusText: string): string {
  let detail = '';
  if (typeof errorData === 'string') {
    detail = errorData;
  } else if (errorData?.error?.message) {
    detail = errorData.error.message;
  } else if (errorData?.message) {
    detail = errorData.message;
  }

  if (status === 401) {
    return `API Key 无效或未授权 (401): ${detail || '请检查设置中填写的 API Key 是否正确'}`;
  }
  if (status === 403) {
    return `没有访问权限 (403): ${detail || '当前 API Key 没有该模型的调用权限'}`;
  }
  if (status === 404) {
    return `模型不存在或端点未找到 (404): ${detail || '请确认模型 ID 和 Base URL 是否匹配'}`;
  }
  if (status === 429) {
    if (detail.includes('quota') || detail.includes('balance') || detail.includes('credit')) {
      return `账户余额不足 (429 Quota Exceeded): ${detail || '请前往提供商后台充值或更换有效的 API Key'}`;
    }
    return `请求频率超限 (429 Rate Limit): ${detail || '请求过于频繁，请稍后再试'}`;
  }
  if (status >= 500) {
    return `服务提供商接口故障 (${status}): ${detail || statusText || '提供商服务器错误，请稍后重试'}`;
  }

  return `请求失败 (${status} ${statusText}): ${detail || '未知错误'}`;
}
