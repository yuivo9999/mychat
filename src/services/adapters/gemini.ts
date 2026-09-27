import { BaseAdapter, AdapterOptions, StreamCallbacks, parseHttpError } from './base';
import { ApiKeyConfig } from '../../types';

export class GeminiAdapter implements BaseAdapter {
  private resolveEndpoint(apiKeyConfig: ApiKeyConfig, modelId: string, isStream: boolean): string {
    let base = (apiKeyConfig.baseUrl?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
    const action = isStream ? 'streamGenerateContent' : 'generateContent';
    const key = encodeURIComponent(apiKeyConfig.apiKey?.trim() || '');
    
    // Check if base has /v1beta
    if (!base.includes('/v1beta') && !base.includes('/v1')) {
      base += '/v1beta';
    }

    const sseParam = isStream ? '&alt=sse' : '';
    return `${base}/models/${modelId}:${action}?key=${key}${sseParam}`;
  }

  async sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string> {
    const { model, apiKeyConfig, messages, systemPrompt, temperature, maxTokens, topP, abortSignal, timeoutSeconds } = options;
    const stream = model.supportsStreaming !== false && callbacks != null;
    const endpoint = this.resolveEndpoint(apiKeyConfig, model.id, stream);

    const contents: any[] = [];

    for (const msg of messages) {
      const parts: any[] = [];
      const role = msg.role === 'assistant' ? 'model' : 'user';

      let textContent = msg.content;
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          if (att.extractedText) {
            textContent += `\n\n[附件: ${att.name}]\n${att.extractedText}`;
          }
        }
      }
      if (textContent) {
        parts.push({ text: textContent });
      }

      // Add image parts if multimodal
      if (msg.role === 'user' && msg.attachments && model.supportsVision) {
        for (const att of msg.attachments) {
          if (att.type.startsWith('image/') && att.dataUrl) {
            const matches = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
              parts.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2],
                },
              });
            }
          }
        }
      }

      if (parts.length > 0) {
        contents.push({ role, parts });
      }
    }

    const bodyPayload: any = {
      contents,
      generationConfig: {},
    };

    const sys = systemPrompt || model.systemPrompt;
    if (sys && sys.trim()) {
      bodyPayload.systemInstruction = {
        parts: [{ text: sys.trim() }],
      };
    }

    if (typeof temperature === 'number') bodyPayload.generationConfig.temperature = temperature;
    if (typeof maxTokens === 'number' && maxTokens > 0) bodyPayload.generationConfig.maxOutputTokens = maxTokens;
    if (typeof topP === 'number') bodyPayload.generationConfig.topP = topP;

    const controller = new AbortController();
    const timeout = (timeoutSeconds || 60) * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onUserAbort = () => controller.abort();
    if (abortSignal) abortSignal.addEventListener('abort', onUserAbort);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...model.customHeaders,
        },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
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
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
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
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                const candidates = parsed.candidates || [];
                const parts = candidates[0]?.content?.parts || [];
                for (const part of parts) {
                  if (part.text) {
                    fullContent += part.text;
                    callbacks?.onChunk(part.text);
                  }
                }
              } catch {}
            }
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

  async testConnection(apiKeyConfig: ApiKeyConfig, modelId = 'gemini-2.5-flash'): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = this.resolveEndpoint(apiKeyConfig, modelId, false);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (res.ok) {
        return { success: true, message: `Gemini 连接成功！已成功握手 ${modelId}。` };
      }

      let errorData: any = null;
      try {
        errorData = await res.json();
      } catch {
        errorData = await res.text();
      }
      return { success: false, message: parseHttpError(res.status, errorData, res.statusText) };
    } catch (err: any) {
      return { success: false, message: err.message || '连接失败' };
    }
  }
}
