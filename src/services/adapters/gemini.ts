import { BaseAdapter, AdapterOptions, StreamCallbacks, parseHttpError, executeFetch } from './base';
import { ApiKeyConfig } from '../../types';
import { extractAttachmentText } from '../fileParser';

export class GeminiAdapter implements BaseAdapter {
  private normalizeModelId(modelId: string): string {
    const m = (modelId || '').trim();
    // Do not silently rewrite valid/legacy model IDs. Google controls model
    // availability; rewriting a user-selected model can turn a valid request
    // into a request for a different model.
    return m || 'gemini-3.8-flash';
  }

  private cleanKey(rawKey?: string): string {
    let key = (rawKey || '').trim();
    key = key.replace(/^["']|["']$/g, '').trim();
    if (key.toLowerCase().startsWith('bearer ')) key = key.slice(7).trim();
    return key;
  }

  private resolveEndpoint(apiKeyConfig: ApiKeyConfig, modelId: string, isStream: boolean): string {
    let base = (apiKeyConfig.baseUrl?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    if (!base.includes('/v1beta') && !base.includes('/v1')) base += '/v1beta';

    const action = isStream ? 'streamGenerateContent' : 'generateContent';
    const effectiveModel = this.normalizeModelId(modelId);
    const sseParam = isStream ? '?alt=sse' : '';
    return `${base}/models/${encodeURIComponent(effectiveModel)}:${action}${sseParam}`;
  }

  private requestHeaders(apiKeyConfig: ApiKeyConfig, customHeaders?: Record<string, string>): Record<string, string> {
    const key = this.cleanKey(apiKeyConfig.apiKey);
    return {
      'Content-Type': 'application/json',
      ...(key ? { 'x-goog-api-key': key } : {}),
      ...customHeaders,
    };
  }

  async sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string> {
    const { model, apiKeyConfig, messages, systemPrompt, temperature, maxTokens, topP, parameters, abortSignal, timeoutSeconds } = options;
    const stream = (parameters?.stream !== undefined ? parameters.stream : model.supportsStreaming !== false) && callbacks != null;
    const endpoint = this.resolveEndpoint(apiKeyConfig, model.id, stream);
    const contents: any[] = [];

    for (const msg of messages) {
      const parts: any[] = [];
      const role = msg.role === 'assistant' ? 'model' : 'user';
      const textContent = msg.content;
      if (textContent) parts.push({ text: textContent });

      if (msg.role === 'user' && msg.attachments) {
        for (const att of msg.attachments) {
          if (att.type.startsWith('image/') && model.supportsVision && att.dataUrl) {
            const matches = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) parts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
          } else if (model.supportsFiles && att.base64Data) {
            // Native file input: the attachment remains a separate file part;
            // its bytes are not copied into the user prompt.
            parts.push({ inlineData: { mimeType: att.type || 'application/octet-stream', data: att.base64Data } });
          } else if (att.base64Data) {
            // Only unsupported file inputs reach the local text fallback.
            parts.push({ text: `[附件文本: ${att.name}]\n${extractAttachmentText(att)}` });
          }
        }
      }
      if (parts.length > 0) contents.push({ role, parts });
    }

    const bodyPayload: any = { contents, generationConfig: {} };
    const sys = systemPrompt || model.systemPrompt;
    if (sys && sys.trim()) bodyPayload.systemInstruction = { parts: [{ text: sys.trim() }] };

    const effectiveTemp = parameters?.temperature ?? temperature ?? model.temperature;
    const effectiveMaxTokens = parameters?.maxTokens ?? maxTokens ?? model.maxTokens;
    const effectiveTopP = parameters?.topP ?? topP ?? model.topP;
    if (typeof effectiveTemp === 'number') bodyPayload.generationConfig.temperature = effectiveTemp;
    if (typeof effectiveMaxTokens === 'number' && effectiveMaxTokens > 0) bodyPayload.generationConfig.maxOutputTokens = effectiveMaxTokens;
    if (typeof effectiveTopP === 'number') bodyPayload.generationConfig.topP = effectiveTopP;
    if (typeof parameters?.presencePenalty === 'number' && parameters.presencePenalty !== 0) bodyPayload.generationConfig.presencePenalty = parameters.presencePenalty;
    if (typeof parameters?.frequencyPenalty === 'number' && parameters.frequencyPenalty !== 0) bodyPayload.generationConfig.frequencyPenalty = parameters.frequencyPenalty;
    if (parameters?.stop && parameters.stop.trim()) bodyPayload.generationConfig.stopSequences = [parameters.stop.trim()];
    if (parameters?.enableReasoning) bodyPayload.generationConfig.thinkingConfig = { thinkingBudget: 2048 };

    const controller = new AbortController();
    const timeout = (timeoutSeconds || 60) * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const onUserAbort = () => controller.abort();
    if (abortSignal) abortSignal.addEventListener('abort', onUserAbort);

    let response: Response;
    try {
      response = await executeFetch(endpoint, {
        method: 'POST',
        headers: this.requestHeaders(apiKeyConfig, model.customHeaders),
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (abortSignal?.aborted) throw new Error('用户已手动停止生成');
        throw new Error(`Gemini 请求超时 (${timeout / 1000}秒)`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (abortSignal) abortSignal.removeEventListener('abort', onUserAbort);
    }

    if (!response.ok) {
      let errorData: any = null;
      try { errorData = await response.json(); } catch { errorData = await response.text(); }
      throw new Error(parseHttpError(response.status, errorData, response.statusText));
    }

    if (stream && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let fullContent = '';
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(5).trim());
              const parts = parsed.candidates?.[0]?.content?.parts || [];
              for (const part of parts) {
                if (part.text) {
                  fullContent += part.text;
                  callbacks?.onChunk(part.text);
                }
              }
            } catch {}
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          callbacks?.onFinish?.(fullContent);
          return fullContent;
        }
        throw err;
      }
      callbacks?.onFinish?.(fullContent);
      return fullContent;
    }

    const resJson = await response.json();
    const parts = resJson.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p: any) => p.text || '').join('');
    callbacks?.onChunk?.(text);
    callbacks?.onFinish?.(text);
    return text;
  }

  async testConnection(apiKeyConfig: ApiKeyConfig, modelId = 'gemini-3.8-flash'): Promise<{ success: boolean; message: string }> {
    try {
      const effectiveModel = this.normalizeModelId(modelId);
      const endpoint = this.resolveEndpoint(apiKeyConfig, effectiveModel, false);
      const res = await executeFetch(endpoint, {
        method: 'POST',
        headers: this.requestHeaders(apiKeyConfig),
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Hello' }] }], generationConfig: { maxOutputTokens: 5 } }),
      });
      if (res.ok) return { success: true, message: `Gemini 连接成功！模型 [${effectiveModel}] 已响应。` };
      let errorData: any = null;
      try { errorData = await res.json(); } catch { errorData = await res.text(); }
      return { success: false, message: `模型 [${effectiveModel}] 连接失败: ${parseHttpError(res.status, errorData, res.statusText)}` };
    } catch (err: any) {
      return { success: false, message: err.message || '连接失败' };
    }
  }
}
