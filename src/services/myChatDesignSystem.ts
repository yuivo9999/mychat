/**
 * MyChat Design System / UI Inventory
 *
 * Canonical, implementation-facing UI facts extracted from the current
 * MyChat styles and core components. Keep this file concise and update it
 * when the visual language changes.
 */
export const MYCHAT_DESIGN_SYSTEM_PROMPT = `
## MyChat Design System / UI Inventory（以当前代码为准）

这是 MyChat 的现有视觉与交互基线。UI 任务优先复用这里的规则；不要因为通用设计建议而擅自建立第二套视觉语言。

### 1. Global foundation
- Layout viewport：应用根节点使用 100% width/height + 100dvh，body/root 默认禁止页面级滚动。
- Font：默认 `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif`。
- Code：JetBrains Mono / Consolas / Monaco / monospace。
- Markdown：正文约 0.95rem、line-height 1.7；紧凑模式约 0.875rem、line-height 1.55。
- Base scrollbar：6px；透明轨道；thumb 使用半透明中性灰并采用 pill radius。
- Existing implementation is Tailwind-heavy. Prefer existing utility classes and component patterns over inventing new CSS.

### 2. Spacing / radius language
当前代码高频使用 2/3/4/6/8/12/14/16 等 Tailwind 间距，同时存在 6/8/10/12/14/16px 级圆角。
- 不要为了追求“理论上的 4px scale”而重构已有界面。
- 新 UI 优先贴合邻近组件已有 spacing/radius。
- 常见 compact control：p-1 / p-1.5 / p-2。
- 常见 card/control：rounded-lg / rounded-xl / rounded-2xl。
- Pill/badge：rounded-full。
- 交互控件默认应保证足够触控面积；移动端目标尺寸优先接近 48dp。

### 3. Core interaction patterns
- Primary actions：通常使用实色背景 + 高对比文字；当前默认主按钮大量使用 neutral-900 / dark neutral-100，并由主题覆盖。
- Secondary/icon actions：常见 p-1.5~p-2、rounded-xl、neutral text + hover background。
- Send action：当前 ChatComposer 使用约 2.5 padding、rounded-2xl、箭头图标；生成中切换为红色 Stop 状态。
- Input：ChatComposer 当前 min-height 100px、max-height 360px，transparent background，leading-relaxed；必须考虑移动端键盘。
- Toolbars：ChatComposer 使用左右分组，工具按钮约 24px icon，发送区单独强调。
- Dropdown/menu：优先使用已有 rounded-xl/rounded-lg + border + shadow 模式，并保持主题覆盖能力。
- Modal/drawer：项目已有多个专用 class（如 parameters-modal、settings-modal、model-config-modal、workspace-drawer）；优先复用，不重新发明结构。

### 4. Semantic hierarchy
- Primary text：neutral-800/900（深色主题对应 neutral-100/200）。
- Secondary text：neutral-500/400。
- Primary accent：项目默认常见 indigo；但主题可能覆盖为朱砂、金色、蓝色等。
- Success：emerald/green。
- Warning：amber/orange。
- Error/destructive：red。
- 不要把语义状态颜色当成装饰色；保持 success/warning/error 的含义稳定。

### 5. Chat surface
- Chat message uses dedicated semantic classes such as `user-message`, `assistant-message`, `user-message-avatar`, `ai-message-avatar`.
- 修改聊天视觉时优先修改这些语义 class 或现有组件，而不是给单个消息硬编码新的颜色。
- Markdown code blocks、inline code、blockquote 已有独立样式；不要在组件内重复造一套。
- Streaming cursor 已存在，不要重复添加第二种流式指示器。
- Compact mode 已存在，不要用新的 spacing hacks 替代它。

### 6. Existing theme contract
MyChat 已存在多套主题/皮肤。主题 CSS 会对 Tailwind utility 做覆盖，因此：
- 组件必须尽量使用语义/现有 utility，让主题有机会覆盖。
- 不要在新组件里大量写 `!important` 或固定 hex，除非是主题文件本身。
- 深色/浅色和主题皮肤必须一起考虑。
- 当前《桑田山河 · 朱印》主题的核心 token：
  - paper: #F4E8C8
  - paper-deep: #EAD8AD
  - paper-light: #FFF5DC
  - wood: #5B3B25
  - wood-dark: #3A261A
  - wood-light: #76502F
  - ink: #30271F
  - ink-soft: #51463B
  - muted: #806F5B
  - field: #728C48
  - vermilion: #A9362D
  - vermilion-dark: #86271F
  - gold: #B18A4A
  - line: #C5A873
  - line-dark: #80613E
  - shadow: 0 4px 14px rgba(58, 38, 26, .12)
  - heavy shadow: 0 14px 38px rgba(58, 38, 26, .24)
  - radius: 6 / 8 / 12px
- 桑田山河主题：宣纸/木色/墨色/稻田青绿/朱砂红/泥金；侧栏与顶部栏偏深乌木，主操作偏朱砂，正文偏宣纸。
- 桑田山河移动端已有 max-width:768px 适配，并将主要 modal/drawer 宽度约束为 calc(100vw - 20px)。

### 7. Responsive rules
- Desktop sidebar/header/main structure should not simply be squeezed onto phones.
- Mobile breakpoint already exists at 768px in the theme layer.
- Validate at 360 / 390 / 412 widths.
- Prevent horizontal overflow.
- Chat input must account for keyboard and viewport changes; existing code already uses 100dvh and keyboard-related handling.
- Keep core actions visible; move secondary actions to overflow rather than shrinking icons/text until unusable.
- For mobile dialogs, prefer the project's existing modal/drawer behavior before introducing a new bottom-sheet abstraction.

### 8. Accessibility / state completeness
For new or modified interactive UI, account for:
- default / hover / focus / active
- disabled
- loading / generating
- error / success
- empty / long text / overflow
- keyboard navigation where applicable
- aria-label/title for icon-only actions
- sufficient touch target on mobile
- contrast in both default and theme states

### 9. Engineering constraints
- Reuse existing components, classes, hooks, services and state flow.
- Do not introduce a new design dependency for a cosmetic change.
- Avoid large rewrites of App.tsx or unrelated components.
- If an existing class/token is semantically named, prefer it over raw color values.
- If a new visual value is genuinely necessary, first check nearby components and theme overrides; document why it cannot reuse an existing token.

### 10. UI inventory — known reusable surfaces
- Chat shell / composer: ChatComposer
- Message rendering: MessageList / ChatMessage
- Navigation: Sidebar / TopBar
- Runtime parameters: ParametersModal
- General settings: SettingsModal
- Workspace: WorkspaceDrawer
- Theme system: src/index.css + src/themes/sangtian-shanhe.css
- Runtime UI/UX policy: src/services/uiUxSkill.ts
