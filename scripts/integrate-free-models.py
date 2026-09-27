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
'''

openrouter_models = r'''  // OpenRouter current free models
  {
    id: 'openrouter/free',
    name: 'OpenRouter Free Router',
    providerId: 'openrouter',
    description: 'OpenRouter 官方免费路由：自动选择当前可用的免费模型',
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
    description: 'OpenRouter 当前 $0 免费模型：NVIDIA Nemotron 3 Ultra',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1000000,
    temperature: 0.7,
  },
  {
    id: 'nvidia/nemotron-3.5-lightning:free',
    name: 'Nemotron 3.5 Lightning (OpenRouter Free)',
    providerId: 'openrouter',
    description: 'OpenRouter 当前 $0 免费模型：NVIDIA Nemotron 3.5 Lightning',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 1000000,
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
'''

changed = False

if "id: 'z-ai/glm-5-3'" not in text:
    if nvidia_marker not in text:
        raise SystemExit('NVIDIA insertion marker not found')
    text = text.replace(nvidia_marker, nvidia_models + nvidia_marker, 1)
    changed = True
else:
    # Add any later NVIDIA entries that were not present in the first integration pass.
    anchor = nvidia_marker
    additions = []
    if "id: 'nvidia/nemotron-3-super-120b-a12b'" not in text:
        additions.append(nvidia_models.split("  {\n    id: 'nvidia/nemotron-3.5-lightning-30b-a3b'")[1] if False else '''  {\n    id: 'nvidia/nemotron-3-super-120b-a12b',\n    name: 'Nemotron 3 Super 120B A12B (NVIDIA Free)',\n    providerId: 'nvidia',\n    description: 'NVIDIA Free Endpoint：Nemotron 3 Super，1M 上下文。',\n    supportsVision: false,\n    supportsFiles: false,\n    supportsStreaming: true,\n    contextWindow: 1048576,\n    temperature: 1,\n  },\n''')
    if "id: 'openai/gpt-oss-20b'" not in text:
        additions.append('''  {\n    id: 'openai/gpt-oss-20b',\n    name: 'GPT-OSS 20B (NVIDIA Free)',\n    providerId: 'nvidia',\n    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 20B。',\n    supportsVision: false,\n    supportsFiles: false,\n    supportsStreaming: true,\n    contextWindow: 131072,\n    temperature: 1,\n  },\n''')
    if "id: 'openai/gpt-oss-120b'" not in text:
        additions.append('''  {\n    id: 'openai/gpt-oss-120b',\n    name: 'GPT-OSS 120B (NVIDIA Free)',\n    providerId: 'nvidia',\n    description: 'NVIDIA Free Endpoint：OpenAI GPT-OSS 120B。',\n    supportsVision: false,\n    supportsFiles: false,\n    supportsStreaming: true,\n    contextWindow: 131072,\n    temperature: 1,\n  },\n''')
    if additions:
        text = text.replace(anchor, ''.join(additions) + anchor, 1)
        changed = True

if "id: 'openrouter/free'" not in text:
    if openrouter_marker not in text:
        raise SystemExit('OpenRouter insertion marker not found')
    text = text.replace(openrouter_marker, openrouter_models + openrouter_marker, 1)
    changed = True
else:
    additions = []
    if "id: 'nvidia/nemotron-3-super:free'" not in text:
        additions.append('''  {\n    id: 'nvidia/nemotron-3-super:free',\n    name: 'Nemotron 3 Super (OpenRouter Free)',\n    providerId: 'openrouter',\n    description: 'OpenRouter 当前 $0 免费模型：NVIDIA Nemotron 3 Super',\n    supportsVision: false,\n    supportsFiles: false,\n    supportsStreaming: true,\n    contextWindow: 262144,\n    temperature: 1,\n  },\n''')
    if additions:
        text = text.replace(openrouter_marker, ''.join(additions) + openrouter_marker, 1)
        changed = True

# Correct the OpenRouter Lightning slug if an earlier pass used the NVIDIA NIM slug.
text = text.replace(
    "nvidia/nemotron-3.5-lightning-30b-a3b:free",
    "nvidia/nemotron-3.5-lightning:free",
)

if changed:
    path.write_text(text, encoding='utf-8')
    print('Updated src/services/db.ts')
else:
    print('No changes needed; free models already present')
