import { AdapterOptions, StreamCallbacks, executeFetch, parseHttpError } from './base';

export async function sendOpenAIResponses(options: AdapterOptions, callbacks?: StreamCallbacks): Promise<string> {
  const { model, apiKeyConfig, messages, systemPrompt, parameters, abortSignal, timeoutSeconds } = options;
  const base = (apiKeyConfig.baseUrl?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '').replace(/\/chat\/completions$/, '').replace(/\/responses$/, '');
  const endpoint = `${base}/responses`;
  const input: any[] = [];

  for (const msg of messages) {
    const parts: any[] = [];
    if (msg.content) parts.push({ type: 'input_text', text: msg.content });
    if (msg.role === 'user') {
      for (const att of msg.attachments || []) {
        if (att.type.startsWith('image/') && model.supportsVision && att.dataUrl) {
          parts.push({ type: 'input_image', image_url: att.dataUrl });
        } else if (!att.type.startsWith('image/') && att.base64Data) {
          parts.push({
            type: 'input_file',
            filename: att.name,
            file_data: `data:${att.type || 'application/octet-stream'};base64,${att.base64Data}`,
          });
        }
      }
    }
    if (parts.length) input.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: parts });
  }

  const body: any = {
    model: model.id,
    input,
    stream: callbacks != null && (parameters?.stream !== false),
  };
  const sys = systemPrompt || model.systemPrompt;
  if (sys?.trim()) body.instructions = sys.trim();
  if (typeof parameters?.maxTokens === 'number' && parameters.maxTokens > 0) body.max_output_tokens = parameters.maxTokens;

  const key = apiKeyConfig.apiKey?.trim().replace(/^Bearer\s+/i, '') || '';
  const controller = new AbortController();
  const timeout = (timeoutSeconds || 60) * 1000;
  const timer = setTimeout(() => controller.abort(), timeout);
  if (abortSignal) abortSignal.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = await executeFetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...model.customHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let data: any = null;
    try { data = await response.json(); } catch { data = await response.text(); }
    throw new Error(parseHttpError(response.status, data, response.statusText));
  }

  if (body.stream && response.body) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim().startsWith('data:')) continue;
        const raw = line.trim().slice(5).trim();
        if (raw === '[DONE]') continue;
        try {
          const event = JSON.parse(raw);
          if (event.type === 'response.output_text.delta' && event.delta) {
            full += event.delta;
            callbacks?.onChunk(event.delta);
          }
        } catch {}
      }
    }
    callbacks?.onFinish?.(full);
    return full;
  }

  const data = await response.json();
  const full = Array.isArray(data.output)
    ? data.output.flatMap((x: any) => x.content || []).map((x: any) => x.text || '').join('')
    : '';
  callbacks?.onChunk?.(full);
  callbacks?.onFinish?.(full);
  return full;
}
