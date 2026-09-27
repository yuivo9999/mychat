from pathlib import Path

path = Path('src/services/db.ts')
text = path.read_text(encoding='utf-8')

nvidia_marker = "  // Google Gemini Models (免费层与最新前沿模型)"
openrouter_marker = "  // OpenAI"

nvidia_models = r'''  // NVIDIA current Free Endpoints (verified against NVIDIA Build)
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
'''

openrouter_models = r'''  // OpenRouter current free models
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    providerId: 'openrouter',
    description: 'OpenRouter 免费路由：自动选择当前可用的免费模型',
    supportsVision: true,
    supportsFiles: true,
    supportsStreaming: true,
    contextWindow: 200000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    name: 'Nemotron 3 Ultra (OpenRouter Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：NVIDIA Nemotron 3 Ultra',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1000000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b:free',
    name: 'Nemotron 3.5 Lightning (OpenRouter Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 免费模型：NVIDIA Nemotron 3.5 Lightning',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
'''

changed = False
if "id: 'z-ai/glm-5-3'" not in text:
    if nvidia_marker not in text:
        raise SystemExit('NVIDIA insertion marker not found')
    text = text.replace(nvidia_marker, nvidia_models + nvidia_marker, 1)
    changed = True

if "id: 'openrouter/free'" not in text:
    if openrouter_marker not in text:
        raise SystemExit('OpenRouter insertion marker not found')
    text = text.replace(openrouter_marker, openrouter_models + openrouter_marker, 1)
    changed = True

if changed:
    path.write_text(text, encoding='utf-8')
    print('Updated src/services/db.ts')
else:
    print('No changes needed; free models already present')
