import { BaseAdapter, AdapterOptions, StreamCallbacks, parseHttpError } from './base';
import { ApiKeyConfig } from '../../types';

export class OpenAIAdapter implements BaseAdapter {
  private getDefaultBaseUrl(providerId: string): string {
    switch (providerId) {
      case 'deepseek':
        return 'https://api.deepseek.com';
      case 'moonshot':
        return 'https://api.moonshot.cn/v1';
      case 'qwen':
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      case 'zhipu':
        return 'https://open.bigmodel.cn/api/paas/v4';
      case 'siliconflow':
        return 'https://api.siliconflow.cn/v1';
      case 'openrouter':
        return 'https://openrouter.ai/api/v1';
      case 'nvidia':
        return 'https://integrate.api.nvidia.com/v1';
      case 'ollama':
        return 'http://localhost:11434/v1';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  private resolveEndpoint(apiKeyConfig: ApiKeyConfig): string {
    let base = (apiKeyConfig.baseUrl?.trim() || this.getDefaultBaseUrl(apiKeyConfig.providerId)).replace(/\/+$/, '');
    if (!base.endsWith('/chat/completions')) {
      if (base.endsWith('/v1')) {
        base += '/chat/completions';
      } else {
        base += '/chat/completions';
      }
    }
    return base;
  }

  async sendMessage(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string> {
    const { model, apiKeyConfig, messages, systemPrompt, temperature, maxTokens, topP, parameters, abortSignal, timeoutSeconds } = options;
    const endpoint = this.resolveEndpoint(apiKeyConfig);

    const formattedMessages: any[] = [];

    // System message
    let sys = systemPrompt || model.systemPrompt;
    if (parameters?.enableReasoning) {
      const reasoningInstruction = '【深度推理模式开启】请在最终回答前，进行严密、深刻且步骤详尽的逻辑推导与思考分析。';
      sys = sys ? `${sys}\n\n${reasoningInstruction}` : reasoningInstruction;
    }
    if (sys && sys.trim()) {
      formattedMessages.push({
        role: 'system',
        content: sys.trim(),
      });
    }

    // Convert messages
    for (const msg of messages) {
      if (msg.role === 'user') {
        const hasAttachments = msg.attachments && msg.attachments.length > 0;
        
        if (hasAttachments && model.supportsVision) {
          const contents: any[] = [];
          
          // Add text first
          let textWithExtracted = msg.content;
          for (const att of msg.attachments || []) {
            if (att.extractedText) {
              textWithExtracted += `\n\n[附件: ${att.name}]\n${att.extractedText}`;
            }
          }
          contents.push({ type: 'text', text: textWithExtracted || '请分析以下内容' });

          // Add image attachments
          for (const att of msg.attachments || []) {
            if (att.type.startsWith('image/') && att.dataUrl) {
              contents.push({
                type: 'image_url',
                image_url: {
                  url: att.dataUrl,
                  detail: 'auto',
                },
              });
            }
          }
          formattedMessages.push({ role: 'user', content: contents });
        } else {
          let text = msg.content;
          if (hasAttachments) {
            for (const att of msg.attachments || []) {
              if (att.extractedText) {
                text += `\n\n[附件文本: ${att.name}]\n${att.extractedText}`;
              } else if (att.type.startsWith('image/')) {
                text += `\n\n[图片附件: ${att.name}]`;
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
      ...model.customHeaders,
    };

    if (apiKeyConfig.apiKey) {
      headers['Authorization'] = `Bearer ${apiKeyConfig.apiKey.trim()}`;
    }

    // Special provider headers
    if (apiKeyConfig.providerId === 'openrouter') {
      headers['HTTP-Referer'] = window.location.origin;
      headers['X-Title'] = 'OmniChat Local AI';
    }

    const stream = (parameters?.stream !== undefined ? parameters.stream : model.supportsStreaming !== false) && callbacks != null;

    const bodyPayload: any = {
      model: model.id,
      messages: formattedMessages,
      stream,
    };

    const effectiveTemp = parameters?.temperature ?? temperature ?? model.temperature;
    const effectiveMaxTokens = parameters?.maxTokens ?? maxTokens ?? model.maxTokens;
    const effectiveTopP = parameters?.topP ?? topP ?? model.topP;

    if (typeof effectiveTemp === 'number') bodyPayload.temperature = effectiveTemp;
    if (typeof effectiveMaxTokens === 'number' && effectiveMaxTokens > 0) bodyPayload.max_tokens = effectiveMaxTokens;
    if (typeof effectiveTopP === 'number') bodyPayload.top_p = effectiveTopP;

    if (typeof parameters?.frequencyPenalty === 'number' && parameters.frequencyPenalty !== 0) {
      bodyPayload.frequency_penalty = parameters.frequencyPenalty;
    }
    if (typeof parameters?.presencePenalty === 'number' && parameters.presencePenalty !== 0) {
      bodyPayload.presence_penalty = parameters.presencePenalty;
    }
    if (parameters?.stop && parameters.stop.trim()) {
      bodyPayload.stop = [parameters.stop.trim()];
    }
    if (typeof parameters?.seed === 'number' && !isNaN(parameters.seed)) {
      bodyPayload.seed = parameters.seed;
    }
    if (parameters?.enableReasoning) {
      bodyPayload.reasoning_effort = 'medium';
    }

    // Timeout controller
    const controller = new AbortController();
    const timeout = (timeoutSeconds || 60) * 1000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const onUserAbort = () => controller.abort();
    if (abortSignal) {
      abortSignal.addEventListener('abort', onUserAbort);
    }

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
        if (abortSignal?.aborted) {
          throw new Error('用户已手动停止生成');
        }
        throw new Error(`请求超时 (${timeout / 1000}秒)，请检查网络连接或在高级设置中增加超时时间`);
      }
      if (err.message && err.message.includes('Failed to fetch')) {
        throw new Error(`网络请求失败 / CORS 跨域拦截: 浏览器直接向 ${endpoint} 发起请求受限。如果为内网或代理服务，请确认该端点已开启 CORS (Access-Control-Allow-Origin: *)。`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
      if (abortSignal) {
        abortSignal.removeEventListener('abort', onUserAbort);
      }
    }

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        try {
          errorData = await response.text();
        } catch {}
      }
      throw new Error(parseHttpError(response.status, errorData, response.statusText));
    }

    // Handle Streaming Response
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
            if (!trimmed || trimmed.startsWith(':')) continue; // comment or empty
            if (trimmed === 'data: [DONE]') {
              continue;
            }
            if (trimmed.startsWith('data:')) {
              const jsonStr = trimmed.slice(5).trim();
              try {
                const parsed = JSON.parse(jsonStr);
                const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || '';
                if (delta) {
                  fullContent += delta;
                  callbacks?.onChunk(delta);
                }
              } catch {
                // partial json chunk, ignore
              }
            }
          }
        }

        // flush remaining buffer
        if (buffer.trim().startsWith('data:')) {
          const jsonStr = buffer.trim().slice(5).trim();
          if (jsonStr && jsonStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content || '';
              if (delta) {
                fullContent += delta;
                callbacks?.onChunk(delta);
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

    // Non-streaming fallback
    const resJson = await response.json();
    const content = resJson.choices?.[0]?.message?.content || '';
    callbacks?.onChunk?.(content);
    callbacks?.onFinish?.(content);
    return content;
  }

  async testConnection(apiKeyConfig: ApiKeyConfig, modelId = 'gpt-4o-mini'): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = this.resolveEndpoint(apiKeyConfig);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKeyConfig.apiKey) {
        headers['Authorization'] = `Bearer ${apiKeyConfig.apiKey.trim()}`;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'Ping' }],
          max_tokens: 5,
        }),
      });

      if (res.ok) {
        return { success: true, message: `连接成功！已顺利收到 ${modelId} 的应答。` };
      }

      let errorData: any = null;
      try {
        errorData = await res.json();
      } catch {
        errorData = await res.text();
      }
      return { success: false, message: parseHttpError(res.status, errorData, res.statusText) };
    } catch (err: any) {
      return {
        success: false,
        message: err.message || '网络连接失败，请检查 Base URL 与网络跨域设置',
      };
    }
  }
}
