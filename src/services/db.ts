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
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Claude 3.5 Haiku 高度拟人与编码模型',
    icon: 'Cpu',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
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
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'NVIDIA 云端优化的企业级高性能推理 API',
    icon: 'Terminal',
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
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
  // Google Gemini
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    providerId: 'google',
    description: '快速、智能的多模态体验与思维链推理能力',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 1048576,
    temperature: 0.7,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    providerId: 'google',
    description: '超长百万上下文窗口与复杂逻辑分析',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 2097152,
    temperature: 0.7,
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
  defaultProviderId: 'google',
  defaultModelId: 'gemini-2.5-flash',
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

// API Key Operations
export async function getApiKeys(): Promise<ApiKeyConfig[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('api_keys', 'readonly');
    const store = transaction.objectStore('api_keys');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
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
    const transaction = db.transaction('models', 'readonly');
    const store = transaction.objectStore('models');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      if (results.length === 0) {
        // Seed default models
        seedDefaultModels().then(() => resolve(DEFAULT_MODELS));
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function seedDefaultModels(): Promise<void> {
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
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('providers', 'readonly');
    const store = transaction.objectStore('providers');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result || [];
      if (results.length === 0) {
        seedDefaultProviders().then(() => resolve(DEFAULT_PROVIDERS));
      } else {
        resolve(results);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function seedDefaultProviders(): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction('providers', 'readwrite');
  const store = transaction.objectStore('providers');
  for (const p of DEFAULT_PROVIDERS) {
    store.put(p);
  }
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
