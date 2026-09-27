import { 
  Conversation, 
  ApiKeyConfig, 
  ModelItem, 
  ProviderDefinition, 
  UserSettings 
} from '../types';

const DB_NAME = 'OmniChatLocalDB';
const DB_VERSION = 2;

export const DEFAULT_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'nvidia',
    name: 'NVIDIA NIM API',
    description: 'NVIDIA 云端高性能模型接入 (如 deepseek-ai/deepseek-v4.1-flash 等)',
    icon: 'Terminal',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    enabled: true,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Flash, Gemini 1.5 Pro 高性价比多模态模型',
    icon: 'Sparkles',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    enabled: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, o1, o3-mini 系列强大通用模型',
    icon: 'Bot',
    defaultBaseUrl: 'https://api.openai.com/v1',
    enabled: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek (深度求索)',
    description: 'DeepSeek-V3, DeepSeek-R1 满血版极致推理与代码模型',
    icon: 'Zap',
    defaultBaseUrl: 'https://api.deepseek.com',
    enabled: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3.5 Haiku 高度拟人与编码模型',
    icon: 'Cpu',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    enabled: true,
  },
  {
    id: 'moonshot',
    name: 'Moonshot (月之暗面 Kimi)',
    description: 'Moonshot v1 长文本与文件深度理解',
    icon: 'Moon',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    enabled: true,
  },
  {
    id: 'qwen',
    name: 'Qwen (阿里通义千问)',
    description: 'Qwen-2.5 72B / Max / Plus 系列多模态通用模型',
    icon: 'Layers',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    enabled: true,
  },
  {
    id: 'zhipu',
    name: 'Zhipu (智谱 GLM)',
    description: 'GLM-4-Plus, GLM-4-Flash 清华系高智力大模型',
    icon: 'Feather',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    enabled: true,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow (硅基流动)',
    description: '聚合 DeepSeek-R1, Qwen2.5, Flux 等高速低成本推理',
    icon: 'Activity',
    defaultBaseUrl: 'https://api.siliconflow.cn/v1',
    enabled: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: '一站式访问全球数百个前沿与开源模型',
    icon: 'Globe',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    enabled: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (本地私有大模型)',
    description: '无需联网，在本地电脑运行 Llama 3, DeepSeek, Qwen',
    icon: 'HardDrive',
    defaultBaseUrl: 'http://localhost:11434',
    enabled: true,
  },
  {
    id: 'custom',
    name: '自定义 API (OpenAI 兼容)',
    description: '支持任何遵循 OpenAI 格式的第三方或内网网关',
    icon: 'Sliders',
    defaultBaseUrl: '',
    isCustom: true,
    enabled: true,
  },
];

export const DEFAULT_MODELS: ModelItem[] = [
  // NVIDIA NIM Models (默认首个核心分组)
  {
    id: 'deepseek-ai/deepseek-v4.1-flash',
    name: 'deepseek-ai/deepseek-v4.1-flash (NVIDIA)',
    providerId: 'nvidia',
    description: 'NVIDIA NIM 极速高性能 DeepSeek V4.1 Flash 模型',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
    topP: 0.95,
  },
  {
    id: 'deepseek-ai/deepseek-r1',
    name: 'deepseek-ai/deepseek-r1 (NVIDIA)',
    providerId: 'nvidia',
    description: 'NVIDIA NIM 满血版 671B 思维链推理大模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.6,
  },
  {
    id: 'meta/llama-3.3-70b-instruct',
    name: 'meta/llama-3.3-70b-instruct (NVIDIA)',
    providerId: 'nvidia',
    description: 'NVIDIA NIM Meta Llama 3.3 70B 旗舰指令模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'nvidia/llama-3.1-nemotron-70b-instruct',
    name: 'nvidia/llama-3.1-nemotron-70b-instruct',
    providerId: 'nvidia',
    description: 'NVIDIA 官方 Nemotron 70B 高智力推理对齐模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    name: 'meta/llama-3.1-405b-instruct (NVIDIA)',
    providerId: 'nvidia',
    description: 'NVIDIA NIM 405B 超大规模前沿开源巨型模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'qwen/qwen2.5-72b-instruct',
    name: 'qwen/qwen2.5-72b-instruct (NVIDIA)',
    providerId: 'nvidia',
    description: 'NVIDIA NIM 通义千问 2.5 72B 强大全能模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },

  // NVIDIA current Free Endpoints (verified against NVIDIA Build)
  {
    id: 'z-ai/glm-5.3',
    name: 'GLM 5.3 (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Z.ai GLM 5.3',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 202752,
    temperature: 0.7,
  },
  {
    id: 'z-ai/glm-5.3-flash',
    name: 'GLM 5.3 Flash (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Z.ai GLM 5.3 Flash，多模态',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 202752,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Nemotron 3.5 Lightning 30B A3B',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B A12B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Nemotron 3 Super，1M 上下文。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 1,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 20B。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 1,
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 120B。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 1,
  },
  // NVIDIA current Free Endpoints (verified against NVIDIA Build)
  {
    id: 'z-ai/glm-5-3',
    name: 'GLM 5.3 (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Z.ai GLM 5.3',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 202752,
    temperature: 0.7,
  },
  {
    id: 'z-ai/glm-5-3-flash',
    name: 'GLM 5.3 Flash (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Z.ai GLM 5.3 Flash，多模态',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 202752,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    name: 'Nemotron 3.5 Lightning 30B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Nemotron 3.5 Lightning 30B A3B',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b',
    name: 'Nemotron 3 Super 120B A12B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：Nemotron 3 Super，1M 上下文。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 1,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 20B。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 1,
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (NVIDIA Free)',
    providerId: 'nvidia',
    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 120B。',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 1,
  },
  // Google Gemini Models (免费层与最新前沿模型)
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    providerId: 'google',
    description: '谷歌最新一代前沿多模态大模型，具备极高智力与极速响应，官方支持免费层调用',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Latest)',
    providerId: 'google',
    description: '官方 Flash 最新稳定版本，多模态综合能力均衡，免费配额最高',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash-Lite',
    providerId: 'google',
    description: '轻量化极低延迟模型，响应迅猛，特别适合日常连通性测试与快速问答',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    providerId: 'google',
    description: '具备思维链深度推理能力的敏捷多模态模型，支持免费层使用',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    providerId: 'google',
    description: '稳定高效的 3.6 代模型，免费层支持良好',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (自动升级 3.8)',
    providerId: 'google',
    description: '经典 1.5 Flash 代号，系统在后端自动平滑兼容至官方最新 3.8 Flash 引擎执行',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (自动升级 3.8)',
    providerId: 'google',
    description: '经典 1.5 Pro 代号，系统在后端自动平滑兼容至官方最新引擎执行',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash (自动升级 3.8)',
    providerId: 'google',
    description: '经典 2.5 Flash 代号，系统在后端自动平滑兼容至官方最新 3.8 Flash 引擎执行',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },

  // OpenRouter fixed free-model roster.
  // Deliberately hard-coded: the app must not depend on the Settings-page
  // auto-refresh/live catalog to expose the free models.
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：OpenRouter Free Router',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 200000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron 3 Ultra (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1000000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron 3.5 Lightning (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-super-120b-a12b:free',
    name: 'Nemotron 3 Super 120B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron 3 Super 120B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1000000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-nano-30b-a3b:free',
    name: 'Nemotron 3 Nano 30B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron 3 Nano 30B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 256000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'Nemotron 3 Nano Omni (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron 3 Nano Omni (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 256000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-nano-12b-v2-vl:free',
    name: 'Nemotron Nano 12B 2 VL (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron Nano 12B 2 VL (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 128000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-nano-9b-v2:free',
    name: 'Nemotron Nano 9B V2 (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Nemotron Nano 9B V2 (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 128000,
    temperature: 0.7,
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：GPT-OSS 120B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：GPT-OSS 20B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder 480B A35B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Qwen3 Coder 480B A35B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    name: 'Qwen3 Next 80B A3B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Qwen3 Next 80B A3B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 0.7,
  },
  {
    id: 'google/gemma-4-26b-a4b-it:free',
    name: 'Gemma 4 26B A4B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Gemma 4 26B A4B (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 0.7,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Gemma 4 31B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 0.7,
  },
  {
    id: 'google/gemma-3-27b-it:free',
    name: 'Gemma 3 27B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Gemma 3 27B (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'google/gemma-3-12b-it:free',
    name: 'Gemma 3 12B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Gemma 3 12B (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Llama 3.3 70B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Llama 3.2 3B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'mistralai/mistral-small-3.1-24b-instruct:free',
    name: 'Mistral Small 3.1 24B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Mistral Small 3.1 24B (Free)',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'nousresearch/hermes-3-llama-3.1-405b:free',
    name: 'Hermes 3 405B (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Hermes 3 405B (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'poolside/laguna-m.1:free',
    name: 'Laguna M.1 (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Laguna M.1 (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 0.7,
  },
  {
    id: 'poolside/laguna-xs.2:free',
    name: 'Laguna XS.2 (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Laguna XS.2 (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 0.7,
  },
  {
    id: 'z-ai/glm-4.5-air:free',
    name: 'GLM 4.5 Air (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：GLM 4.5 Air (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    name: 'Venice Uncensored (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：Venice Uncensored (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 32768,
    temperature: 0.7,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-instruct:free',
    name: 'LFM2.5 1.2B Instruct (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：LFM2.5 1.2B Instruct (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 32768,
    temperature: 0.7,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-thinking:free',
    name: 'LFM2.5 1.2B Thinking (Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：LFM2.5 1.2B Thinking (Free)',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 32768,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-super:free',
    name: 'Nemotron 3 Super (OpenRouter Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 当前 $0 免费模型：NVIDIA Nemotron 3 Super',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 262144,
    temperature: 1,
  },
  // OpenAI
  {
    id: 'gpt-4o',
    name: 'GPT-4o (Omni)',
    providerId: 'openai',
    description: 'OpenAI 旗舰全模态模型，支持视觉分析与深度逻辑',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 128000,
    temperature: 0.7,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    providerId: 'openai',
    description: '小巧敏捷，日常对话与代码辅助性价比首选',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 128000,
    temperature: 0.7,
  },
  {
    id: 'o3-mini',
    name: 'o3-mini (Reasoning)',
    providerId: 'openai',
    description: '高智力深度数学、科学与复杂编程推理模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 128000,
  },

  // Anthropic
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    providerId: 'anthropic',
    description: '行业顶级代码编写、复杂推理与文风表达',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 200000,
    temperature: 0.7,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    providerId: 'anthropic',
    description: '极速响应的高性价比模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 200000,
    temperature: 0.7,
  },

  // DeepSeek
  {
    id: 'deepseek-chat',
    name: 'DeepSeek-V3',
    providerId: 'deepseek',
    description: 'DeepSeek 671B 强大通用对话模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 64000,
    temperature: 0.7,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek-R1 (推理思考)',
    providerId: 'deepseek',
    description: '满血版思维链强化学习推理大模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 64000,
    temperature: 0.6,
  },

  // Moonshot
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot v1 32K',
    providerId: 'moonshot',
    description: 'Kimi 长文本理解与资料摘要',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 32768,
    temperature: 0.7,
  },

  // Qwen
  {
    id: 'qwen-max',
    name: 'Qwen Max (通义千问旗舰)',
    providerId: 'qwen',
    description: '阿里巴巴千亿级旗舰模型，全面能力出众',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 32768,
    temperature: 0.7,
  },
  {
    id: 'qwen-plus',
    name: 'Qwen Plus',
    providerId: 'qwen',
    description: '平衡性能与成本的高阶通用模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },

  // SiliconFlow
  {
    id: 'deepseek-ai/DeepSeek-R1',
    name: 'SiliconFlow DeepSeek-R1',
    providerId: 'siliconflow',
    description: '高速满血 DeepSeek-R1 推理集群',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 64000,
    temperature: 0.6,
  },
  {
    id: 'deepseek-ai/DeepSeek-V3',
    name: 'SiliconFlow DeepSeek-V3',
    providerId: 'siliconflow',
    description: '高速满血 DeepSeek-V3 对话集群',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 64000,
    temperature: 0.7,
  },

  // OpenRouter
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'OpenRouter / Claude 3.5 Sonnet',
    providerId: 'openrouter',
    description: '通过 OpenRouter 路由访问 Claude',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 200000,
    temperature: 0.7,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'OpenRouter / Llama 3.3 70B',
    providerId: 'openrouter',
    description: '开源大模型顶峰体验',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },

  // Ollama
  {
    id: 'llama3.2:latest',
    name: 'Ollama / Llama 3.2',
    providerId: 'ollama',
    description: '本地运行的 Meta Llama 3.2 轻量模型',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 8192,
    temperature: 0.7,
  },
  {
    id: 'deepseek-r1:latest',
    name: 'Ollama / DeepSeek R1',
    providerId: 'ollama',
    description: '本地量化部署的 DeepSeek 推理模型',
    supportsVision: false,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 8192,
    temperature: 0.7,
  }
];

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  fontSize: 'standard',
  enterToSend: true,
  autoScroll: true,
  showTimestamps: true,
  showModelName: true,
  enableStreaming: true,
  enableMarkdown: true,
  enableCodeHighlight: true,
  defaultProviderId: 'nvidia',
  defaultModelId: 'deepseek-ai/deepseek-v4.1-flash',
  defaultSystemPrompt: '你是一个知识渊博、表达严谨、思维敏捷的专业 AI 助手。请用清晰、结构化并得体的语言回答用户的问题。在提供代码时，请提供完整可执行的高质量代码，并附有必要解释。',
  requestTimeout: 60,
  sidebarOpen: true,
};

// Open IndexedDB instance
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('conversations')) {
        const store = db.createObjectStore('conversations', { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('isFavorite', 'isFavorite', { unique: false });
      }

      if (!db.objectStoreNames.contains('api_keys')) {
        const store = db.createObjectStore('api_keys', { keyPath: 'id' });
        store.createIndex('providerId', 'providerId', { unique: false });
      }

      if (!db.objectStoreNames.contains('models')) {
        const store = db.createObjectStore('models', { keyPath: 'id' });
        store.createIndex('providerId', 'providerId', { unique: false });
      }

      if (!db.objectStoreNames.contains('providers')) {
        db.createObjectStore('providers', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Conversation Operations
export async function getConversations(): Promise<Conversation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readonly');
    const store = transaction.objectStore('conversations');
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as Conversation[]) || [];
      // Sort by updatedAt descending
      list.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readonly');
    const store = transaction.objectStore('conversations');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readwrite');
    const store = transaction.objectStore('conversations');
    const request = store.put(conversation);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readwrite');
    const store = transaction.objectStore('conversations');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllConversations(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('conversations', 'readwrite');
    const store = transaction.objectStore('conversations');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export const DEFAULT_API_KEYS: ApiKeyConfig[] = [
  {
    id: 'key_google_default_ready',
    providerId: 'google',
    label: 'Google Gemini (内置快速测试 Key)',
    apiKey: 'AIzaSy_Google_Gemini_Fast_Testing_Key',
    baseUrl: 'https://generativelanguage.googleapis.com',
    createdAt: Date.now(),
    isDefault: true,
  },
];

// API Key Operations
export async function getApiKeys(): Promise<ApiKeyConfig[]> {
  const db = await openDB();
  const isInitialized = localStorage.getItem('omnichat_keys_initialized') === 'true';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('api_keys', 'readwrite');
    const store = transaction.objectStore('api_keys');
    const request = store.getAll();

    request.onsuccess = async () => {
      const results = (request.result as ApiKeyConfig[]) || [];
      if (!isInitialized && results.length === 0) {
        localStorage.setItem('omnichat_keys_initialized', 'true');
        for (const k of DEFAULT_API_KEYS) {
          store.put(k);
        }
        resolve(DEFAULT_API_KEYS);
        return;
      }
      // If Google group has no key but user hasn't explicitly cleared all keys
      const hasGoogleKey = results.some(k => k.providerId === 'google');
      if (!hasGoogleKey && !isInitialized) {
        for (const k of DEFAULT_API_KEYS) {
          store.put(k);
          results.push(k);
        }
      }
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveApiKey(keyConfig: ApiKeyConfig): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('api_keys', 'readwrite');
    const store = transaction.objectStore('api_keys');
    const request = store.put(keyConfig);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteApiKey(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('api_keys', 'readwrite');
    const store = transaction.objectStore('api_keys');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllApiKeys(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('api_keys', 'readwrite');
    const store = transaction.objectStore('api_keys');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Models Operations
export async function getModels(): Promise<ModelItem[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('models', 'readwrite');
    const store = transaction.objectStore('models');
    const request = store.getAll();

    request.onsuccess = async () => {
      let results = (request.result as ModelItem[]) || [];
      if (results.length === 0) {
        for (const m of DEFAULT_MODELS) store.put(m);
        results = [...DEFAULT_MODELS];
      }

      // Remove the obsolete OpenRouter free slug shipped by older builds.
      const staleOpenRouterIds = ['nvidia/nemotron-3-super:free'];
      for (const staleId of staleOpenRouterIds) {
        if (results.some(r => r.id === staleId)) {
          store.delete(staleId);
          results = results.filter(r => r.id !== staleId);
        }
      }

      // Ensure the fixed built-in model roster is present and keep user custom models.
      const updatedResults = results.map(r => {
        const defaultDef = DEFAULT_MODELS.find(dm => dm.id === r.id);
        if (defaultDef && r.name !== defaultDef.name && !r.isCustom) {
          const updated = { ...r, name: defaultDef.name, description: defaultDef.description };
          store.put(updated);
          return updated;
        }
        return r;
      });

      const missingDefaults = DEFAULT_MODELS.filter(dm => !updatedResults.some(r => r.id === dm.id));
      if (missingDefaults.length > 0) {
        for (const m of missingDefaults) {
          store.put(m);
        }
      }

      resolve(withDefaults);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function seedDefaultModels(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('models', 'readwrite');
  const store = transaction.objectStore('models');
  for (const m of DEFAULT_MODELS) {
    store.put(m);
  }
}

export async function saveModel(model: ModelItem): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('models', 'readwrite');
    const store = transaction.objectStore('models');
    const request = store.put(model);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteModel(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('models', 'readwrite');
    const store = transaction.objectStore('models');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Providers Operations
export async function getProviders(): Promise<ProviderDefinition[]> {
  const db = await openDB();
  const isInitialized = localStorage.getItem('omnichat_db_initialized') === 'true';

  return new Promise((resolve, reject) => {
    const transaction = db.transaction('providers', 'readonly');
    const store = transaction.objectStore('providers');
    const request = store.getAll();

    request.onsuccess = async () => {
      const results = (request.result as ProviderDefinition[]) || [];
      if (!isInitialized && results.length === 0) {
        localStorage.setItem('omnichat_db_initialized', 'true');
        await seedDefaultProviders();
        await seedDefaultModels();
        resolve(DEFAULT_PROVIDERS);
        return;
      }

      // Keep NVIDIA as first provider order
      const providerOrder = DEFAULT_PROVIDERS.map(p => p.id);
      results.sort((a, b) => {
        const idxA = providerOrder.indexOf(a.id);
        const idxB = providerOrder.indexOf(b.id);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function seedDefaultProviders(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('providers', 'readwrite');
  const store = transaction.objectStore('providers');
  for (const p of DEFAULT_PROVIDERS) {
    store.put(p);
  }
}

export async function restoreDefaultProviders(): Promise<ProviderDefinition[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['providers', 'models', 'api_keys'], 'readwrite');
    const provStore = transaction.objectStore('providers');
    const modelStore = transaction.objectStore('models');
    const keyStore = transaction.objectStore('api_keys');
    
    for (const p of DEFAULT_PROVIDERS) {
      provStore.put(p);
    }
    for (const m of DEFAULT_MODELS) {
      modelStore.put(m);
    }
    for (const k of DEFAULT_API_KEYS) {
      keyStore.put(k);
    }

    transaction.oncomplete = () => {
      resolve(DEFAULT_PROVIDERS);
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveProvider(provider: ProviderDefinition): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('providers', 'readwrite');
    const store = transaction.objectStore('providers');
    const request = store.put(provider);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteProvider(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('providers', 'readwrite');
    const store = transaction.objectStore('providers');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Settings Operations
export async function getUserSettings(): Promise<UserSettings> {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction('settings', 'readonly');
    const store = transaction.objectStore('settings');
    const request = store.get('user_settings');

    request.onsuccess = () => {
      resolve({ ...DEFAULT_SETTINGS, ...(request.result || {}) });
    };
    request.onerror = () => resolve(DEFAULT_SETTINGS);
  });
}

export async function saveUserSettings(settings: UserSettings): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('settings', 'readwrite');
    const store = transaction.objectStore('settings');
    const request = store.put(settings, 'user_settings');

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Full Reset
export async function resetAllData(): Promise<void> {
  await clearAllConversations();
  await clearAllApiKeys();
  const db = await openDB();
  const tx = db.transaction(['models', 'providers', 'settings'], 'readwrite');
  tx.objectStore('models').clear();
  tx.objectStore('providers').clear();
  tx.objectStore('settings').clear();
  await new Promise<void>((res) => {
    tx.oncomplete = () => res();
  });
  await seedDefaultProviders();
  await seedDefaultModels();
  await saveUserSettings(DEFAULT_SETTINGS);
}
