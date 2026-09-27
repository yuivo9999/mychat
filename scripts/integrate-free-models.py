from pathlib import Path
import subprocess

path = Path('src/services/db.ts')
text = path.read_text(encoding='utf-8')

# The catalog migration previously damaged the tail of db.ts. Restore the
# complete stable database implementation from the known-good commit while
# preserving the current provider/model catalog above the implementation.
good_ref = '5fe90ad70f5d86f863f216e16dd18b1b336765fa'
good = subprocess.check_output(
    ['git', 'show', f'{good_ref}:src/services/db.ts'], text=True
)
marker = '// API Key Operations'
good_pos = good.find(marker)
current_pos = text.find(marker)
if good_pos == -1 or current_pos == -1:
    raise SystemExit('db.ts database implementation marker not found')
text = text[:current_pos] + good[good_pos:]

# Keep the current catalog's provider/model definitions, but ensure the
# built-in provider set is exactly the intended one.
def remove_provider(text: str, provider_id: str) -> str:
    import re
    pattern = r"\n  \{\n    id: '" + re.escape(provider_id) + r"',[\s\S]*?\n  \},"
    return re.sub(pattern, '', text, count=1)

for provider_id in ['moonshot', 'qwen', 'siliconflow']:
    # These are removed default groups.
    text = remove_provider(text, provider_id)

# Remove obsolete default-model blocks by providerId, but preserve any models
# from those vendors routed through OpenRouter/NVIDIA/Groq.
def remove_models_for_provider(text: str, provider_id: str) -> str:
    import re
    pattern = r"\n  \{\n    id: '[^']+',\n    name: '[^']*',\n    providerId: '" + re.escape(provider_id) + r"',[\s\S]*?\n  \},"
    return re.sub(pattern, '', text)

for provider_id in ['moonshot', 'qwen', 'siliconflow']:
    text = remove_models_for_provider(text, provider_id)

# Remove the old Groq entries and rebuild them with the stable IDs used by the
# current runtime. NVIDIA's identical GPT-OSS IDs are deliberately left alone
# in its own catalog; IndexedDB migration handles stale collisions by model id.
for model_id in [
    'groq/openai/gpt-oss-120b',
    'groq/openai/gpt-oss-20b',
    'groq/openai/gpt-oss-safeguard-20b',
    'groq/qwen/qwen3.8-27b',
]:
    import re
    text = re.sub(
        r"\n  \{\n    id: '" + re.escape(model_id) + r"',[\s\S]*?\n  \},",
        '', text, count=1
    )

# Normalize any legacy Groq naming.
text = text.replace("name: 'Groq (免费高速推理)'", "name: 'groq.com'")

nvidia_marker = "  // Google Gemini Models (免费层与最新前沿模型)"
openrouter_marker = "  // OpenAI"

groq_models = r'''  // Groq.com Free Plan models.
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (groq.com 免费)',
    providerId: 'groq',
    description: 'Groq.com 免费层 GPT-OSS 120B',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT-OSS 20B (groq.com 免费)',
    providerId: 'groq',
    description: 'Groq.com 免费层 GPT-OSS 20B',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'openai/gpt-oss-safeguard-20b',
    name: 'GPT-OSS Safeguard 20B (groq.com 免费)',
    providerId: 'groq',
    description: 'Groq.com 免费层 GPT-OSS Safeguard 20B',
    supportsVision: false,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
  {
    id: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B (groq.com 免费)',
    providerId: 'groq',
    description: 'Groq.com 免费层 Qwen 3.8 27B，多模态',
    supportsVision: true,
    supportsFiles: false,
    supportsStreaming: true,
    contextWindow: 131072,
    temperature: 0.7,
  },
'''

# Remove any current Groq model block and insert exactly one authoritative set.
text = remove_models_for_provider(text, 'groq')
if nvidia_marker not in text:
    raise SystemExit('NVIDIA/Gemini catalog marker not found')
text = text.replace(nvidia_marker, groq_models + nvidia_marker, 1)

# Keep the existing NVIDIA/OpenRouter free catalog integration logic below.
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
'''
if "id: 'z-ai/glm-5-3'" not in text:
    if nvidia_marker not in text:
        raise SystemExit('NVIDIA insertion marker not found')
    text = text.replace(nvidia_marker, nvidia_models + nvidia_marker, 1)

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
'''
if "id: 'openrouter/free'" not in text:
    if openrouter_marker not in text:
        raise SystemExit('OpenRouter insertion marker not found')
    text = text.replace(openrouter_marker, openrouter_models + openrouter_marker, 1)

path.write_text(text, encoding='utf-8')
print('Database implementation restored and Groq catalog normalized')
