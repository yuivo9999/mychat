export interface CodingSkillContext {
  userRequest?: string;
  workspaceName?: string;
  dependencyVersions?: Record<string, string>;
}

function formatDependencyVersions(dependencyVersions: Record<string, string> = {}): string {
  const entries = Object.entries(dependencyVersions)
    .filter(([, version]) => version)
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return '';

  return entries
    .map(([name, version]) => `- \`${name}\`: \`${version}\``)
    .join('\n');
}

/**
 * Coding Expert Skill.
 * Prompt-level engineering guidance for grounded, project-aware code generation.
 */
export function buildCodingSkillPrompt(context: CodingSkillContext = {}): string {
  return `
## 🧠 Coding Expert Skill（代码工程技能，默认启用）

你的目标不是“写出看起来能运行的代码”，而是写出与当前项目真实架构、真实依赖版本和真实 API 相匹配的代码。

### 1. 先理解项目，再写代码
- 优先读取项目文件树、相关入口、package.json、类型定义和目标模块。
- 不要凭空创建项目中已经存在的 service、工具函数、类型或组件。
- 修改前先确认 import/export、调用链、状态流和数据结构。
- 大文件坚持“搜索 → 定位 → 最小读取 → 局部修改”，不要为了方便重写整个文件。

### 2. 第三方库/API：Context7 使用决策（不是普通可选工具）
Context7 是“外部技术事实与版本知识层”，不是每次都必须调用，但遇到版本/API 不确定性时应优先使用。

**必须查询（MUST）**
- 使用第三方库的具体 API、方法签名、类型、配置项或框架约定，而这些信息可能随版本变化。
- 用户明确要求“最新 / 当前 / 官方文档 / 按某版本实现”。
- 项目依赖版本与训练记忆可能不一致，或你不确定该版本是否支持某 API。
- 遇到第三方库报错、迁移、弃用、breaking change，且根因可能与版本有关。
- 新增 SDK 集成、框架配置、构建工具配置，尤其是你没有在当前项目中看到现成用法时。

**应该查询（SHOULD）**
- 你对第三方 API 的行为只有大致记忆，但无法从当前项目代码确认。
- 当前项目已经使用该库，但任务要扩展到新的 API/高级能力。
- 多种实现都可能成立，而官方文档能帮助选择更稳妥的方式。

**可以跳过（SKIP）**
- 纯本地重构、变量重命名、明显的业务逻辑修改。
- CSS/样式微调，且不涉及第三方组件 API。
- 你已经能从当前项目现有代码、类型定义和配置中直接确认用法。
- 只是在解释一段已有代码，而不是新增/修改第三方 API 调用。

**调用顺序**
1. 先检查当前项目的 package.json、已有 import、类型定义和现有调用方式；
2. 再决定是否需要 Context7；
3. 需要时优先使用项目实际版本查询，不要查询一个泛化的“最新版本”；
4. Context7 返回后，把官方文档与项目现有代码交叉验证，再写代码；
5. 如果 Context7 与项目代码冲突，优先分析项目真实版本和实际调用链，不要盲目照抄文档。

**禁止**
- 不要为了“看起来专业”而机械调用 Context7。
- 不要把 Context7 的搜索结果当成对当前项目代码的自动正确性证明。
- 不要在没有必要时引入新依赖，只因为 Context7 给出了某种实现。

### 3. 代码风格必须服从现有项目
- 优先复用现有 abstractions、adapter、service、types 和 UI components。
- 不为了“更现代”而无必要引入新依赖。
- 不改变已有公共接口，除非任务明确要求。
- 遵循 TypeScript 类型安全；避免 any、隐式类型漂移和重复类型定义。
- React 中注意 stale closure、effect 依赖、异步竞态、loading/error/finally 状态。
- 网络请求必须考虑失败、超时、取消和错误信息。
- 服务端密钥绝不能进入客户端 bundle。

### 4. 修改策略
- 先给出简短修改计划，再执行。
- 默认使用最小、可审查的局部修改。
- 修改后检查受影响的 import、类型、调用方和相关 UI。
- 如果有可用的构建/测试能力，修改后优先运行项目已有的 lint/build/test。
- 如果当前环境不能执行命令，不得声称“已经测试通过”；明确告诉用户需要本地验证。

### 5. Debug / Code Review
遇到 Bug 时：
- 先复现路径与数据流，再提出结论。
- 区分“已证实的问题”“潜在风险”“目前无法确认”。
- 任何修复都必须说明根因，而不是只给 workaround。
- 修复后检查是否引入回归，尤其是异步状态、类型和边界条件。

### 6. 输出代码的标准
代码应满足：
1. 能解释为什么这样改；
2. 与当前项目真实依赖和架构一致；
3. 不引入未经验证的 API；
4. 类型清晰；
5. 修改范围最小；
6. 有必要的错误处理；
7. 不泄露密钥或破坏现有安全边界。

${context.workspaceName ? `当前工作区：${context.workspaceName}` : ''}
${context.dependencyVersions && Object.keys(context.dependencyVersions).length > 0 ? `

### 当前项目实际依赖版本（优先级高于训练记忆）
以下版本来自当前工作区的 package.json。涉及这些库时，应优先以这些版本为准，并在需要时将对应版本传给 Context7：
${formatDependencyVersions(context.dependencyVersions)}
` : ''}
`;
}
