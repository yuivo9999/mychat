import { BaseAdapter, AdapterOptions, StreamCallbacks, parseHttpError } from './base';
import { ApiKeyConfig } from '../../types';

export class AnthropicAdapter implements BaseAdapter {
  private resolveEndpoint(apiKeyConfig: ApiKeyConfig): string {
    let base = (apiKeyConfig.baseUrl?.trim() || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    if (!base.endsWith('/messages')) {
      base += '/messages';
    }
    return base;
  }

  async sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string> {
    const { model, apiKeyConfig, messages, systemPrompt, temperature, maxTokens, topP, parameters, abortSignal, timeoutSeconds } = options;
    const endpoint = this.resolveEndpoint(apiKeyConfig);

    const formattedMessages: any[] = [];
    let sys = systemPrompt || model.systemPrompt || '';
    if (parameters?.enableReasoning) {
      const reasoningInstruction = '【深度推理模式开启】请在最终回答前，进行严密、深刻且步骤详尽的逻辑推导与思考分析。';
      sys = sys ? `${sys}\n\n${reasoningInstruction}` : reasoningInstruction;
    }

    for (const msg of messages) {
      if (msg.role === 'user') {
        const hasAttachments = msg.attachments && msg.attachments.length > 0;
        
        if (hasAttachments && model.supportsVision) {
          const contentParts: any[] = [];
          
          let textWithExtracted = msg.content;
          for (const att of msg.attachments || []) {
            if (att.extractedText) {
              textWithExtracted += `\n\n[附件: ${att.name}]\n${att.extractedText}`;
            }
          }
          if (textWithExtracted) {
            contentParts.push({ type: 'text', text: textWithExtracted });
          }

          // Images
          for (const att of msg.attachments || []) {
            if (att.type.startsWith('image/') && att.dataUrl) {
              // extract base64 from dataUrl
              const matches = att.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                contentParts.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: matches[1],
                    data: matches[2],
                  },
                });
              }
            }
          }

          formattedMessages.push({
            role: 'user',
            content: contentParts.length > 0 ? contentParts : [{ type: 'text', text: '你好' }],
          });
        } else {
          let text = msg.content;
          if (hasAttachments) {
            for (const att of msg.attachments || []) {
              if (att.extractedText) {
                text += `\n\n[附件文本: ${att.name}]\n${att.extractedText}`;
              }
            }
          }
          formattedMessages.push({ role: 'user', content: text });
        }
      } else if (msg.role === 'assistant') {
        formattedMessages.push({
          role: 'assistant',
          content: msg.content,
        });
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKeyConfig.apiKey?.trim() || '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      ...model.customHeaders,
    };

    const stream = (parameters?.stream !== undefined ? parameters.stream : model.supportsStreaming !== false) && callbacks != null;

    const effectiveMaxTokens = parameters?.maxTokens ?? maxTokens ?? 4096;
    const effectiveTemp = parameters?.temperature ?? temperature;
    const effectiveTopP = parameters?.topP ?? topP;

    const bodyPayload: any = {
      model: model.id,
      messages: formattedMessages,
      max_tokens: effectiveMaxTokens > 0 ? effectiveMaxTokens : 4096,
      stream,
    };

    if (sys.trim()) {
      bodyPayload.system = sys.trim();
    }
    if (typeof effectiveTemp === 'number') bodyPayload.temperature = effectiveTemp;
    if (typeof effectiveTopP === 'number') bodyPayload.top_p = effectiveTopP;
    if (parameters?.stop && parameters.stop.trim()) {
      bodyPayload.stop_sequences = [parameters.stop.trim()];
    }

    const controller = new AbortController();
    const timeout = (timeoutSeconds || 60) * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onUserAbort = () => controller.abort();
    if (abortSignal) abortSignal.addEventListener('abort', onUserAbort);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        if (abortSignal?.aborted) throw new Error('用户已手动停止生成');
        throw new Error(`Anthropic 请求超时 (${timeout / 1000}秒)`);
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
                if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
                  const chunk = parsed.delta.text || '';
                  if (chunk) {
                    fullContent += chunk;
                    callbacks?.onChunk(chunk);
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
    const content = resJson.content?.[0]?.text || '';
    callbacks?.onChunk?.(content);
    callbacks?.onFinish?.(content);
    return content;
  }

  async testConnection(apiKeyConfig: ApiKeyConfig, modelId = 'claude-3-5-haiku-20241022'): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = this.resolveEndpoint(apiKeyConfig);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKeyConfig.apiKey?.trim() || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
      });

      if (res.ok) {
        return { success: true, message: `Anthropic 连接成功！已接收来自 ${modelId} 的回执。` };
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
