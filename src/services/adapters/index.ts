import { BaseAdapter } from './base';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GeminiAdapter } from './gemini';

const openaiAdapter = new OpenAIAdapter();
const anthropicAdapter = new AnthropicAdapter();
const geminiAdapter = new GeminiAdapter();

export function getAdapterForProvider(providerId: string): BaseAdapter {
  switch (providerId) {
    case 'google':
    case 'gemini':
      return geminiAdapter;
    case 'anthropic':
      return anthropicAdapter;
    default:
      // OpenAI, DeepSeek, Moonshot, Qwen, Zhipu, SiliconFlow, OpenRouter, NVIDIA, Ollama, Custom
      return openaiAdapter;
  }
}

export * from './base';
export * from './openai';
export * from './anthropic';
export * from './gemini';
